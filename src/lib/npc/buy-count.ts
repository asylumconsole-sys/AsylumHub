export const CR_PER_SPAWN = 2500 / 15;

export function priceForSpawnCount(count: number) {
  const n = Math.max(1, Math.min(200, Math.floor(Number(count) || 1)));
  return { count: n, price: Math.max(1, Math.ceil(n * CR_PER_SPAWN)) };
}
