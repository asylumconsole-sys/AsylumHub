export type SpawnPack = {
  id: string;
  label: string;
  price: number;
  spawns: number;
  blurb: string;
};

/** Consumable packs — buy again when charges run out. */
export const SPAWN_PACKS: SpawnPack[] = [
  { id: "pack_15", label: "Operator", price: 2500, spawns: 15, blurb: "15 deploys" },
  { id: "pack_30", label: "Strike", price: 5000, spawns: 30, blurb: "30 deploys" },
  { id: "pack_50", label: "Battalion", price: 7500, spawns: 50, blurb: "50 deploys" },
];
