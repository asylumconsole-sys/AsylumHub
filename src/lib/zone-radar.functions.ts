import { createServerFn } from "@tanstack/react-start";
import { Client } from "basic-ftp";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { loadBases, type CustomBase } from "@/lib/custom-bases";
import { DAYZ_SERVERS, resolveServiceId, resolveMissionPath } from "@/lib/dayz/servers";
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
type LinkStore = { byDiscordId: Record<string, { username?: string; links?: { username: string; serverId: string }[] }> };
type Hit = { x: number; z: number; kind: "flag" | "build" | "pos"; map: "livonia" | "chernarus" };

const FTP = {
  "101x": { host: "FTP_101X_HOST", user: "FTP_101X_USER", pass: "FTP_101X_PASS", port: "FTP_101X_PORT", path: "FTP_101X_LOGS_PATH", map: "livonia" as const },
  "102x": { host: "FTP_102X_HOST", user: "FTP_102X_USER", pass: "FTP_102X_PASS", port: "FTP_102X_PORT", path: "FTP_102X_LOGS_PATH", map: "chernarus" as const },
};

function nitradoHeaders() {
  const token = process.env.NITRADO_API_TOKEN;
  if (!token) return null;
  return { Authorization: `Bearer ${token}` };
}

async function nitradoList(serviceId: string, dir: string): Promise<Array<{ path: string; type?: string; name?: string }>> {
  const headers = nitradoHeaders();
  if (!headers) return [];
  const url = `https://api.nitrado.net/services/${serviceId}/gameservers/file_server/list?dir=${encodeURIComponent(dir)}`;
  const res = await fetch(url, { headers });
  if (!res.ok) return [];
  const json = (await res.json()) as { data?: { entries?: Array<{ path?: string; type?: string; name?: string }> } };
  return (json.data?.entries ?? []).map((e) => ({ path: e.path || `${dir.replace(/\/$/, "")}/${e.name || ""}`, type: e.type, name: e.name }));
}

async function nitradoDownload(serviceId: string, file: string): Promise<string> {
  const headers = nitradoHeaders();
  if (!headers) return "";
  const json = (await fetch(
    `https://api.nitrado.net/services/${serviceId}/gameservers/file_server/download?file=${encodeURIComponent(file)}`,
    { headers },
  ).then((r) => r.json())) as { data?: { url?: string; token?: { url?: string } } };
  const url = json.data?.url ?? json.data?.token?.url;
  if (!url) return "";
  const res = await fetch(url);
  if (!res.ok) return "";
  return res.text();
}

function isLogName(name: string) {
  return /\.(adm|rpt|log|txt)$/i.test(name) || /adm|rpt|admin|console/i.test(name);
}

async function collectLogPaths(serviceId: string, roots: string[]) {
  const files: string[] = [];
  const seen = new Set<string>();
  const queue = [...roots];
  let steps = 0;
  while (queue.length && steps < 40) {
    const dir = queue.shift();
    if (!dir || seen.has(dir)) continue;
    seen.add(dir);
    steps += 1;
    const entries = await nitradoList(serviceId, dir.endsWith("/") ? dir : `${dir}/`);
    for (const entry of entries) {
      const path = entry.path;
      if (!path || seen.has(path)) continue;
      const base = path.split("/").pop() || "";
      if (entry.type === "dir" || (!base.includes(".") && !isLogName(base))) {
        if (/log|config|profile|admin|dump|ftproot|dayzps/i.test(path) && steps < 40) queue.push(path);
        continue;
      }
      if (isLogName(base)) files.push(path);
    }
  }
  return files.slice(0, 40);
}

function pullPos(line: string): { x: number; z: number } | null {
  const patterns = [
    /pos=<\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*>/i,
    /pos=\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)/i,
    /\((-?[\d.]+)\s*[/,]\s*(-?[\d.]+)\s*[/,]\s*(-?[\d.]+)\)/,
    /\bX[:=]\s*(-?[\d.]+)[^\d-]{1,16}Z[:=]\s*(-?[\d.]+)/i,
  ];
  for (const re of patterns) {
    const m = line.match(re);
    if (!m) continue;
    const x = Number(m[1]);
    const z = Number(m[3] ?? m[2]);
    if (Number.isFinite(x) && Number.isFinite(z) && Math.abs(x) + Math.abs(z) > 20) return { x, z };
  }
  return null;
}

function parseHits(text: string, names: string[], map: "livonia" | "chernarus"): Hit[] {
  const wants = names.map((n) => n.trim().toLowerCase()).filter((n) => n.length >= 2);
  if (!wants.length) return [];
  const hits: Hit[] = [];
  for (const line of text.split(/\r?\n/)) {
    const low = line.toLowerCase();
    if (!wants.some((w) => low.includes(w))) continue;
    const pos = pullPos(line);
    if (!pos) continue;
    const flag = /flag|territoryflag|flagpole|flag_base/i.test(line);
    const build = /built|placed|construct|fence|watchtower|wall|gate|kit|shelter|tent|barrel|storage|base/i.test(line);
    hits.push({ ...pos, kind: flag ? "flag" : build ? "build" : "pos", map });
  }
  return hits;
}

