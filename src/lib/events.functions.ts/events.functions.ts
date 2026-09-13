import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { readJsonFile, writeJsonFile } from "@/lib/dayz/store";
import { emitHubEvent, type HubServerId } from "@/lib/hub-events";
import { DAYZ_SERVERS, resolveServiceId, type DayZServerId } from "@/lib/dayz/servers";

export type HubEventDef = {
  id: string;
  name: string;
  description: string;
  category: string;
};

export const HUB_EVENT_CATALOG: HubEventDef[] = [
  { id: "airdrop", name: "Airdrop", description: "Supply crate drop over a contested zone.", category: "Supply" },
  { id: "horde", name: "Infected Horde", description: "Large infected wave near a POI.", category: "Combat" },
  { id: "convoy", name: "Military Convoy", description: "Armed convoy route with high loot.", category: "Combat" },
  { id: "toxic_zone", name: "Toxic Zone", description: "Temporary gas / contamination area.", category: "Hazard" },
  { id: "heli_crash", name: "Heli Crash", description: "Crash site with military loot.", category: "Supply" },
  { id: "base_raid_window", name: "Base Raid Window", description: "Scheduled raid window announcement.", category: "PvP" },
  { id: "purge", name: "Server Purge", description: "High-intensity wipe-style event window.", category: "PvP" },
  { id: "trader_special", name: "Trader Special", description: "Limited-time trader stock / prices.", category: "Economy" },
];

type ActiveEvent = {
  eventId: string;
  eventName: string;
  serverId: HubServerId;
  serviceId: string;
  startedBy: string;
  startedByName: string;
  startedAt: number;
  note?: string;
};

type EventStore = {
  active: ActiveEvent[];
};

const DEFAULT_STORE: EventStore = { active: [] };

async function loadEvents() {
  return readJsonFile<EventStore>("hub-events-active.json", DEFAULT_STORE);
}

function mapHubServer(serverId: DayZServerId): HubServerId {
  return serverId.startsWith("102") ? "102" : "101";
}

function serviceIdFor(serverId: DayZServerId): string {
  const server = DAYZ_SERVERS.find((s) => s.id === serverId) ?? DAYZ_SERVERS[0];
  return resolveServiceId(server);
}

export const listHubEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const store = await loadEvents();
    return { catalog: HUB_EVENT_CATALOG, active: store.active };
  });

export const startHubEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    eventId: string;
    serverId: DayZServerId;
    playerId?: string;
    displayName?: string;
    note?: string;
  }) => data)
  .handler(async ({ data, context }) => {
    const def = HUB_EVENT_CATALOG.find((e) => e.id === data.eventId);
    if (!def) throw new Error("Unknown event");
    const playerId = data.playerId ?? context.userId ?? "demo-user";
    const displayName = data.displayName ?? playerId;
    const hubServer = mapHubServer(data.serverId);
    const serviceId = serviceIdFor(data.serverId);
    const store = await loadEvents();
    if (store.active.some((a) => a.eventId === def.id && a.serverId === hubServer)) {
      throw new Error("Event already active on this server");
    }
    const startedAt = Date.now();
    const active: ActiveEvent = {
      eventId: def.id,
      eventName: def.name,
      serverId: hubServer,
      serviceId,
      startedBy: playerId,
      startedByName: displayName,
      startedAt,
      note: data.note?.trim() || undefined,
    };
    store.active.unshift(active);
    await writeJsonFile("hub-events-active.json", store);

    emitHubEvent({
      type: "event.start",
      playerId,
      playerName: displayName,
      serverId: hubServer,
      ts: startedAt,
      meta: {
        eventId: def.id,
        eventName: def.name,
        category: def.category,
        serviceId,
        note: active.note ?? null,
      },
    });

    return { ok: true as const, active };
  });

export const stopHubEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    eventId: string;
    serverId: DayZServerId;
    playerId?: string;
    displayName?: string;
    note?: string;
  }) => data)
  .handler(async ({ data, context }) => {
    const def = HUB_EVENT_CATALOG.find((e) => e.id === data.eventId);
    if (!def) throw new Error("Unknown event");
    const playerId = data.playerId ?? context.userId ?? "demo-user";
    const displayName = data.displayName ?? playerId;
    const hubServer = mapHubServer(data.serverId);
    const store = await loadEvents();
    const before = store.active.length;
    store.active = store.active.filter(
      (a) => !(a.eventId === def.id && a.serverId === hubServer),
    );
    if (store.active.length === before) throw new Error("Event is not active on this server");
    await writeJsonFile("hub-events-active.json", store);
    const ts = Date.now();
    const serviceId = serviceIdFor(data.serverId);

    emitHubEvent({
      type: "event.stop",
      playerId,
      playerName: displayName,
      serverId: hubServer,
      ts,
      meta: {
        eventId: def.id,
        eventName: def.name,
        category: def.category,
        serviceId,
        note: data.note?.trim() || null,
      },
    });

    return { ok: true as const };
  });
