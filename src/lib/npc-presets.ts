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

export const NPC_SPAWN_PRESETS: Record<string, NpcSpawnPreset> = {
  // TheBeamer is a shop skin/kit name only — CE must use a real SurvivorM_* type.
  the_beamer: { id: "the_beamer", classname: "SurvivorM_Boris", lifetime: 2500, restock: 300 },
};

export function getNpcSpawnPreset(id: string): NpcSpawnPreset {
  const preset = NPC_SPAWN_PRESETS[id];
  if (!preset) throw new Error(`No spawn preset configured for NPC "${id}"`);
  return preset;
}
