/**
 * Maps AsylumHub NPC Shop presets to real DayZ Central Economy survivor
 * classnames, plus the event tuning used to generate events.xml /
 * cfgeventspawns.xml nodes. See roadmap Phase 6 + the console dynamic-event
 * research: only `Boris`, `Cyril`, `Denis`, `Elias` are confirmed usable
 * `SurvivorM_*` event children — every unverified kit reuses one of those
 * four until more classnames are verified against the live server.
 */

export type NpcSpawnPreset = {
  /** Matches the `id` in src/routes/_app/tools/npc-shop.tsx NPCS. */
  id: string;
  classname: string;
  /** Seconds the spawned NPC persists before CE removes it. */
  lifetime: number;
  /** Seconds after removal before CE restocks it — 0 disables auto-respawn. */
  restock: number;
};

const CONFIRMED_CLASSNAMES = ["SurvivorM_Boris", "SurvivorM_Cyril", "SurvivorM_Denis", "SurvivorM_Elias"] as const;

const ROLE_PRESET_IDS = [
  "scavenger", "medic", "mechanic", "hunter", "guard", "farmer", "radio",
  "quartermaster", "sniper", "engineer", "smuggler", "tracker", "pilot",
  "commander", "armorer", "recon", "bunker", "diplomat", "commando", "ai",
] as const;

/** Confirmed SurvivorM_* kits + labeled extras that map onto confirmed classnames. */
const SURVIVOR_PRESETS: NpcSpawnPreset[] = [
  { id: "survivor_boris", classname: "SurvivorM_Boris", lifetime: 2500, restock: 0 },
  { id: "survivor_cyril", classname: "SurvivorM_Cyril", lifetime: 2500, restock: 0 },
  { id: "survivor_denis", classname: "SurvivorM_Denis", lifetime: 2500, restock: 0 },
  { id: "survivor_elias", classname: "SurvivorM_Elias", lifetime: 2500, restock: 0 },
  // Female kits not confirmed as CE event children on console — map to confirmed males.
  { id: "survivor_recruit_f", classname: "SurvivorM_Boris", lifetime: 2500, restock: 0 },
  { id: "survivor_medic_f", classname: "SurvivorM_Cyril", lifetime: 2500, restock: 0 },
  { id: "survivor_scout_f", classname: "SurvivorM_Denis", lifetime: 2500, restock: 0 },
  { id: "survivor_guard_f", classname: "SurvivorM_Elias", lifetime: 2500, restock: 300 },
];

const rolePresets: Record<string, NpcSpawnPreset> = Object.fromEntries(
  ROLE_PRESET_IDS.map((id, i) => [
    id,
    {
      id,
      classname: CONFIRMED_CLASSNAMES[i % CONFIRMED_CLASSNAMES.length],
      lifetime: 2500,
      restock: id === "guard" || id === "bunker" || id === "sniper" || id === "commando" ? 300 : 0,
    },
  ]),
);

export const NPC_SPAWN_PRESETS: Record<string, NpcSpawnPreset> = {
  ...rolePresets,
  ...Object.fromEntries(SURVIVOR_PRESETS.map((p) => [p.id, p])),
  the_beamer: { id: "the_beamer", classname: "TheBeamer", lifetime: 2500, restock: 300 },
};

export function getNpcSpawnPreset(id: string): NpcSpawnPreset {
  const preset = NPC_SPAWN_PRESETS[id];
  if (!preset) throw new Error(`No spawn preset configured for NPC "${id}"`);
  return preset;
}
