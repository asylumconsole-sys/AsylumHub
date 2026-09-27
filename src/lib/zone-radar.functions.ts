import { createServerFn } from "@tanstack/react-start";
import { Client } from "basic-ftp";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { loadBases, type CustomBase } from "@/lib/custom-bases";
import { DAYZ_SERVERS, resolveServiceId } from "@/lib/dayz/servers";
import { readJsonFile, writeJsonFile } from "@/lib/dayz/store";
import { emitHubEvent } from "@/lib/hub-events";

export type ZoneCandidate = {
  code: string;
  name: string;
  faction: string;
  ownerDiscordId: string;
  x: number;
  z: number;
  map: "livonia" | "chernarus";
  buildScore: number;
  confidence: "high" | "low";
  reason: string;
  isOwner: boolean;
};

type RadarStore = { zones: Record<string, { playerId: string; baseCode: string; range: string; claimedAt: string }> };
const EMPTY: RadarStore = { zones: {} };
type LinkStore = { byDiscordId: Record<string, { username?: string; discordId?: string; links?: { username: string; serverId: string }[] }> };
type Hit = { x: number; z: number; kind: "flag" | "build" | "pos"; map: "livonia" | "chernarus"; item?: string };

const ROOTS = {
  "101x": [
    "/games/ni12096544_1/ftproot/dayzps/config",
    "/games/ni12096544_1/ftproot/dayzps_missions",
    "/games/ni12096544_1/noftp/dayzps/config",
  ],
  "102x": [
    "/games/ni12096544_2/ftproot/dayzps/config",
    "/games/ni12096544_2/ftproot/dayzps_missions",
    "/games/ni12096544_2/noftp/dayzps/config",
  ],
} as const;

