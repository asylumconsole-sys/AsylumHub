export type SpawnPack = {
  id: string;
  label: string;
  price: number;
  spawns: number;
  blurb: string;
};

/** Consumable packs — buy again when charges run out. */
export const SPAWN_PACKS: SpawnPack[] = [
  { id: "pack_8", label: "Recon", price: 1000, spawns: 8, blurb: "8 deploys" },
  { id: "pack_25", label: "Operator", price: 2500, spawns: 25, blurb: "25 deploys · sweet spot" },
  { id: "pack_60", label: "Strike", price: 5000, spawns: 60, blurb: "60 deploys" },
  { id: "pack_150", label: "Battalion", price: 10000, spawns: 150, blurb: "150 deploys" },
];
