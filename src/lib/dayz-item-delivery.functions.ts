import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { findAvailableLiveExecAdapter } from "@/lib/live-exec/registry";
import { queueItemSpawn } from "@/lib/dayz-item-spawn.functions";
import { restartNitradoServer } from "@/lib/nitrado-files.functions";
import { emitHubEvent, type HubServerId } from "@/lib/hub-events";
import { type DayZServerId } from "@/lib/dayz/servers";

export type ItemSpawnResult =
  | { mode: "live"; adapter: string; entity: string }
  | {
      mode: "restart_required";
      reason: string;
      eventName: string;
      restarted: boolean;
    };

const LIVE_SPAWN_UNAVAILABLE_REASON =
  "Nitrado does not currently expose a live DayZ console execution channel.";

function normalizeHubServerId(serviceId: string): HubServerId | null {
  const normalized = serviceId.trim().toLowerCase();
  if (normalized === "101" || normalized === "101x") return "101";
  if (normalized === "102" || normalized === "102x") return "102";
  return null;
}

function normalizeDayZServerId(serviceId: string): DayZServerId {
  const normalized = serviceId.trim().toLowerCase();
  if (normalized === "102" || normalized === "102x") return "102x";
  return "101x";
}

/**
 * Deliver a shop item: try live exec first, else queue a CE ItemShop_* event
 * and restart the Nitrado service when CE config changed.
 */
export const spawnShopItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      serviceId: string;
      serverId?: DayZServerId | string;
      classname: string;
      x: number;
      z: number;
      a: number;
      playerId?: string;
      playerName?: string;
      itemId?: string;
    }) => d,
  )
  .handler(async ({ data, context }): Promise<ItemSpawnResult> => {
    const classname = data.classname?.trim();
    if (!classname) throw new Error("classname required");

    const playerId = data.playerId?.trim() || context.userId || "unknown";
    const playerName = data.playerName?.trim() || playerId;
    const serverId = data.serverId
      ? normalizeDayZServerId(String(data.serverId))
      : normalizeDayZServerId(data.serviceId);
    const hubServerId = normalizeHubServerId(String(data.serverId || data.serviceId));

    const emitSpawnEvent = (meta: Record<string, unknown>) =>
      emitHubEvent({
        type: "item.spawn",
        playerId,
        playerName,
        serverId: hubServerId,
        ts: Date.now(),
        meta,
      });

    const { adapter } = await findAvailableLiveExecAdapter(data.serviceId);
    if (adapter) {
      const result = await adapter.spawnEntityAtPlayer(data.serviceId, {
        classname,
        x: data.x,
        y: 0,
        z: data.z,
      });
      if (result.ok) {
        emitSpawnEvent({
          itemId: data.itemId,
          entity: classname,
          mode: "live",
          adapter: result.via,
          x: data.x,
          z: data.z,
          a: data.a,
        });
        return { mode: "live", adapter: result.via, entity: classname };
      }
    }

    const queued = await queueItemSpawn({
      data: {
        serviceId: data.serviceId,
        serverId,
        classname,
        x: data.x,
        z: data.z,
        a: data.a,
      },
    });
    if (queued.needsRestartToApply) {
      await restartNitradoServer({ data: { serviceId: data.serviceId } });
    }
    const response: ItemSpawnResult = {
      mode: "restart_required",
      reason: LIVE_SPAWN_UNAVAILABLE_REASON,
      eventName: queued.eventName,
      restarted: queued.needsRestartToApply,
    };
    emitSpawnEvent({
      itemId: data.itemId,
      entity: classname,
      mode: response.mode,
      eventName: response.eventName,
      restarted: response.restarted,
      x: data.x,
      z: data.z,
      a: data.a,
    });
    return response;
  });