function fold(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function nitradoHeaders() {
  const token = process.env.NITRADO_API_TOKEN;
  return token ? { Authorization: `Bearer ${token}` } : null;
}

function botHeaders() {
  const token = process.env.DISCORD_TOKEN?.replace(/^Bot\s+/i, "");
  return token ? { Authorization: `Bot ${token}` } : null;
}

async function listDir(serviceId: string, dir: string) {
  const headers = nitradoHeaders();
  if (!headers) return [] as Array<{ path: string; name: string; type: string }>;
  const res = await fetch(
    `https://api.nitrado.net/services/${serviceId}/gameservers/file_server/list?dir=${encodeURIComponent(dir.replace(/\/$/, ""))}`,
    { headers },
  );
  if (!res.ok) return [];
  const json = (await res.json()) as { data?: { entries?: Array<{ path?: string; name?: string; type?: string }> } };
  return (json.data?.entries ?? []).map((e) => {
    const name = e.name || e.path?.split("/").pop() || "";
    const path = e.path && e.path.startsWith("/") ? e.path : `${dir.replace(/\/$/, "")}/${name}`;
    return { path, name, type: (e.type || "file").toLowerCase() };
  });
}

async function listLogs(serviceId: string, roots: readonly string[]) {
  const out: string[] = [];
  for (const root of roots) {
    const top = await listDir(serviceId, root);
    for (const entry of top) {
      if (entry.type.includes("dir")) {
        const nested = await listDir(serviceId, entry.path);
        for (const child of nested) {
          if (/\.(adm|rpt|log|txt)$/i.test(child.name)) out.push(child.path);
        }
      } else if (/\.(adm|rpt|log|txt)$/i.test(entry.name)) out.push(entry.path);
    }
  }
  return [...new Set(out)].sort().slice(-16);
}

async function downloadFile(serviceId: string, file: string) {
  const headers = nitradoHeaders();
  if (!headers) return "";
  const json = (await fetch(
    `https://api.nitrado.net/services/${serviceId}/gameservers/file_server/download?file=${encodeURIComponent(file)}`,
    { headers },
  ).then((r) => r.json()).catch(() => ({}))) as { data?: { url?: string; token?: { url?: string; token?: string } } };
  const url = json.data?.token?.url ?? json.data?.url;
  const token = json.data?.token?.token;
  if (!url) return "";
  const res = await fetch(url, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
  if (!res.ok) return "";
  const text = await res.text();
  return text.includes("<!DOCTYPE") ? "" : text.slice(0, 2_500_000);
}

function pullPos(line: string): { x: number; z: number } | null {
  const dayzpp = line.match(/Player Location\s+([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  if (dayzpp) {
    const x = Number(dayzpp[1]);
    const z = Number(dayzpp[2]);
    if (x > 20 && z > 20 && x < 16000 && z < 16000) return { x, z };
  }
  const patterns = [
    /pos\s*=\s*<\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*>/i,
    /pos\s*=\s*\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)/i,
  ];
  for (const re of patterns) {
    const m = line.match(re);
    if (!m) continue;
    const x = Number(m[1]);
    const z = Number(m[3]);
    if (x > 20 && z > 20 && x < 16000 && z < 16000) return { x, z };
  }
  return null;
}

function parseHits(text: string, names: string[], map: "livonia" | "chernarus"): Hit[] {
  const wants = [...new Set(names.map(fold).filter((n) => n.length >= 3))];
  if (!wants.length) return [];
  const hits: Hit[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!wants.some((w) => fold(line).includes(w))) continue;
    const placed = line.match(/([A-Za-z0-9_.-]{2,32})\s+placed\s+(.+?)(?:\.|$)/i);
    const pos = pullPos(line);
    if (!pos) continue;
    const item = placed?.[2]?.trim();
    const flag = /flag/i.test(item || line);
    const serverMap = /102x|chernarus/i.test(line) ? "chernarus" : /101x|livonia|asylum/i.test(line) ? "livonia" : map;
    hits.push({ ...pos, kind: flag ? "flag" : "build", map: serverMap, item });
  }
  return hits;
}

async function discordMemberNames(playerId: string) {
  const headers = botHeaders();
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!headers || !guildId || !playerId) return [] as string[];
  const member = (await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${playerId}`, { headers }).then((r) => r.json()).catch(() => null)) as { nick?: string; user?: { username?: string; global_name?: string } } | null;
  return [member?.nick, member?.user?.global_name, member?.user?.username].filter((n): n is string => Boolean(n?.trim()));
}

async function discordPlaceHits(names: string[]) {
  const headers = botHeaders();
  if (!headers) return { hits: [] as Hit[], channels: 0, note: "Discord bot token missing" };
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!guildId) return { hits: [] as Hit[], channels: 0, note: "Discord guild missing" };
  const channels = (await fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, { headers }).then((r) => r.json()).catch(() => [])) as Array<{ id: string; name?: string; type?: number }>;
  if (!Array.isArray(channels)) return { hits: [] as Hit[], channels: 0, note: "Could not list Discord channels" };
  const pinned = [process.env.DAYZPP_LOG_CHANNEL_ID, process.env.DISCORD_ONLINE_CHANNEL_ID, process.env.DISCORD_KILLFEED_CHANNEL_ID].filter(Boolean) as string[];
  const text = channels.filter((c) => c.type === 0);
  const ranked = [...text].sort((a, b) => {
    const score = (c: { id: string; name?: string }) => (pinned.includes(c.id) ? 0 : /place|build|log|admin|event|feed/i.test(c.name || "") ? 1 : 2);
    return score(a) - score(b);
  });
  const hits: Hit[] = [];
  let scanned = 0;
  for (const channel of ranked.slice(0, 12)) {
    let before: string | undefined;
    for (let page = 0; page < 2; page++) {
      const qs = new URLSearchParams({ limit: "100" });
      if (before) qs.set("before", before);
      const messages = (await fetch(`https://discord.com/api/v10/channels/${channel.id}/messages?${qs}`, { headers }).then((r) => r.json()).catch(() => [])) as Array<{ id?: string; content?: string; embeds?: Array<{ description?: string; title?: string; fields?: Array<{ name?: string; value?: string }> }> }>;
      if (!Array.isArray(messages) || !messages.length) break;
      scanned += 1;
      before = messages[messages.length - 1]?.id;
      for (const msg of messages) {
        const blob = [msg.content || "", ...(msg.embeds || []).flatMap((e) => [e.title || "", e.description || "", ...(e.fields || []).map((f) => `${f.name || ""} ${f.value || ""}`)])].join(" ");
        if (!/placed|Player Location/i.test(blob)) continue;
        hits.push(...parseHits(blob, names, /102x/i.test(blob) ? "chernarus" : "livonia"));
      }
      if (hits.length >= 8) return { hits, channels: scanned, note: `DayZ++ place lines in ${scanned} channel pages` };
    }
  }
  return { hits, channels: scanned, note: scanned ? `Scanned ${scanned} Discord pages, no place line for this tag` : "No Discord channel pages read" };
}

async function configHits(serverId: "101x" | "102x", names: string[]) {
  const catalog = DAYZ_SERVERS.find((s) => s.id === serverId);
  if (!catalog) return { hits: [] as Hit[], files: 0 };
  const serviceId = resolveServiceId(catalog);
  const files = await listLogs(serviceId, ROOTS[serverId]);
  const map = serverId === "102x" ? "chernarus" : "livonia";
  const hits: Hit[] = [];
  for (const file of files) {
    const text = await downloadFile(serviceId, file);
    if (text) hits.push(...parseHits(text, names, map));
  }
  return { hits, files: files.length };
}

async function ftpHits(serverId: "101x" | "102x", names: string[]) {
  const prefix = serverId === "101x" ? "FTP_101X" : "FTP_102X";
  const host = process.env[`${prefix}_HOST`] ?? process.env.FTP_HOST;
  const user = process.env[`${prefix}_USER`] ?? process.env.FTP_USER;
  const password = process.env[`${prefix}_PASS`] ?? process.env.FTP_PASS;
  const directory = process.env[`${prefix}_LOGS_PATH`] ?? process.env.FTP_LOGS_PATH ?? "/dayzps/config";
  if (!host || !user || !password) return [] as Hit[];
  const client = new Client();
  client.ftp.timeout = 25_000;
  try {
    await client.access({ host, user, password, port: Number(process.env[`${prefix}_PORT`] ?? process.env.FTP_PORT ?? 21) });
    const files = (await client.list(directory))
      .filter((file) => /\.(adm|rpt|log|txt)$/i.test(file.name))
      .sort((a, b) => (b.modifiedAt || 0) - (a.modifiedAt || 0))
      .slice(0, 12);
    const hits: Hit[] = [];
    const map = serverId === "102x" ? "chernarus" : "livonia";
    for (const file of files) {
      const chunks: Buffer[] = [];
      try {
        await client.downloadTo(
          { write(chunk: Buffer, _e: string, cb: () => void) { chunks.push(Buffer.from(chunk)); cb(); } } as never,
          `${directory.replace(/\/$/, "")}/${file.name}`,
        );
      } catch {
        continue;
      }
      hits.push(...parseHits(Buffer.concat(chunks).toString("utf8"), names, map));
    }
    return hits;
  } catch {
    return [];
  } finally {
    client.close();
  }
}

function densest(hits: Hit[]) {
  if (!hits.length) return null;
  let best = { x: hits[0].x, z: hits[0].z, map: hits[0].map, count: 1 };
  for (const a of hits) {
    const count = hits.filter((b) => Math.hypot(b.x - a.x, b.z - a.z) <= 120).length;
    if (count > best.count) best = { x: a.x, z: a.z, map: a.map, count };
  }
  return best;
}

function fromCustom(base: CustomBase, userId: string): ZoneCandidate | null {
  if (!Number.isFinite(base.x) || !Number.isFinite(base.z)) return null;
  return {
    code: base.code,
    name: base.name,
    faction: base.faction || "Unaffiliated",
    ownerDiscordId: base.ownerDiscordId,
    x: Math.round(base.x as number),
    z: Math.round(base.z as number),
    map: base.map || "livonia",
    buildScore: 80,
    confidence: "high",
    reason: "Listed custom base.",
    isOwner: base.ownerDiscordId === userId,
  };
}

async function linkedNames(playerId: string) {
  const store = await readJsonFile<LinkStore>("bot-account-links.json", { byDiscordId: {} });
  const row = store.byDiscordId[playerId] ?? Object.values(store.byDiscordId).find((item) => item.discordId === playerId);
  return [...new Set([...(row?.links ?? []).map((l) => l.username), row?.username].filter((n): n is string => Boolean(n?.trim())))];
}

export const detectPlayerZone = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { playerId?: string; factionName?: string; psnName?: string }) => data)
  .handler(async ({ data, context }) => {
    const playerId = data.playerId || context.userId || "";
    const names = [...new Set([data.psnName, ...(await linkedNames(playerId)), ...(await discordMemberNames(playerId))].filter((n): n is string => Boolean(n?.trim())))];
    const psn = names[0] || "";
    const [c101, c102, f101, f102, discord] = await Promise.all([
      configHits("101x", names),
      configHits("102x", names),
      ftpHits("101x", names),
      ftpHits("102x", names),
      discordPlaceHits(names),
    ]);
    const logHits = [...discord.hits, ...c101.hits, ...c102.hits, ...f101, ...f102];
    const flags = logHits.filter((h) => h.kind === "flag");
    const builds = logHits.filter((h) => h.kind === "build");
    const lastFlag = flags.at(-1) ?? null;
    const aroundFlag = lastFlag ? logHits.filter((h) => Math.hypot(h.x - lastFlag.x, h.z - lastFlag.z) <= 120).length : 0;
    const cluster = densest(builds.length ? builds : logHits);
    const pick = lastFlag
      ? { x: lastFlag.x, z: lastFlag.z, map: lastFlag.map, count: Math.max(aroundFlag, 1), why: `Last flag from DayZ++ place log for ${psn}` }
      : cluster
        ? { x: cluster.x, z: cluster.z, map: cluster.map, count: cluster.count, why: `${cluster.count} DayZ++ place line${cluster.count === 1 ? "" : "s"} for ${psn}` }
        : null;
    const logPrompt = pick
      ? ({
          code: `log-${Math.round(pick.x)}-${Math.round(pick.z)}`,
          name: `${psn} compound`,
          faction: data.factionName || "Linked account",
          ownerDiscordId: playerId,
          x: Math.round(pick.x),
          z: Math.round(pick.z),
          map: pick.map,
          buildScore: Math.min(100, 40 + pick.count * 6),
          confidence: "high" as const,
          reason: pick.why,
          isOwner: true,
        } satisfies ZoneCandidate)
      : null;
    const store = await loadBases();
    const all = store.bases.filter((b) => b.status !== "despawned");
    const mine = all.filter((b) => b.ownerDiscordId === playerId);
    const fileCandidates = mine.map((b) => fromCustom(b, playerId)).filter((c): c is ZoneCandidate => Boolean(c));
    return {
      playerId,
      psnName: psn || null,
      linkedNames: names,
      filesScanned: c101.files + c102.files + discord.channels,
      note: discord.note,
      flagsFound: flags.length,
      buildsFound: builds.length,
      positionsFound: logHits.length,
      clusterNearLastFlag: aroundFlag,
      builtItems: [...new Set(builds.map((b) => b.item).filter(Boolean))].slice(0, 20),
      isFactionOwner: Boolean(logPrompt) || mine.length > 0,
      ownedFactions: [] as string[],
      factions: [] as string[],
      candidates: [logPrompt, ...fileCandidates].filter(Boolean),
      prompt: logPrompt ?? fileCandidates.find((c) => c.confidence === "high") ?? null,
      factionBases: all.map((b) => ({
        code: b.code,
        name: b.name,
        faction: b.faction || "Unaffiliated",
        ownerDiscordId: b.ownerDiscordId,
        x: b.x,
        z: b.z,
        map: b.map || "livonia",
      })),
    };
  });

