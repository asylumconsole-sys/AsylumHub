/** Shared DayZ map-tile config, matching the Chernarus/Livonia satellite maps used by /tools/base-map-clicker. */
export const DAYZ_MAP_TILE_SIZE = 256;

export const DAYZ_MAPS = {
  livonia: {
    label: "Livonia",
    worldSize: 12800,
    serverId: "101x",
    tileUrl: "https://static.xam.nu/dayz/maps/livonia/1.27/satellite/{z}/{x}/{y}.webp",
  },
} as const;

export type DayZMapId = keyof typeof DAYZ_MAPS;

export function mapIdForServer(serverId: string): DayZMapId {
  return "livonia";
}

/** Game x/z -> Leaflet [lat, lng] in CRS.Simple space (matches base-map-clicker.tsx). */
export function gameToMapPosition(x: number, z: number, worldSize: number): [number, number] {
  return [(z / worldSize) * DAYZ_MAP_TILE_SIZE - DAYZ_MAP_TILE_SIZE, (x / worldSize) * DAYZ_MAP_TILE_SIZE];
}

/** Leaflet lat/lng in CRS.Simple space -> game x/z (inverse of gameToMapPosition). */
export function mapPositionToGame(lat: number, lng: number, worldSize: number): { x: number; z: number } {
  const x = Math.round((lng / DAYZ_MAP_TILE_SIZE) * worldSize);
  const z = Math.round(((lat + DAYZ_MAP_TILE_SIZE) / DAYZ_MAP_TILE_SIZE) * worldSize);
  return {
    x: Math.min(worldSize, Math.max(0, x)),
    z: Math.min(worldSize, Math.max(0, z)),
  };
}

/** Convert a real-world radius in game meters to CRS.Simple map units for L.Circle. */
export function metersToMapUnits(meters: number, worldSize: number): number {
  return (meters / worldSize) * DAYZ_MAP_TILE_SIZE;
}

export const DAYZ_MAP_CENTER: [number, number] = [-DAYZ_MAP_TILE_SIZE / 2, DAYZ_MAP_TILE_SIZE / 2];
export const DAYZ_MAP_BOUNDS_LATLNG: [[number, number], [number, number]] = [
  [-DAYZ_MAP_TILE_SIZE, 0],
  [0, DAYZ_MAP_TILE_SIZE],
];

/** Zone-kind accent colors, kept out of any leaflet-touching file so routes can import them safely for SSR. */
export const UAV_KIND_COLORS: Record<"standard" | "advanced" | "counter", string> = {
  standard: "#c084fc",
  advanced: "#f59e0b",
  counter: "#f87171",
};
