import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getNpcSpawnPreset } from "@/lib/npc-presets";
import { buildEventXmlNode, buildSpawnPosXmlNode, upsertEventBlock } from "@/lib/dayz-event-xml";
import { downloadNitradoFile, uploadNitradoFile } from "@/lib/nitrado-files.functions";
import { DAYZ_SERVERS, resolveMissionPath, type DayZServerId } from "@/lib/dayz/servers";

const EVENTS_FILE = "db/events.xml";
const SPAWNS_FILE = "cfgeventspawns.xml";
const SPAWNABLE_TYPES_FILE = "db/cfgspawnabletypes.xml";

const THE_BEAMER_CFG_SPAWNABLETYPES = `<type name="TheBeamer">
  <attachments><item name="HandcuffsLocked"/></attachments>
  <attachments><item name="M14"><attachments><item name="Mag_DMR_20Rnd"/><item name="MK4Optic_Green"/><item name="ImprovisedSuppressor"/></attachments></item></attachments>
  <attachments><item name="M4A1_Green"><attachments><item name="Mag_STANAG_60Rnd"/><item name="BarakaOptic"/><item name="M4_Suppressor"/><item name="M4_CQBBttstck_Green"/><item name="M4_PlasticHndgrd_Green"/></attachments></item></attachments>
  <attachments><item name="Mich2001Helmet"><attachments><item name="NVGHeadstrap"/><item name="Battery9V"/></attachments></item></attachments>
  <attachments><item name="HockeyMask"/></attachments>
  <attachments><item name="PlateCarrierVest_Green"><attachments><item name="PlateCarrierPouches_Green"><cargo><item name="Mag_STANAG_60Rnd"/><item name="Mag_STANAG_60Rnd"/><item name="ImprovisedSuppressor"/></cargo></item><item name="RGD5Grenade"/><item name="RGD5Grenade"/><item name="M84Flashbang"/><item name="M84Flashbang"/></attachments></item></attachments>
  <attachments><item name="TShirt_White"/></attachments>
  <attachments><item name="WoolGlovesFingerless_ColorBase"/></attachments>
  <attachments><item name="GorkaPants_Autumn"><cargo><item name="Box_308WINTR_20rnd"/><item name="Box_308WINTR_20rnd"/><item name="Mag_STANAG_60Rnd"/><item name="Mag_STANAG_60Rnd"/><item name="SewingKit"/><item name="Mag_STANAG_60Rnd"/><item name="SewingKit"/><item name="Box_556x45Tracer_20rnd"/><item name="Box_556x45Tracer_20rnd"/><item name="Bandage"/></cargo></item></attachments>
  <attachments><item name="CanvasShoes_Red"/></attachments>
  <attachments><item name="HipPack_Medical"><attachments><item name="Canteen" quantityMin="1.0" quantityMax="1.0"/><cargo><item name="CodeinePills"/><item name="TetracyclinePills"/><item name="Morphine"/></cargo></attachments></item></attachments>
  <attachments><item name="AssaultBag_Green"><attachments><item name="FieldShovel"/><item name="XmasLights_Red"/><item name="Rangefinder"><attachments><item name="Battery9V"/></attachments></item></attachments><cargo><item name="WaterBottle" quantityMin="1.0" quantityMax="1.0"/><item name="PeachesCan"/><item name="PeachesCan"/><item name="LandMine"/><item name="LandMine"/><item name="CombatKnife"/><item name="Bandage"/><item name="WeaponCleaningKit"/></cargo></item></attachments>
</type>`;

function upsertSpawnableType(xmlText: string, classname: string, typeBlock: string) {
  const existing = new RegExp(`[ \\t]*<type name="${classname}">[\\s\\S]*?</type>\\s*`, "m");
  if (existing.test(xmlText)) return xmlText.replace(existing, `${typeBlock}\n`);
  if (!xmlText.includes("</types>")) throw new Error("Could not find </types> in cfgspawnabletypes.xml");
  return xmlText.replace("</types>", `${typeBlock}\n</types>`);
}

export type QueueNpcSpawnResult = {
  eventName: string;
  restockSeconds: number;
  /** False when the event was already loaded unchanged — CE handles it, no restart needed. */
  needsRestartToApply: boolean;
};

/**
 * Writes an NPC spawn event into events.xml + cfgeventspawns.xml on the
 * Nitrado server. The event name is deterministic per (npcId, position), so
 * re-"buying"/re-spawning the same NPC at the same spot reuses the existing
 * CE event instead of appending a duplicate — if nothing actually changed on
 * disk, no restart is triggered and, when `restock` > 0, CE keeps respawning
 * it on its own indefinitely (roadmap "Solution A"). A restart is only ever
 * needed the first time an event is created or moved, because console
 * builds don't expose a live `DynamicEventSpawn()` trigger.
 */
export const queueNpcSpawn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { serviceId: string; serverId: DayZServerId; npcId: string; x: number; z: number; a: number }) => d)
  .handler(async ({ data }): Promise<QueueNpcSpawnResult> => {
    const preset = getNpcSpawnPreset(data.npcId);
    const server = DAYZ_SERVERS.find((s) => s.id === data.serverId) ?? DAYZ_SERVERS[0];
    const missionPath = resolveMissionPath(server);
    const eventName = `Asylum_${data.npcId}_${Math.round(data.x)}_${Math.round(data.z)}`;
    const params = { eventName, classname: preset.classname, lifetime: preset.lifetime, restock: preset.restock, x: data.x, z: data.z, a: data.a };

    const [eventsXml, spawnsXml, spawnableTypesXml] = await Promise.all([
      downloadNitradoFile(data.serviceId, EVENTS_FILE, missionPath),
      downloadNitradoFile(data.serviceId, SPAWNS_FILE, missionPath),
      downloadNitradoFile(data.serviceId, SPAWNABLE_TYPES_FILE, missionPath),
    ]);

    const nextEventsXml = upsertEventBlock(eventsXml, eventName, buildEventXmlNode(params), "events");
    const nextSpawnsXml = upsertEventBlock(spawnsXml, eventName, buildSpawnPosXmlNode(params), "eventposdef");
    const nextSpawnableTypesXml = preset.classname === "TheBeamer"
      ? upsertSpawnableType(spawnableTypesXml, preset.classname, THE_BEAMER_CFG_SPAWNABLETYPES)
      : spawnableTypesXml;
    const unchanged = nextEventsXml === eventsXml && nextSpawnsXml === spawnsXml && nextSpawnableTypesXml === spawnableTypesXml;

    if (unchanged) {
      return { eventName, restockSeconds: preset.restock, needsRestartToApply: false };
    }

    await Promise.all([
      uploadNitradoFile(data.serviceId, EVENTS_FILE, nextEventsXml, missionPath),
      uploadNitradoFile(data.serviceId, SPAWNS_FILE, nextSpawnsXml, missionPath),
      uploadNitradoFile(data.serviceId, SPAWNABLE_TYPES_FILE, nextSpawnableTypesXml, missionPath),
    ]);

    return { eventName, restockSeconds: preset.restock, needsRestartToApply: true };
  });
