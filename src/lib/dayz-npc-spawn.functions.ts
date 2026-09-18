import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getNpcSpawnPreset } from "@/lib/npc-presets";
import { buildEventXmlNode, buildSpawnPosXmlNode, upsertEventBlock } from "@/lib/dayz-event-xml";
import { downloadNitradoFile, uploadNitradoFile } from "@/lib/nitrado-files.functions";
import { DAYZ_SERVERS, resolveMissionPath, type DayZServerId } from "@/lib/dayz/servers";

/** CE mission-relative paths (Chernarus / Livonia / Enoch layout). */
const EVENTS_FILE = "db/events.xml";
const TYPES_FILE = "db/types.xml";
/** cfgspawnabletypes.xml lives at the mission root — NOT under db/. */
const SPAWNS_FILE = "cfgeventspawns.xml";
const SPAWNABLE_TYPES_FILE = "cfgspawnabletypes.xml";

/** Gear kit for The Beamer shop NPC — type name MUST match the CE survivor classname. */
const THE_BEAMER_CFG_SPAWNABLETYPES = `<type name="SurvivorM_Boris">
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

/** cfgspawnabletypes.xml root is <spawnabletypes>, not <types>. */
function upsertSpawnableType(xmlText: string, classname: string, typeBlock: string) {
  const existing = new RegExp(`[ \\t]*<type name="${classname}">[\\s\\S]*?</type>\\s*`, "m");
  if (existing.test(xmlText)) return xmlText.replace(existing, `${typeBlock}\n`);
  if (!xmlText.includes("</spawnabletypes>")) {
    throw new Error("Could not find </spawnabletypes> in cfgspawnabletypes.xml");
  }
  return xmlText.replace("</spawnabletypes>", `${typeBlock}\n</spawnabletypes>`);
}

function upsertTypesEntry(xmlText: string, classname: string) {
  if (xmlText.includes(`name="${classname}"`)) return xmlText;
  const block = SURVIVOR_TYPES_ENTRY(classname);
  if (!xmlText.includes("</types>")) throw new Error("Could not find </types> in db/types.xml");
  return xmlText.replace("</types>", `${block}\n</types>`);
}

export type QueueNpcSpawnResult = {
  eventName: string;
  restockSeconds: number;
  /** False when the event was already loaded unchanged — CE handles it, no restart needed. */
  needsRestartToApply: boolean;
};

function resolveServerId(input?: string): DayZServerId {
  const raw = (input || "").trim().toLowerCase();
  if (raw === "102" || raw === "102x") return "102x";
  return "101x";
}

/**
 * Writes an NPC spawn event into events.xml + cfgeventspawns.xml +
 * cfgspawnabletypes.xml (+ types.xml) on the Nitrado server.
 * Event names MUST start with Item/Infected/Static/… or CE ignores them.
 */
export const queueNpcSpawn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      serviceId: string;
      serverId?: DayZServerId | string;
      npcId: string;
      x: number;
      z: number;
      a: number;
    }) => d,
  )
  .handler(async ({ data }): Promise<QueueNpcSpawnResult> => {
    const preset = getNpcSpawnPreset(data.npcId);
    const serverId = resolveServerId(data.serverId);
    const server = DAYZ_SERVERS.find((s) => s.id === serverId) ?? DAYZ_SERVERS[0];
    const missionPath = resolveMissionPath(server);
    // CE requires a known event-name prefix (Item*, Infected*, Static*, …).
    const eventName = `ItemAsylum_${data.npcId}_${Math.round(data.x)}_${Math.round(data.z)}`;
    const params = {
      eventName,
      classname: preset.classname,
      lifetime: preset.lifetime,
      restock: preset.restock,
      x: data.x,
      z: data.z,
      a: data.a,
    };

    const [eventsXml, spawnsXml, spawnableTypesXml, typesXml] = await Promise.all([
      downloadNitradoFile(data.serviceId, EVENTS_FILE, missionPath),
      downloadNitradoFile(data.serviceId, SPAWNS_FILE, missionPath),
      downloadNitradoFile(data.serviceId, SPAWNABLE_TYPES_FILE, missionPath),
      downloadNitradoFile(data.serviceId, TYPES_FILE, missionPath),
    ]);

    const nextEventsXml = upsertEventBlock(eventsXml, eventName, buildEventXmlNode(params), "events");
    const nextSpawnsXml = upsertEventBlock(spawnsXml, eventName, buildSpawnPosXmlNode(params), "eventposdef");
    const nextSpawnableTypesXml =
      data.npcId === "the_beamer"
        ? upsertSpawnableType(spawnableTypesXml, preset.classname, THE_BEAMER_CFG_SPAWNABLETYPES)
        : spawnableTypesXml;
    const nextTypesXml = upsertTypesEntry(typesXml, preset.classname);

    const unchanged =
      nextEventsXml === eventsXml &&
      nextSpawnsXml === spawnsXml &&
      nextSpawnableTypesXml === spawnableTypesXml &&
      nextTypesXml === typesXml;

    if (unchanged) {
      return { eventName, restockSeconds: preset.restock, needsRestartToApply: false };
    }

    await Promise.all([
      uploadNitradoFile(data.serviceId, EVENTS_FILE, nextEventsXml, missionPath),
      uploadNitradoFile(data.serviceId, SPAWNS_FILE, nextSpawnsXml, missionPath),
      uploadNitradoFile(data.serviceId, SPAWNABLE_TYPES_FILE, nextSpawnableTypesXml, missionPath),
      uploadNitradoFile(data.serviceId, TYPES_FILE, nextTypesXml, missionPath),
    ]);

    return { eventName, restockSeconds: preset.restock, needsRestartToApply: true };
  });
