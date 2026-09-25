import { createServerFn } from "@tanstack/react-start";
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

function score(base: CustomBase) {
  let n = 0;
  if (Number.isFinite(base.x) && Number.isFinite(base.z)) n += 40;
  if ((base.amountPaid ?? 0) > 0) n += 25;
  if ((base.monthlyCost ?? 0) >= 25_000) n += 20;
  if (base.status === "active") n += 15;
  return n;
}

function toCandidate(base: CustomBase, userId: string, founderName?: string): ZoneCandidate | null {
  if (!Number.isFinite(base.x) || !Number.isFinite(base.z)) return null;
  const buildScore = score(base);
  const high = buildScore >= 70;
  const sameFaction = Boolean(founderName && base.faction && base.faction.toLowerCase() === founderName.toLowerCase());
  return {
    code: base.code,
    name: base.name,
    faction: base.faction || founderName || "Unaffiliated",
    ownerDiscordId: base.ownerDiscordId,
    x: Math.round(base.x as number),
    z: Math.round(base.z as number),
    map: base.map || "livonia",
    buildScore,
    confidence: high ? "high" : "low",
    reason: high ? "Last flag pole matches a dense build cluster." : "Flag seen, but not enough nearby builds to be sure.",
    isOwner: base.ownerDiscordId === userId || sameFaction,
  };
}

export const detectPlayerZone = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { playerId?: string; factionName?: string }) => data)
  .handler(async ({ data, context }) => {
    const playerId = data.playerId || context.userId || "";
    const founderName = (data.factionName || "").trim();
    const store = await loadBases();
    const all = store.bases.filter((b) => b.status !== "despawned");
    const mine = all.filter(
      (b) =>
        b.ownerDiscordId === playerId ||
        (founderName && b.faction && b.faction.toLowerCase() === founderName.toLowerCase()),
    );
    const factions = Array.from(new Set([...all.map((b) => b.faction), founderName].filter(Boolean) as string[]));
    const ownedFactions = Array.from(new Set([...mine.map((b) => b.faction), founderName].filter(Boolean) as string[]));
    const candidates = (mine.length ? mine : all.filter((b) => founderName && b.faction?.toLowerCase() === founderName.toLowerCase()))
      .map((b) => toCandidate(b, playerId, founderName))
      .filter((c): c is ZoneCandidate => Boolean(c))
      .sort((a, b) => b.buildScore - a.buildScore);
    const prompt = candidates.find((c) => c.confidence === "high" && c.isOwner) ?? null;
    return {
      playerId,
      factionName: founderName || null,
      isFactionOwner: Boolean(founderName) || mine.length > 0,
      ownedFactions,
      factions,
      candidates,
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
  .inputValidator((data: { playerId?: string; baseCode: string; range?: string; confirmed: boolean; factionName?: string }) => data)
  .handler(async ({ data, context }) => {
    if (!data.confirmed) throw new Error("Confirm the base first");
    const playerId = data.playerId || context.userId || "";
    const founderName = (data.factionName || "").trim();
    const store = await loadBases();
    const base = store.bases.find((b) => b.code === data.baseCode);
    if (!base) throw new Error("Base not found");
    const owns =
      base.ownerDiscordId === playerId ||
      Boolean(founderName && base.faction && base.faction.toLowerCase() === founderName.toLowerCase());
    if (!owns && !founderName) throw new Error("Only the faction owner can claim this zone");
    if (!Number.isFinite(base.x) || !Number.isFinite(base.z)) {
      throw new Error("This base has no flag coordinates yet");
    }
    if (founderName && base.faction && base.faction.toLowerCase() !== founderName.toLowerCase() && base.ownerDiscordId !== playerId) {
      throw new Error("That base is not your faction's");
    }
    const radar = await readJsonFile<RadarStore>("zone-radar.json", EMPTY);
    radar.zones[playerId] = {
      playerId,
      baseCode: base.code,
      range: data.range || "500m",
      claimedAt: new Date().toISOString(),
    };
    await writeJsonFile("zone-radar.json", radar);
    emitHubEvent({
      type: "radar.zone",
      playerId,
      playerName: base.ownerName,
      serverId: base.map === "chernarus" ? "102" : "101",
      ts: Date.now(),
      meta: { code: base.code, x: base.x, z: base.z, range: data.range || "500m", faction: base.faction || founderName },
    });
    return { ok: true as const, base: toCandidate(base, playerId, founderName), range: data.range || "500m" };
  });
