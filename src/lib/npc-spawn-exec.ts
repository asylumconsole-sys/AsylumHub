import { getNpcSpawnPreset } from "@/lib/npc-presets";
import { buildEventXmlNode, buildSpawnPosXmlNode, upsertEventBlock } from "@/lib/dayz-event-xml";
import { downloadNitradoFile, uploadNitradoFile } from "@/lib/nitrado-files.functions";
import { DAYZ_SERVERS, resolveMissionPath, resolveServiceId } from "@/lib/dayz/servers";
import { readJsonFile, writeJsonFile } from "@/lib/dayz/store";
import { emitHubEvent } from "@/lib/hub-events";
import { dmOwner } from "@/lib/custom-bases-discord";

const EVENTS_FILE = "db/events.xml";
const TYPES_FILE = "db/types.xml";
const SPAWNS_FILE = "cfgeventspawns.xml";
const SPAWNABLE_TYPES_FILE = "cfgspawnabletypes.xml";

type Inv = { charges: Record<string, Record<string, number>>; owned?: Record<string, string[]> };
type Wave = {
  id: string;
  playerId: string;
  playerName: string;
  npcId: string;
  npcName: string;
  serviceId: string;
  x: number;
  z: number;
  remaining: number;
  lastSpawnAt: number;
  nextAt: number;
};

function serverFor(id?: string) {
  const raw = String(id || "101x").toLowerCase();
  return DAYZ_SERVERS.find((s) => raw.includes(s.id.replace("x", "")) || raw === s.id) ?? DAYZ_SERVERS[0];
}

function nitradoServiceId(hint?: string) {
  const server = serverFor(hint);
  if (hint && /^\d+$/.test(hint)) return hint;
  return resolveServiceId(server);
}

function profileRoot(serverId?: string) {
  const server = serverFor(serverId);
  const mission = resolveMissionPath(server);
  return mission.replace(/\/dayzOffline\.[^/]+$/, "").replace(/\/dayzps_missions$/, "") || mission;
}

export async function consumeCharge(playerId: string, npcId: string) {
  const inv = await readJsonFile<Inv>("npc-inventory.json", { charges: {} });
  if (!inv.charges[playerId]) inv.charges[playerId] = {};
  const left = inv.charges[playerId][npcId] ?? 0;
  if (left <= 0) throw new Error("No spawn charges left — buy a pack first");
  inv.charges[playerId][npcId] = left - 1;
  await writeJsonFile("npc-inventory.json", inv);
  return inv.charges[playerId][npcId];
}

async function writeLiveCommand(serviceId: string, serverHint: string, cmd: Record<string, unknown>) {
  const root = profileRoot(serverHint);
  const body = JSON.stringify({ commands: [cmd] }, null, 2);
  try {
    await uploadNitradoFile(serviceId, "LiveSpawner/commands.json", body, root);
    return true;
  } catch {
    try {
      await uploadNitradoFile(serviceId, "commands.json", body, `${root}/LiveSpawner`);
      return true;
    } catch {
      return false;
    }
  }
}

export async function executeQueueNpcSpawn(data: {
  serviceId: string;
  serverId?: string;
  npcId: string;
  x: number;
  z: number;
  a?: number;
}) {
  const preset = getNpcSpawnPreset(data.npcId);
  const server = serverFor(data.serverId || data.serviceId);
  const serviceId = nitradoServiceId(data.serviceId || data.serverId);
  const missionPath = resolveMissionPath(server);
  const eventName = `ItemAsylum_${data.npcId}_${Math.round(data.x)}_${Math.round(data.z)}`;
  const live = await writeLiveCommand(serviceId, server.id, {
    type: "spawn_infected",
    classname: preset.classname,
    x: Math.round(data.x),
    y: 0,
    z: Math.round(data.z),
    count: 1,
  });
  const params = {
    eventName,
    classname: preset.classname,
    lifetime: preset.lifetime,
    restock: preset.restock,
    x: data.x,
    z: data.z,
    a: data.a || 0,
  };
  try {
    const [eventsXml, spawnsXml, spawnableTypesXml, typesXml] = await Promise.all([
      downloadNitradoFile(serviceId, EVENTS_FILE, missionPath),
      downloadNitradoFile(serviceId, SPAWNS_FILE, missionPath),
      downloadNitradoFile(serviceId, SPAWNABLE_TYPES_FILE, missionPath),
      downloadNitradoFile(serviceId, TYPES_FILE, missionPath),
    ]);
    const nextEventsXml = upsertEventBlock(eventsXml, eventName, buildEventXmlNode(params), "events");
    const nextSpawnsXml = upsertEventBlock(spawnsXml, eventName, buildSpawnPosXmlNode(params), "eventposdef");
    const unchanged = nextEventsXml === eventsXml && nextSpawnsXml === spawnsXml;
    if (!unchanged) {
      await Promise.all([
        uploadNitradoFile(serviceId, EVENTS_FILE, nextEventsXml, missionPath),
        uploadNitradoFile(serviceId, SPAWNS_FILE, nextSpawnsXml, missionPath),
        uploadNitradoFile(serviceId, SPAWNABLE_TYPES_FILE, spawnableTypesXml, missionPath),
        uploadNitradoFile(serviceId, TYPES_FILE, typesXml, missionPath),
      ]);
    }
    return { eventName, restockSeconds: preset.restock, restarted: false, entity: preset.classname, live };
  } catch (error) {
    if (live) {
      return { eventName, restockSeconds: preset.restock, restarted: false, entity: preset.classname, live: true };
    }
    throw error;
  }
}

