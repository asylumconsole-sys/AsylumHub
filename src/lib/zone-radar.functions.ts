import { createServerFn } from "@tanstack/react-start";
import { Client } from "basic-ftp";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { loadBases, type CustomBase } from "@/lib/custom-bases";
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

const FTP = {
  "101x": { host: "FTP_101X_HOST", user: "FTP_101X_USER", pass: "FTP_101X_PASS", port: "FTP_101X_PORT", path: "FTP_101X_LOGS_PATH", map: "livonia" as const },
  "102x": { host: "FTP_102X_HOST", user: "FTP_102X_USER", pass: "FTP_102X_PASS", port: "FTP_102X_PORT", path: "FTP_102X_LOGS_PATH", map: "chernarus" as const },
};

type Hit = { x: number; z: number; kind: "flag" | "build" | "pos"; map: "livonia" | "chernarus" };

function pullPos(line: string): { x: number; z: number } | null {
  const patterns = [
    /pos=<\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*>/i,
    /pos=\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)/i,
    /\((-?[\d.]+)\s*[/,]\s*(-?[\d.]+)\s*[/,]\s*(-?[\d.]+)\)/,
    /\bX[:=]\s*(-?[\d.]+)[^\d-]{1,12}Z[:=]\s*(-?[\d.]+)/i,
    /\b(-?[\d]{3,5}\.\d+)\s+[\d.]+\s+(-?[\d]{3,5}\.\d+)/,
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

function parseHits(text: string, psn: string, map: "livonia" | "chernarus"): Hit[] {
  const want = psn.trim().toLowerCase();
  if (want.length < 2) return [];
  const hits: Hit[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.toLowerCase().includes(want)) continue;
    const pos = pullPos(line);
    if (!pos) continue;
    const flag = /flag|territoryflag|flagpole|flag_base|placed a flag/i.test(line);
    const build = /built|placed|construct|fence|watchtower|wall|gate|kit|shelter|tent|barrel|storage|base/i.test(line);
    hits.push({ ...pos, kind: flag ? "flag" : build ? "build" : "pos", map });
  }
  return hits;
}

async function readServerHits(server: keyof typeof FTP, psn: string): Promise<Hit[]> {
  const cfg = FTP[server];
  const host = process.env[cfg.host] ?? process.env.FTP_HOST;
  const user = process.env[cfg.user] ?? process.env.FTP_USER;
  const password = process.env[cfg.pass] ?? process.env.FTP_PASS;
  const directory = process.env[cfg.path] ?? process.env.FTP_LOGS_PATH ?? "/dayzps/config";
  if (!host || !user || !password) return [];
  const client = new Client();
  client.ftp.timeout = 25_000;
  try {
    await client.access({ host, user, password, port: Number(process.env[cfg.port] ?? process.env.FTP_PORT ?? 21) });
    const listed = await client.list(directory);
    const files = listed
      .filter((file) => /\.(ADM|RPT|LOG|TXT)$/i.test(file.name) || /adm|rpt|admin|log/i.test(file.name))
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
      hits.push(...parseHits(Buffer.concat(chunks).toString("utf8"), psn, cfg.map));
    }
    return hits;
  } catch {
    return [];
  } finally {
    client.close();
  }
}

function densest(hits: Hit[]): { x: number; z: number; map: Hit["map"]; count: number } | null {
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
  let n = 40;
  if ((base.amountPaid ?? 0) > 0) n += 25;
  if ((base.monthlyCost ?? 0) >= 25_000) n += 20;
  if (base.status === "active") n += 15;
  return {
    code: base.code,
    name: base.name,
    faction: base.faction || "Unaffiliated",
    ownerDiscordId: base.ownerDiscordId,
    x: Math.round(base.x as number),
    z: Math.round(base.z as number),
    map: base.map || "livonia",
    buildScore: n,
    confidence: n >= 70 ? "high" : "low",
    reason: n >= 70 ? "Listed custom base with paid cluster." : "Listed base, weak cluster.",
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
    const logHits = (await Promise.all(names.flatMap((name) => [readServerHits("101x", name), readServerHits("102x", name)]))).flat();
    const flags = logHits.filter((h) => h.kind === "flag");
    const builds = logHits.filter((h) => h.kind === "build");
    const lastFlag = flags.at(-1) ?? null;
    const aroundFlag = lastFlag ? logHits.filter((h) => Math.hypot(h.x - lastFlag.x, h.z - lastFlag.z) <= 90).length : 0;
    const cluster = densest(logHits);
    const useFlag = lastFlag && aroundFlag >= 3;
    const useCluster = cluster && cluster.count >= 8;
    const pick = useFlag
      ? { x: lastFlag.x, z: lastFlag.z, map: lastFlag.map, count: aroundFlag, why: `Last flag + ${aroundFlag} nearby log pins` }
      : useCluster
        ? { x: cluster.x, z: cluster.z, map: cluster.map, count: cluster.count, why: `${cluster.count} log pins clustered — treated as compound` }
        : null;
    const logPrompt = pick
      ? ({
          code: `log-${Math.round(pick.x)}-${Math.round(pick.z)}`,
          name: `${psn} compound`,
          faction: (data.factionName || "").trim() || "Linked account",
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
