import { findAvailableLiveExecAdapter } from "@/lib/live-exec/registry";
import { getNpcSpawnPreset } from "@/lib/npc-presets";
import { emitHubEvent, type HubServerId } from "@/lib/hub-events";
import { downloadNitradoFile, uploadNitradoFile } from "@/lib/nitrado-files.functions";
import { DAYZ_SERVERS, resolveMissionPath, type DayZServerId } from "@/lib/dayz/servers";
import { buildEventXmlNode, buildSpawnPosXmlNode, upsertEventBlock } from "@/lib/dayz-event-xml";
import { readJsonFile, writeJsonFile } from "@/lib/dayz/store";

const NITRADO_API_BASE = "https://api.nitrado.net";
const EVENTS_FILE = "db/events.xml";
const TYPES_FILE = "db/types.xml";
const SPAWNS_FILE = "cfgeventspawns.xml";
const SPAWNABLE_TYPES_FILE = "cfgspawnabletypes.xml";

const LIVE_SPAWN_UNAVAILABLE_REASON =
  "Nitrado does not currently expose a live DayZ console execution channel.";

export type RunSpawnResult =
  | { mode: "live"; adapter: string; entity: string }
  | {
      mode: "restart_required";
      reason: string;
      eventName: string;
      restockSeconds: number;
      restarted: boolean;
    };

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

async function consumeCharge(playerId: string, npcId: string) {
  const inv = await readJsonFile<{
    owned?: Record<string, string[]>;
    charges: Record<string, Record<string, number>>;
  }>("npc-inventory.json", { charges: {} });
  if (!inv.charges) inv.charges = {};
  const charges = { ...(inv.charges[playerId] ?? {}) };
  for (const id of inv.owned?.[playerId] ?? []) {
    if ((charges[id] ?? 0) <= 0) charges[id] = 25;
  }
  const left = charges[npcId] ?? 0;
  if (left <= 0) throw new Error("No spawn charges left — buy a pack first");
  charges[npcId] = left - 1;
  inv.charges[playerId] = charges;
  await writeJsonFile("npc-inventory.json", inv);
}

async function restartServer(serviceId: string) {
  const token = process.env.NITRADO_API_TOKEN;
  if (!token) return false;
  const res = await fetch(`${NITRADO_API_BASE}/services/${serviceId}/gameservers/restart`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.ok;
}

async function queueOnDisk(input: {
  serviceId: string;
  serverId: DayZServerId;
  npcId: string;
  x: number;
  z: number;
  a: number;
}) {
  const preset = getNpcSpawnPreset(input.npcId);
  const server = DAYZ_SERVERS.find((s) => s.id === input.serverId) ?? DAYZ_SERVERS[0];
  const missionPath = resolveMissionPath(server);
  const eventName = `ItemAsylum_${input.npcId}_${Math.round(input.x)}_${Math.round(input.z)}`;
  const params = {
    eventName,
    classname: preset.classname,
    lifetime: preset.lifetime,
    restock: preset.restock,
    x: input.x,
    z: input.z,
    a: input.a,
  };
  const [eventsXml, spawnsXml] = await Promise.all([
    downloadNitradoFile(input.serviceId, EVENTS_FILE, missionPath),
    downloadNitradoFile(input.serviceId, SPAWNS_FILE, missionPath),
  ]);
  const nextEventsXml = upsertEventBlock(eventsXml, eventName, buildEventXmlNode(params), "events");
  const nextSpawnsXml = upsertEventBlock(spawnsXml, eventName, buildSpawnPosXmlNode(params), "eventposdef");
  const unchanged = nextEventsXml === eventsXml && nextSpawnsXml === spawnsXml;
  if (!unchanged) {
    await Promise.all([
      uploadNitradoFile(input.serviceId, EVENTS_FILE, nextEventsXml, missionPath),
      uploadNitradoFile(input.serviceId, SPAWNS_FILE, nextSpawnsXml, missionPath),
    ]);
  }
  return { eventName, restockSeconds: preset.restock, needsRestartToApply: !unchanged };
}

export async function runNpcSpawn(data: {
  serviceId: string;
  serverId?: string;
  npcId: string;
  x: number;
  z: number;
  a?: number;
  playerId?: string;
  playerName?: string;
}): Promise<RunSpawnResult> {
  const preset = getNpcSpawnPreset(data.npcId);
  const playerId = data.playerId?.trim() || "unknown";
  const playerName = data.playerName?.trim() || playerId;
  const serverId = normalizeDayZServerId(String(data.serverId || data.serviceId));
  const hubServerId = normalizeHubServerId(String(data.serverId || data.serviceId));
  const serviceId = String(data.serviceId || serverId);

  const { adapter } = await findAvailableLiveExecAdapter(serviceId);
  if (adapter) {
    const result = await adapter.spawnEntityAtPlayer(serviceId, {
      classname: preset.classname,
      x: data.x,
      y: 0,
      z: data.z,
    });
    if (result.ok) {
      await consumeCharge(playerId, data.npcId);
      emitHubEvent({
        type: "npc.spawn",
        playerId,
        playerName,
        serverId: hubServerId,
        ts: Date.now(),
        meta: { npcId: data.npcId, entity: preset.classname, mode: "live", adapter: result.via },
      });
      return { mode: "live", adapter: result.via, entity: preset.classname };
    }
  }

  const queued = await queueOnDisk({
    serviceId,
    serverId,
    npcId: data.npcId,
    x: data.x,
    z: data.z,
    a: data.a ?? 0,
  });
  let restarted = false;
  if (queued.needsRestartToApply) {
    restarted = await restartServer(serviceId);
  }
  await consumeCharge(playerId, data.npcId);
  emitHubEvent({
    type: "npc.spawn",
    playerId,
    playerName,
    serverId: hubServerId,
    ts: Date.now(),
    meta: { npcId: data.npcId, entity: preset.classname, mode: "restart_required", eventName: queued.eventName },
  });
  return {
    mode: "restart_required",
    reason: LIVE_SPAWN_UNAVAILABLE_REASON,
    eventName: queued.eventName,
    restockSeconds: queued.restockSeconds,
    restarted,
  };
}