export const claimZoneRadar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { playerId?: string; baseCode: string; range?: string; confirmed: boolean; factionName?: string; x?: number; z?: number; map?: "livonia" | "chernarus" }) => data)
  .handler(async ({ data, context }) => {
    if (!data.confirmed) throw new Error("Confirm the base first");
    const playerId = data.playerId || context.userId || "";
    const store = await loadBases();
    const listed = store.bases.find((b) => b.code === data.baseCode);
    const x = listed?.x ?? data.x;
    const z = listed?.z ?? data.z;
    if (!Number.isFinite(x) || !Number.isFinite(z)) throw new Error("No flag coordinates to lock");
    const radar = await readJsonFile<RadarStore>("zone-radar.json", EMPTY);
    radar.zones[playerId] = { playerId, baseCode: data.baseCode, range: data.range || "500m", claimedAt: new Date().toISOString() };
    await writeJsonFile("zone-radar.json", radar);
    emitHubEvent({
      type: "radar.zone",
      playerId,
      playerName: listed?.ownerName || playerId,
      serverId: (listed?.map || data.map) === "chernarus" ? "102" : "101",
      ts: Date.now(),
      meta: { code: data.baseCode, x, z, range: data.range || "500m" },
    });
    return { ok: true as const, base: { code: data.baseCode, name: listed?.name || "Detected compound", x: Math.round(x as number), z: Math.round(z as number) }, range: data.range || "500m" };
  });
