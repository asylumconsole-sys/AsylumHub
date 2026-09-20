export type NpcSpawnPreset = {
  id: string;
  classname: string;
  lifetime: number;
  restock: number;
};

export const NPC_SPAWN_PRESETS: Record<string, NpcSpawnPreset> = {
  the_beamer: { id: "the_beamer", classname: "SurvivorM_Boris", lifetime: 2500, restock: 300 },
  skull_hunter: { id: "skull_hunter", classname: "SurvivorM_Denis", lifetime: 2500, restock: 300 },
  death_bloomz: { id: "death_bloomz", classname: "SurvivorM_Cyril", lifetime: 2500, restock: 300 },
  raid_1: { id: "raid_1", classname: "SurvivorM_Elias", lifetime: 2500, restock: 300 },
  raid_2: { id: "raid_2", classname: "SurvivorM_Boris", lifetime: 2500, restock: 300 },
  builder_1: { id: "builder_1", classname: "SurvivorM_Denis", lifetime: 2500, restock: 300 },
  desert_ops: { id: "desert_ops", classname: "SurvivorM_Cyril", lifetime: 2500, restock: 300 },
  contractor: { id: "contractor", classname: "SurvivorM_Elias", lifetime: 2500, restock: 300 },
  bush_walker: { id: "bush_walker", classname: "SurvivorM_Boris", lifetime: 2500, restock: 300 },
};

export function getNpcSpawnPreset(id: string): NpcSpawnPreset {
  const preset = NPC_SPAWN_PRESETS[id];
  if (!preset) throw new Error(`No spawn preset configured for NPC "${id}"`);
  return preset;
}
