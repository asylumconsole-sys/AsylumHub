import { getNpcSpawnPreset } from "@/lib/npc-presets";
import { buildEventXmlNode, buildSpawnPosXmlNode, upsertEventBlock } from "@/lib/dayz-event-xml";
import { downloadNitradoFile, uploadNitradoFile } from "@/lib/nitrado-files.functions";
import { DAYZ_SERVERS, resolveMissionPath } from "@/lib/dayz/servers";
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

export async function consumeCharge(playerId: string, npcId: string) {
  const inv = await readJsonFile<Inv>("npc-inventory.json", { charges: {} });
  if (!inv.charges[playerId]) inv.charges[playerId] = {};
  const left = inv.charges[playerId][npcId] ?? 0;
  if (left <= 0) throw new Error("No spawn charges left — buy a pack first");
  inv.charges[playerId][npcId] = left - 1;
  await writeJsonFile("npc-inventory.json", inv);
  return inv.charges[playerId][npcId];
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
  const serverId = String(data.serverId || data.serviceId || "101x").toLowerCase().includes("102") ? "102x" : "101x";
  const server = DAYZ_SERVERS.find((s) => s.id === serverId) ?? DAYZ_SERVERS[0];
  const missionPath = resolveMissionPath(server);
  const eventName = `ItemAsylum_${data.npcId}_${Math.round(data.x)}_${Math.round(data.z)}`;
  const params = {
    eventName,
    classname: preset.classname,
    lifetime: preset.lifetime,
    restock: preset.restock,
    x: data.x,
    z: data.z,
    a: data.a || 0,
  };
  const [eventsXml, spawnsXml, spawnableTypesXml, typesXml] = await Promise.all([
    downloadNitradoFile(data.serviceId, EVENTS_FILE, missionPath),
    downloadNitradoFile(data.serviceId, SPAWNS_FILE, missionPath),
    downloadNitradoFile(data.serviceId, SPAWNABLE_TYPES_FILE, missionPath),
    downloadNitradoFile(data.serviceId, TYPES_FILE, missionPath),
  ]);
  const nextEventsXml = upsertEventBlock(eventsXml, eventName, buildEventXmlNode(params), "events");
  const nextSpawnsXml = upsertEventBlock(spawnsXml, eventName, buildSpawnPosXmlNode(params), "eventposdef");
  const unchanged = nextEventsXml === eventsXml && nextSpawnsXml === spawnsXml;
  if (!unchanged) {
    await Promise.all([
      uploadNitradoFile(data.serviceId, EVENTS_FILE, nextEventsXml, missionPath),
      uploadNitradoFile(data.serviceId, SPAWNS_FILE, nextSpawnsXml, missionPath),
      uploadNitradoFile(data.serviceId, SPAWNABLE_TYPES_FILE, spawnableTypesXml, missionPath),
      uploadNitradoFile(data.serviceId, TYPES_FILE, typesXml, missionPath),
    ]);
    const token = process.env.NITRADO_API_TOKEN;
    if (token) {
      await fetch(`https://api.nitrado.net/services/${data.serviceId}/gameservers/restart`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => null);
    }
  }
  return { eventName, restockSeconds: preset.restock, restarted: !unchanged, entity: preset.classname };
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
  const queued = await executeQueueNpcSpawn(data);
  emitHubEvent({
    type: "npc.spawn",
    playerId,
    playerName,
    serverId: "101",
    ts: Date.now(),
    meta: { npcId: data.npcId, x: data.x, z: data.z, wave: count },
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
      serviceId: data.serviceId,
      x: data.x,
      z: data.z,
      remaining: Math.min(extra, remainingAfterFirst),
      lastSpawnAt: Date.now(),
      nextAt: Date.now() + 30_000,
    });
    await writeJsonFile("npc-waves.json", waves);
  }
  return {
    mode: "restart_required" as const,
    reason: extra > 0 ? `Spawned 1 now. ${extra} more will respawn 30s after each death/timer.` : queued.eventName,
    eventName: queued.eventName,
    restockSeconds: queued.restockSeconds,
    restarted: queued.restarted,
    remaining: remainingAfterFirst,
    waveLeft: extra,
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
    const text = `${wave.npcName} wave finished. All requested spawns were used.` ;
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