async function nitradoHits(serverId: "101x" | "102x", names: string[]): Promise<{ hits: Hit[]; files: number }> {
  const catalog = DAYZ_SERVERS.find((s) => s.id === serverId);
  if (!catalog) return { hits: [], files: 0 };
  const serviceId = resolveServiceId(catalog);
  const mission = resolveMissionPath(catalog);
  const ftproot = mission.replace(/\/dayzps_missions\/.*$/, "/ftproot");
  const roots = [
    ftproot,
    `${ftproot}/dayzps`,
    `${ftproot}/dayzps/config`,
    `${ftproot}/dayzps/profiles`,
    mission.replace(/\/dayzOffline\.[^/]+$/, ""),
    mission,
  ];
  const files = await collectLogPaths(serviceId, roots);
  const map = serverId === "102x" ? "chernarus" : "livonia";
  const hits: Hit[] = [];
  for (const file of files) {
    const text = await nitradoDownload(serviceId, file);
    if (text) hits.push(...parseHits(text, names, map));
  }
  return { hits, files: files.length };
}

async function ftpHits(serverId: "101x" | "102x", names: string[]): Promise<Hit[]> {
  const cfg = FTP[serverId];
  const host = process.env[cfg.host] ?? process.env.FTP_HOST;
  const user = process.env[cfg.user] ?? process.env.FTP_USER;
  const password = process.env[cfg.pass] ?? process.env.FTP_PASS;
  const directory = process.env[cfg.path] ?? process.env.FTP_LOGS_PATH ?? "/dayzps/config";
  if (!host || !user || !password) return [];
  const client = new Client();
  client.ftp.timeout = 25_000;
  try {
    await client.access({ host, user, password, port: Number(process.env[cfg.port] ?? process.env.FTP_PORT ?? 21) });
    const files = (await client.list(directory))
      .filter((file) => isLogName(file.name))
      .sort((a, b) => b.modifiedAt - a.modifiedAt)
      .slice(0, 24);
    const hits: Hit[] = [];
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
      hits.push(...parseHits(Buffer.concat(chunks).toString("utf8"), names, cfg.map));
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
  let best = { x: hits[0].x, z: hits[0].z, map: hits[0].map, count: 0 };
  for (const a of hits) {
    const count = hits.filter((b) => Math.hypot(b.x - a.x, b.z - a.z) <= 90).length;
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
  const row = store.byDiscordId[playerId] ?? Object.values(store.byDiscordId).find((item) => (item as { discordId?: string }).discordId === playerId);
  return [...new Set([...(row?.links ?? []).map((l) => l.username), row?.username].filter((n): n is string => Boolean(n?.trim())))];
}

export const detectPlayerZone = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { playerId?: string; factionName?: string; psnName?: string }) => data)
  .handler(async ({ data, context }) => {
    const playerId = data.playerId || context.userId || "";
    const names = [...new Set([data.psnName, ...(await linkedNames(playerId))].filter((n): n is string => Boolean(n?.trim())))];
    const psn = names[0] || "";
    const [n101, n102, f101, f102] = await Promise.all([
      nitradoHits("101x", names),
      nitradoHits("102x", names),
      ftpHits("101x", names),
      ftpHits("102x", names),
    ]);
    const logHits = [...n101.hits, ...n102.hits, ...f101, ...f102];
    const flags = logHits.filter((h) => h.kind === "flag");
    const builds = logHits.filter((h) => h.kind === "build");
    const lastFlag = flags.at(-1) ?? null;
    const aroundFlag = lastFlag ? logHits.filter((h) => Math.hypot(h.x - lastFlag.x, h.z - lastFlag.z) <= 90).length : 0;
    const cluster = densest(logHits);
    const pick =
      lastFlag && aroundFlag >= 2
        ? { x: lastFlag.x, z: lastFlag.z, map: lastFlag.map, count: aroundFlag, why: `Last flag + ${aroundFlag} nearby pins` }
        : cluster && cluster.count >= 5
          ? { x: cluster.x, z: cluster.z, map: cluster.map, count: cluster.count, why: `${cluster.count} pins clustered` }
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
          buildScore: Math.min(100, 30 + pick.count * 4),
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
      filesScanned: n101.files + n102.files,
      flagsFound: flags.length,
      buildsFound: builds.length,
      positionsFound: logHits.length,
      clusterNearLastFlag: aroundFlag,
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
