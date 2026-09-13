import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { findAvailableLiveExecAdapter } from "@/lib/live-exec/registry";
import { getNpcSpawnPreset } from "@/lib/npc-presets";
import { queueNpcSpawn } from "@/lib/dayz-npc-spawn.functions";
import { restartNitradoServer } from "@/lib/nitrado-files.functions";
import { emitHubEvent, type HubServerId } from "@/lib/hub-events";

/** Discriminated so the UI can never mistake a queued restart-based spawn for a live one. */
export type SpawnResult =
    | { mode: "live"; adapter: string; entity: string }
  | {
          mode: "restart_required";
          reason: string;
          eventName: string;
          restockSeconds: number;
          restarted: boolean;
  };

const LIVE_SPAWN_UNAVAILABLE_REASON =
    "Nitrado does not currently expose a live DayZ console execution channel.";

function normalizeServerId(serviceId: string): HubServerId | null {
    const normalized = serviceId.trim().toLowerCase();
    if (normalized === "101" || normalized === "101x") return "101";
    if (normalized === "102" || normalized === "102x") return "102";
    return null;
}

/**
 * Single orchestration point: Command Center -> LiveExecutionAdapter ->
 * (live spawn | restart-based CE fallback). Never silently upgrades a
 * fallback into something that looks like a live spawn.
 */
export const spawnNpc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
        (d: {
                serviceId: string;
                npcId: string;
                x: number;
                z: number;
                a: number;
                playerId?: string;
                playerName?: string;
        }) => d,
      )
  .handler(async ({ data, context }): Promise<SpawnResult> => {
        const preset = getNpcSpawnPreset(data.npcId);
        const playerId = data.playerId?.trim() || context.userId || "unknown";
        const playerName = data.playerName?.trim() || playerId;
        const serverId = normalizeServerId(data.serviceId);

               const emitSpawnEvent = (meta: Record<string, unknown>) =>
                       emitHubEvent({
                                 type: "npc.spawn",
                                 playerId,
                                 playerName,
                                 serverId,
                                 ts: Date.now(),
                                 meta,
                       });

               const { adapter } = await findAvailableLiveExecAdapter(data.serviceId);
        if (adapter) {
                const result = await adapter.spawnEntityAtPlayer(data.serviceId, {
                          classname: preset.classname,
                          x: data.x,
                          y: 0,
                          z: data.z,
                });
                if (result.ok) {
                          emitSpawnEvent({
                                      npcId: data.npcId,
                                      entity: preset.classname,
                                      mode: "live",
                                      adapter: result.via,
                                      x: data.x,
                                      z: data.z,
                                      a: data.a,
                          });
                          return { mode: "live", adapter: result.via, entity: preset.classname };
                }
        }

               const queued = await queueNpcSpawn({ data });
        if (queued.needsRestartToApply) {
                await restartNitradoServer({ data: { serviceId: data.serviceId } });
        }
        const response = {
                mode: "restart_required",
                reason: LIVE_SPAWN_UNAVAILABLE_REASON,
                eventName: queued.eventName,
                restockSeconds: queued.restockSeconds,
                restarted: queued.needsRestartToApply,
        } as const;
        emitSpawnEvent({
                npcId: data.npcId,
                entity: preset.classname,
                mode: response.mode,
                eventName: response.eventName,
                restockSeconds: response.restockSeconds,
                restarted: response.restarted,
                x: data.x,
                z: data.z,
                a: data.a,
        });
        return response;
  });
