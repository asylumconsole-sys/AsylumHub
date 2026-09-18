import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildEventXmlNode, buildSpawnPosXmlNode, upsertEventBlock } from "@/lib/dayz-event-xml";
import { downloadNitradoFile, uploadNitradoFile } from "@/lib/nitrado-files.functions";
import { DAYZ_SERVERS, resolveMissionPath, type DayZServerId } from "@/lib/dayz/servers";

/** CE mission-relative paths. Items already exist in types.xml — only events + spawns. */
const EVENTS_FILE = "db/events.xml";
const SPAWNS_FILE = "cfgeventspawns.xml";

const ITEM_LIFETIME = 1800;
const ITEM_RESTOCK = 0;

export type QueueItemSpawnResult = {
  eventName: string;
  needsRestartToApply: boolean;
};

function resolveServerId(input?: string): DayZServerId {
  const raw = (input || "").trim().toLowerCase();
  if (raw === "102" || raw === "102x") return "102x";
  return "101x";
}

/** Sanitize classname for CE event name — non-alnum → `_`. */
export function sanitizeClassnameForEvent(classname: string): string {
  return classname.replace(/[^A-Za-z0-9]/g, "_");
}

/**
 * Writes a one-shot shop item spawn into events.xml + cfgeventspawns.xml.
 * Event names MUST start with Item* or CE ignores them.
 */
export const queueItemSpawn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      serviceId: string;
      serverId?: DayZServerId | string;
      classname: string;
      x: number;
      z: number;
      a: number;
    }) => d,
  )
  .handler(async ({ data }): Promise<QueueItemSpawnResult> => {
    const classname = data.classname?.trim();
    if (!classname) throw new Error("classname required");

    const serverId = resolveServerId(data.serverId);
    const server = DAYZ_SERVERS.find((s) => s.id === serverId) ?? DAYZ_SERVERS[0];
    const missionPath = resolveMissionPath(server);
    const safeClass = sanitizeClassnameForEvent(classname);
    const eventName = `ItemShop_${safeClass}_${Math.round(data.x)}_${Math.round(data.z)}`;
    const params = {
      eventName,
      classname,
      lifetime: ITEM_LIFETIME,
      restock: ITEM_RESTOCK,
      x: data.x,
      z: data.z,
      a: data.a,
    };

    const [eventsXml, spawnsXml] = await Promise.all([
      downloadNitradoFile(data.serviceId, EVENTS_FILE, missionPath),
      downloadNitradoFile(data.serviceId, SPAWNS_FILE, missionPath),
    ]);

    const nextEventsXml = upsertEventBlock(eventsXml, eventName, buildEventXmlNode(params), "events");
    const nextSpawnsXml = upsertEventBlock(spawnsXml, eventName, buildSpawnPosXmlNode(params), "eventposdef");

    const unchanged = nextEventsXml === eventsXml && nextSpawnsXml === spawnsXml;
    if (unchanged) {
      return { eventName, needsRestartToApply: false };
    }

    await Promise.all([
      uploadNitradoFile(data.serviceId, EVENTS_FILE, nextEventsXml, missionPath),
      uploadNitradoFile(data.serviceId, SPAWNS_FILE, nextSpawnsXml, missionPath),
    ]);

    return { eventName, needsRestartToApply: true };
  });
