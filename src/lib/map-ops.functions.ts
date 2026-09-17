import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { emitHubEvent, type HubServerId } from "@/lib/hub-events";
import { DAYZ_SERVERS, resolveServiceId, type DayZServerId } from "@/lib/dayz/servers";

export type MapId = "chernarus" | "livonia";
export type StrikeKind = "airstrike" | "gas" | "strafe";
export type RadarMode = "base" | "counter_uav";

function hubServerId(serverId: DayZServerId): HubServerId {
  return serverId === "102x" ? "102" : "101";
}

function requireCoordinates(x: number, z: number) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) throw new Error("Coordinates are required");
}

export const fireMapStrike = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { kind: StrikeKind; x: number; z: number; radius?: number; map: MapId; serverId: DayZServerId; note?: string }) => data)
  .handler(async ({ data, context }) => {
    requireCoordinates(data.x, data.z);
    if (!(["airstrike", "gas", "strafe"] as string[]).includes(data.kind)) throw new Error("Invalid strike type");
    const server = DAYZ_SERVERS.find((entry) => entry.id === data.serverId);
    emitHubEvent({
      type: "map.strike",
      playerId: context.userId,
      playerName: context.userId,
      serverId: hubServerId(data.serverId),
      ts: Date.now(),
      meta: {
        kind: data.kind,
        x: Math.round(data.x),
        z: Math.round(data.z),
        radius: Math.max(0, Math.floor(data.radius ?? 0)),
        map: data.map,
        serviceId: server ? resolveServiceId(server) : null,
        note: data.note?.trim() || null,
      },
    });
    return { ok: true as const };
  });

export const runRadarScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { mode: RadarMode; x: number; z: number; radius?: number; map: MapId; serverId: DayZServerId }) => data)
  .handler(async ({ data, context }) => {
    requireCoordinates(data.x, data.z);
    if (data.mode !== "base" && data.mode !== "counter_uav") throw new Error("Invalid radar mode");
    emitHubEvent({
      type: "radar.scan",
      playerId: context.userId,
      playerName: context.userId,
      serverId: hubServerId(data.serverId),
      ts: Date.now(),
      meta: {
        mode: data.mode,
        x: Math.round(data.x),
        z: Math.round(data.z),
        radius: Math.max(50, Math.floor(data.radius ?? (data.mode === "counter_uav" ? 400 : 250))),
        map: data.map,
      },
    });
    return { ok: true as const };
  });

export const publishMapHeatmap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { map: MapId; points: { x: number; z: number; weight?: number }[]; serverId: DayZServerId }) => data)
  .handler(async ({ data, context }) => {
    if (!Array.isArray(data.points) || data.points.length === 0) throw new Error("Add at least one heatmap point");
    const points = data.points.slice(0, 200).map((point) => {
      requireCoordinates(point.x, point.z);
      return { x: Math.round(point.x), z: Math.round(point.z), weight: Math.max(1, Math.min(100, Math.floor(point.weight ?? 1))) };
    });
    emitHubEvent({
      type: "map.heatmap",
      playerId: context.userId,
      playerName: context.userId,
      serverId: hubServerId(data.serverId),
      ts: Date.now(),
      meta: { map: data.map, points },
    });
    return { ok: true as const, count: points.length };
  });