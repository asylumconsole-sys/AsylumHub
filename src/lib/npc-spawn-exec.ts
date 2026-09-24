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
const NITRADO_API_BASE = "https://api.nitrado.net";

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
  return DAYZ_SERVERS.find((s) => raw.includes("102") ? s.id === "102x" : s.id === "101x") ?? DAYZ_SERVERS[0];
}

function nitradoServiceId(hint?: string) {
  if (hint && /^\d+$/.test(String(hint).trim())) return String(hint).trim();
  return resolveServiceId(serverFor(hint));
}

const SURVIVOR_TYPES_ENTRY = (classname: string) => `  <type name="${classname}">
    <nominal>0</nominal>
    <lifetime>1800</lifetime>
    <restock>0</restock>
    <min>0</min>
    <quantmin>-1</quantmin>
    <quantmax>-1</quantmax>
    <cost>100</cost>
    <flags count_in_cargo="0" count_in_hoarder="0" count_in_map="1" count_in_player="0" crafted="0" deloot="0"/>
    <category name="weapons"/>
  </type>`;

function upsertTypesEntry(xmlText: string, classname: string) {
  if (xmlText.includes(`name="${classname}"`)) return xmlText;
  if (!xmlText.includes("</types>")) throw new Error("Could not find </types> in db/types.xml");
  return xmlText.replace("</types>", `${SURVIVOR_TYPES_ENTRY(classname)}\n</types>`);
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

async function bounceServer(serviceId: string) {
  const token = process.env.NITRADO_API_TOKEN;
  if (!token) return false;
  const headers = { Authorization: `Bearer ${token}` };
  await fetch(`${NITRADO_API_BASE}/services/${serviceId}/gameservers/stop`, { method: "POST", headers }).catch(() => null);
  await new Promise((r) => setTimeout(r, 8000));
  const res = await fetch(`${NITRADO_API_BASE}/services/${serviceId}/gameservers/restart`, {
    method: "POST",
    headers,
  });
  return res.ok;
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
  const params = {
    eventName,
    classname: preset.classname,
    lifetime: Math.max(preset.lifetime, 1800),
    restock: 0,
    x: Math.round(data.x),
    z: Math.round(data.z),
    a: data.a || 0,
  };

  const [eventsXml, spawnsXml, typesXml] = await Promise.all([
    downloadNitradoFile(serviceId, EVENTS_FILE, missionPath),
    downloadNitradoFile(serviceId, SPAWNS_FILE, missionPath),
    downloadNitradoFile(serviceId, TYPES_FILE, missionPath),
  ]);
  let spawnableTypesXml = "";
  try {
    spawnableTypesXml = await downloadNitradoFile(serviceId, SPAWNABLE_TYPES_FILE, missionPath);
  } catch {
    spawnableTypesXml = "";
  }

  const nextEventsXml = upsertEventBlock(eventsXml, eventName, buildEventXmlNode(params), "events");
  const nextSpawnsXml = upsertEventBlock(spawnsXml, eventName, buildSpawnPosXmlNode(params), "eventposdef");
  const nextTypesXml = upsertTypesEntry(typesXml, preset.classname);

  await Promise.all([
    uploadNitradoFile(serviceId, EVENTS_FILE, nextEventsXml, missionPath),
    uploadNitradoFile(serviceId, SPAWNS_FILE, nextSpawnsXml, missionPath),
    uploadNitradoFile(serviceId, TYPES_FILE, nextTypesXml, missionPath),
    spawnableTypesXml
      ? uploadNitradoFile(serviceId, SPAWNABLE_TYPES_FILE, spawnableTypesXml, missionPath)
      : Promise.resolve(),
  ]);

  const restarted = await bounceServer(serviceId);
  return { eventName, restockSeconds: 0, restarted, entity: preset.classname, live: false };
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
  const serviceId = nitradoServiceId(data.serviceId || data.serverId);
  const queued = await executeQueueNpcSpawn({ ...data, serviceId });
  emitHubEvent({
    type: "npc.spawn",
    playerId,
    playerName,
    serverId: "101",
    ts: Date.now(),
    meta: { npcId: data.npcId, x: data.x, z: data.z, wave: count, eventName: queued.eventName },
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
      serviceId,
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
    reason: queued.restarted
      ? "NPC queued. 101x is bouncing now — dummy appears after boot (Item event)."
      : "NPC written to events.xml. Bounce 101x if it does not appear after CE.",
    eventName: queued.eventName,
    restockSeconds: 0,
    restarted: queued.restarted,
    remaining: remainingAfterFirst,
    waveLeft: extra,
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
    await dmOwner(wave.playerId, `DAYZ PRO\n${wave.npcName} wave finished.`);
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
