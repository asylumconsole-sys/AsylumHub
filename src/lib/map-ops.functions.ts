import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { emitHubEvent, type HubServerId } from "@/lib/hub-events";
import { DAYZ_SERVERS, resolveServiceId, type DayZServerId } from "@/lib/dayz/servers";

export type MapId = "chernarus" | "livonia";
export type StrikeKind = "airstrike" | "gas" | "strafe";
export type RadarMode = "base" | "counter_uav";

function mapHubServer(serverId: DayZServerId): HubServerId {
    return serverId.startsWith("102") ? "102" : "101";
}

function serviceIdFor(serverId: DayZServerId): string {
    const server = DAYZ_SERVERS.find((s) => s.id === serverId) ?? DAYZ_SERVERS[0];
    return resolveServiceId(server);
}

function requireCoords(x: number, z: number) {
    if (!Number.isFinite(x) || !Number.isFinite(z)) throw new Error("Coordinates required");
}

export const fireMapStrike = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
        kind: StrikeKind;
        x: number;
        z: number;
        radius?: number;
        map: MapId;
        serverId: DayZServerId;
        playerId?: string;
        displayName?: string;
        note?: string;
  }) => data)
  .handler(async ({ data, context }) => {
        requireCoords(data.x, data.z);
        if (!["airstrike", "gas", "strafe"].includes(data.kind)) throw new Error("Invalid strike kind");
        if (data.map !== "chernarus" && data.map !== "livonia") throw new Error("Invalid map");
        const playerId = data.playerId ?? context.userId ?? "demo-user";
        const displayName = data.displayName ?? playerId;
        const hubServer = mapHubServer(data.serverId);
        const serviceId = serviceIdFor(data.serverId);
        const ts = Date.now();
        const radius = data.radius != null ? Math.max(0, Math.floor(Number(data.radius))) : null;

               emitHubEvent({
                       type: "map.strike",
                       playerId,
                       playerName: displayName,
                       serverId: hubServer,
                       ts,
                       meta: {
                                 kind: data.kind,
                                 x: Math.round(data.x),
                                 z: Math.round(data.z),
                                 radius,
                                 map: data.map,
                                 serviceId,
                                 note: data.note?.trim() || null,
                       },
               });

               return { ok: true as const, ts };
  });

export const runRadarScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
        mode: RadarMode;
        x: number;
        z: number;
        radius?: number;
        durationSec?: number;
        map: MapId;
        serverId: DayZServerId;
        playerId?: string;
        displayName?: string;
  }) => data)
  .handler(async ({ data, context }) => {
        requireCoords(data.x, data.z);
        if (data.mode !== "base" && data.mode !== "counter_uav") throw new Error("Invalid radar mode");
        if (data.map !== "chernarus" && data.map !== "livonia") throw new Error("Invalid map");
        const playerId = data.playerId ?? context.userId ?? "demo-user";
        const displayName = data.displayName ?? playerId;
        const hubServer = mapHubServer(data.serverId);
        const serviceId = serviceIdFor(data.serverId);
        const ts = Date.now();
        const radius = Math.max(50, Math.floor(Number(data.radius ?? (data.mode === "counter_uav" ? 400 : 250))));
        const durationSec = Math.max(10, Math.floor(Number(data.durationSec ?? 120)));

               emitHubEvent({
                       type: "radar.scan",
                       playerId,
                       playerName: displayName,
                       serverId: hubServer,
                       ts,
                       meta: {
                                 mode: data.mode,
                                 x: Math.round(data.x),
                                 z: Math.round(data.z),
                                 radius,
                                 durationSec,
                                 map: data.map,
                                 serviceId,
                       },
               });

               return { ok: true as const, ts, radius, durationSec };
  });
