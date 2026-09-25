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

type RadarStore = {
  zones: Record<string, { playerId: string; baseCode: string; range: string; claimedAt: string }>;
};
const EMPTY: RadarStore = { zones: {} };

const FTP = {
  "101x": { host: "FTP_101X_HOST", user: "FTP_101X_USER", pass: "FTP_101X_PASS", port: "FTP_101X_PORT", path: "FTP_101X_LOGS_PATH", map: "livonia" as const },
  "102x": { host: "FTP_102X_HOST", user: "FTP_102X_USER", pass: "FTP_102X_PASS", port: "FTP_102X_PORT", path: "FTP_102X_LOGS_PATH", map: "chernarus" as const },
};

type BuildHit = { x: number; z: number; kind: "flag" | "build"; map: "livonia" | "chernarus"; line: string };

function parseHits(text: string, psn: string, map: "livonia" | "chernarus"): BuildHit[] {
  const want = psn.trim().toLowerCase();
  if (!want) return [];
  const hits: BuildHit[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.toLowerCase().includes(want)) continue;
    const pos = line.match(/pos=<\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*>/i)
      || line.match(/\bpos\s*[:=]\s*\(?\s*(-?[\d.]+)\s*[, ]\s*(-?[\d.]+)\s*[, ]\s*(-?[\d.]+)/i)
      || line.match(/\bx\s*[:=]\s*(-?[\d.]+).{0,24}z\s*[:=]\s*(-?[\d.]+)/i);
    if (!pos) continue;
    const x = Number(pos[1]);
    const z = Number(pos[3] ?? pos[2]);
    if (!Number.isFinite(x) || !Number.isFinite(z)) continue;
    const flag = /flag|territoryflag|flagpole|flag_base/i.test(line);
    const build = /built|placed|construct|fence|watchtower|wall|gate|kit|shelter|tent|barrel|storage/i.test(line);
    if (!flag && !build) continue;
    hits.push({ x, z, kind: flag ? "flag" : "build", map, line: line.slice(0, 180) });
  }
  return hits;
}

async function readServerHits(server: keyof typeof FTP, psn: string): Promise<BuildHit[]> {
  const cfg = FTP[server];
  const host = process.env[cfg.host] ?? process.env.FTP_HOST;
  const user = process.env[cfg.user] ?? process.env.FTP_USER;
  const password = process.env[cfg.pass] ?? process.env.FTP_PASS;
  const directory = process.env[cfg.path] ?? process.env.FTP_LOGS_PATH ?? "/dayzps/config";
  if (!host || !user || !password) return [];
  const client = new Client();
  client.ftp.timeout = 18_000;
  try {
    await client.access({ host, user, password, port: Number(process.env[cfg.port] ?? process.env.FTP_PORT ?? 21) });
    const files = (await client.list(directory))
      .filter((file) => /\.(ADM|RPT)$/i.test(file.name))
      .sort((a, b) => b.modifiedAt - a.modifiedAt)
      .slice(0, 4);
    const hits: BuildHit[] = [];
    for (const file of files) {
      const chunks: Buffer[] = [];
      await client.downloadTo(
        { write(chunk: Buffer, _e: string, cb: () => void) { chunks.push(Buffer.from(chunk)); cb(); } } as never,
        `${directory.replace(/\/$/, "")}/${file.name}`,
      );
      hits.push(...parseHits(Buffer.concat(chunks).toString("utf8"), psn, cfg.map));
    }
    return hits;
  } catch {
    return [];
  } finally {
    client.close();
  }
}

function clusterScore(flag: BuildHit, builds: BuildHit[]) {
  return builds.filter((b) => {
    const dx = b.x - flag.x;
    const dz = b.z - flag.z;
    return Math.hypot(dx, dz) <= 90;
  }).length;
}

function fromCustom(base: CustomBase, userId: string): ZoneCandidate | null {
  if (!Number.isFinite(base.x) || !Number.isFinite(base.z)) return null;
  let n = 0;
  n += 40;
  if ((base.amountPaid ?? 0) > 0) n += 25;
  if ((base.monthlyCost ?? 0) >= 25_000) n += 20;
  if (base.status === "active") n += 15;
  const high = n >= 70;
  return {
    code: base.code,
    name: base.name,
    faction: base.faction || "Unaffiliated",
    ownerDiscordId: base.ownerDiscordId,
    x: Math.round(base.x as number),
    z: Math.round(base.z as number),
    map: base.map || "livonia",
    buildScore: n,
    confidence: high ? "high" : "low",
    reason: high ? "Last flag pole matches a dense build cluster." : "Flag on file, cluster not dense enough.",
    isOwner: base.ownerDiscordId === userId,
  };
}

export const detectPlayerZone = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { playerId?: string; factionName?: string; psnName?: string }) => data)
  .handler(async ({ data, context }) => {
    const playerId = data.playerId || context.userId || "";
    const psn = (data.psnName || "").trim();
    const logHits = psn
      ? (await Promise.all([readServerHits("101x", psn), readServerHits("102x", psn)])).flat()
      : [];
    const flags = logHits.filter((h) => h.kind === "flag");
    const builds = logHits.filter((h) => h.kind === "build");
    const lastFlag = flags.at(-1) ?? null;
    const near = lastFlag ? clusterScore(lastFlag, builds) : 0;
    const logPrompt =
      lastFlag && near >= 8
        ? ({
            code: `log-${Math.round(lastFlag.x)}-${Math.round(lastFlag.z)}`,
            name: `${psn} compound`,
            faction: (data.factionName || "").trim() || "Linked account",
            ownerDiscordId: playerId,
            x: Math.round(lastFlag.x),
            z: Math.round(lastFlag.z),
            map: lastFlag.map,
            buildScore: 40 + Math.min(60, near * 5),
            confidence: "high" as const,
            reason: `Last flag pole at ${Math.round(lastFlag.x)}, ${Math.round(lastFlag.z)} with ${near} nearby builds.`,
            isOwner: true,
          } satisfies ZoneCandidate)
        : null;

    const store = await loadBases();
    const all = store.bases.filter((b) => b.status !== "despawned");
    const mine = all.filter((b) => b.ownerDiscordId === playerId);
    const fileCandidates = mine.map((b) => fromCustom(b, playerId)).filter((c): c is ZoneCandidate => Boolean(c));
    const prompt = logPrompt ?? fileCandidates.find((c) => c.confidence === "high") ?? null;
    return {
      playerId,
      psnName: psn || null,
      flagsFound: flags.length,
      buildsFound: builds.length,
      clusterNearLastFlag: near,
      isFactionOwner: Boolean(data.factionName) || mine.length > 0 || Boolean(logPrompt),
      ownedFactions: [] as string[],
      factions: [] as string[],
      candidates: [logPrompt, ...fileCandidates].filter(Boolean),
      prompt,
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
    radar.zones[playerId] = {
      playerId,
      baseCode: data.baseCode,
      range: data.range || "500m",
      claimedAt: new Date().toISOString(),
    };
    await writeJsonFile("zone-radar.json", radar);
    emitHubEvent({
      type: "radar.zone",
      playerId,
      playerName: listed?.ownerName || playerId,
      serverId: (listed?.map || data.map) === "chernarus" ? "102" : "101",
      ts: Date.now(),
      meta: { code: data.baseCode, x, z, range: data.range || "500m" },
    });
    return {
      ok: true as const,
      base: {
        code: data.baseCode,
        name: listed?.name || "Detected compound",
        x: Math.round(x as number),
        z: Math.round(z as number),
      },
      range: data.range || "500m",
    };
  });
