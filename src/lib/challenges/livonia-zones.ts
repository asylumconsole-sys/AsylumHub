export type LivoniaZone = {
  id: string;
  name: string;
  x: number;
  z: number;
  radius: number;
};

/** 101x Livonia — city centers, ~450m discovery radius. */
export const LIVONIA_ZONES: LivoniaZone[] = [
  { id: "topolin", name: "Topolin", x: 1160, z: 9960, radius: 450 },
  { id: "bielawa", name: "Bielawa", x: 1620, z: 7360, radius: 450 },
  { id: "zalesie", name: "Zalesie", x: 870, z: 5420, radius: 450 },
  { id: "gliniska", name: "Gliniska", x: 2470, z: 2130, radius: 450 },
  { id: "radacz", name: "Radacz", x: 3930, z: 4000, radius: 450 },
  { id: "nadbor", name: "Nadbor", x: 6100, z: 5020, radius: 500 },
  { id: "grabin", name: "Grabin", x: 10750, z: 4360, radius: 450 },
  { id: "tarnow", name: "Tarnow", x: 8280, z: 2100, radius: 450 },
  { id: "sitnik", name: "Sitnik", x: 11450, z: 9520, radius: 450 },
  { id: "brena", name: "Brena", x: 9260, z: 11040, radius: 450 },
  { id: "lukow", name: "Lukow", x: 3580, z: 11880, radius: 450 },
  { id: "kopa", name: "Kopa", x: 4010, z: 7930, radius: 400 },
];

export const ZONE_REWARD = 2500;

export function inZone(px: number, pz: number, zone: LivoniaZone) {
  const dx = px - zone.x;
  const dz = pz - zone.z;
  return dx * dx + dz * dz <= zone.radius * zone.radius;
}
