export type NpcSpawnPreset = {
  id: string;
  classname: string;
  lifetime: number;
  restock: number;
};

export const NPC_SPAWN_PRESETS: Record<string, NpcSpawnPreset> = {
  the_beamer: { id: "the_beamer", classname: "SurvivorM_Boris", lifetime: 2500, restock: 300 },
  skull_hunter: { id: "skull_hunter", classname: "SurvivorM_Denis", lifetime: 2500, restock: 300 },
};

export function getNpcSpawnPreset(id: string): NpcSpawnPreset {
  const preset = NPC_SPAWN_PRESETS[id];
  if (!preset) throw new Error(`No spawn preset configured for NPC "${id}"`);
  return preset;
}