export async function executeNpcSpawn(data: {
  serviceId: string;
  serverId?: string;
  npcId: string;
  npcName?: string;
  x: number;
  z: number;
  a?: number;
  playerId?: string;
  playerName?: string;
  count?: number;
}) {
  const playerId = data.playerId?.trim() || "demo-user";
  const playerName = data.playerName?.trim() || playerId;
  const count = Math.max(1, Math.min(50, Number(data.count) || 1));
  const remainingAfterFirst = await consumeCharge(playerId, data.npcId);
  const queued = await executeQueueNpcSpawn({ ...data, serviceId: nitradoServiceId(data.serviceId || data.serverId) });
  emitHubEvent({
    type: "npc.spawn",
    playerId,
    playerName,
    serverId: "101",
    ts: Date.now(),
    meta: { npcId: data.npcId, x: data.x, z: data.z, wave: count, live: queued.live },
  });
  const extra = count - 1;
  if (extra > 0) {
    const waves = await readJsonFile<{ waves: Wave[] }>("npc-waves.json", { waves: [] });
    waves.waves = waves.waves.filter((w) => !(w.playerId === playerId && w.npcId === data.npcId));
    waves.waves.push({
      id: `${playerId}-${data.npcId}-${Date.now()}`,
      playerId,
      playerName,
      npcId: data.npcId,
      npcName: data.npcName || data.npcId,
      serviceId: nitradoServiceId(data.serviceId || data.serverId),
      x: data.x,
      z: data.z,
      remaining: Math.min(extra, remainingAfterFirst),
      lastSpawnAt: Date.now(),
      nextAt: Date.now() + 30_000,
    });
    await writeJsonFile("npc-waves.json", waves);
  }
  return {
    mode: queued.live ? ("live" as const) : ("restart_required" as const),
    reason: queued.live
      ? "Live spawn command written. NPC should appear within a few seconds if LiveSpawner is on the box."
      : extra > 0
        ? `Queued 1 now. ${extra} more on a 30s timer after restart.`
        : queued.eventName,
    eventName: queued.eventName,
    restockSeconds: queued.restockSeconds,
    restarted: queued.restarted,
    remaining: remainingAfterFirst,
    waveLeft: extra,
    adapter: queued.live ? "livespawner" : "ce-xml",
    entity: queued.entity,
  };
}

export async function tickNpcWaves() {
  const waves = await readJsonFile<{ waves: Wave[] }>("npc-waves.json", { waves: [] });
  const now = Date.now();
  const keep: Wave[] = [];
  const done: Wave[] = [];
  for (const wave of waves.waves) {
    if (wave.remaining <= 0) {
      done.push(wave);
      continue;
    }
    if (now < wave.nextAt) {
      keep.push(wave);
      continue;
    }
    try {
      await consumeCharge(wave.playerId, wave.npcId);
      await executeQueueNpcSpawn({
        serviceId: wave.serviceId,
        npcId: wave.npcId,
        x: wave.x,
        z: wave.z,
      });
      wave.remaining -= 1;
      wave.lastSpawnAt = now;
      wave.nextAt = now + 30_000;
      if (wave.remaining > 0) keep.push(wave);
      else done.push(wave);
    } catch {
      keep.push(wave);
    }
  }
  await writeJsonFile("npc-waves.json", { waves: keep });
  for (const wave of done) {
    const text = `${wave.npcName} wave finished. All requested spawns were used.`;
    await dmOwner(wave.playerId, `DAYZ PRO\n${text}`);
    emitHubEvent({
      type: "npc.wave_done",
      playerId: wave.playerId,
      playerName: wave.playerName,
      serverId: "101",
      ts: Date.now(),
      meta: { npcId: wave.npcId, npcName: wave.npcName },
    });
  }
  return { active: keep.length, finished: done.length };
}
