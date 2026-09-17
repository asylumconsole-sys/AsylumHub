export type DayZMapPoint = [number, number];

export type DayZRoadGrid = {
  size: number;
  roads: Uint8Array;
};

export type DayZRouteResult = {
  path: DayZMapPoint[];
  snappedStart: DayZMapPoint;
  snappedEnd: DayZMapPoint;
  distanceMeters: number;
  roadCoverage: number;
};

const MAP_EXTENT = 256;
const GRID_SIZE = 1024;
const TILE_ZOOM = 3;
const TILE_COUNT = 2 ** TILE_ZOOM;
const CELL_SIZE = GRID_SIZE / TILE_COUNT;
const gridCache = new Map<string, Promise<DayZRoadGrid>>();

function tileUrl(template: string, x: number, y: number) {
  return template
    .replace("{z}", String(TILE_ZOOM))
    .replace("{x}", String(x))
    .replace("{y}", String(y));
}

function looksLikeRoad(red: number, green: number, blue: number) {
  const lightness = (red + green + blue) / 3;
  const yellowRoad = red > 130 && green > 92 && blue < 125 && red - blue > 38 && green - blue > 18;
  const brownRoad = red > green * 1.03 && green >= blue * 0.9 && red - blue > 18 && lightness < 145;
  const darkRoad = lightness < 86 && red >= blue && green >= blue * 0.85;
  return yellowRoad || brownRoad || darkRoad;
}

function dilateRoads(source: Uint8Array, size: number) {
  const result = source.slice();
  for (let y = 1; y < size - 1; y += 1) {
    for (let x = 1; x < size - 1; x += 1) {
      const index = y * size + x;
      if (!source[index]) continue;
      result[index - 1] = 1;
      result[index + 1] = 1;
      result[index - size] = 1;
      result[index + size] = 1;
    }
  }
  return result;
}

async function buildRoadGrid(template: string, onProgress?: (progress: number) => void): Promise<DayZRoadGrid> {
  const canvas = document.createElement("canvas");
  canvas.width = GRID_SIZE;
  canvas.height = GRID_SIZE;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Road routing canvas is unavailable.");

  let completed = 0;
  const jobs: Promise<void>[] = [];
  for (let y = 0; y < TILE_COUNT; y += 1) {
    for (let x = 0; x < TILE_COUNT; x += 1) {
      jobs.push((async () => {
        const response = await fetch(tileUrl(template, x, y));
        if (!response.ok) throw new Error(`Road tile unavailable (${response.status}).`);
        const bitmap = await createImageBitmap(await response.blob());
        context.drawImage(bitmap, x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        bitmap.close();
        completed += 1;
        onProgress?.(completed / (TILE_COUNT * TILE_COUNT));
      })());
    }
  }
  await Promise.all(jobs);

  const pixels = context.getImageData(0, 0, GRID_SIZE, GRID_SIZE).data;
  const roads = new Uint8Array(GRID_SIZE * GRID_SIZE);
  for (let index = 0; index < roads.length; index += 1) {
    const pixel = index * 4;
    roads[index] = looksLikeRoad(pixels[pixel], pixels[pixel + 1], pixels[pixel + 2]) ? 1 : 0;
  }
  return { size: GRID_SIZE, roads: dilateRoads(roads, GRID_SIZE) };
}

export function loadDayZRoadGrid(template: string, onProgress?: (progress: number) => void) {
  const cached = gridCache.get(template);
  if (cached) return cached;
  const promise = buildRoadGrid(template, onProgress).catch((error) => {
    gridCache.delete(template);
    throw error;
  });
  gridCache.set(template, promise);
  return promise;
}

function pointToGrid(point: DayZMapPoint, size: number) {
  return {
    x: Math.max(0, Math.min(size - 1, Math.round((point[1] / MAP_EXTENT) * (size - 1)))),
    y: Math.max(0, Math.min(size - 1, Math.round((-point[0] / MAP_EXTENT) * (size - 1)))),
  };
}

function gridToPoint(x: number, y: number, size: number): DayZMapPoint {
  return [-(y / (size - 1)) * MAP_EXTENT, (x / (size - 1)) * MAP_EXTENT];
}

function snapToRoad(point: DayZMapPoint, grid: DayZRoadGrid) {
  const origin = pointToGrid(point, grid.size);
  if (grid.roads[origin.y * grid.size + origin.x]) return origin;
  const maxRadius = Math.round(grid.size * 0.065);
  for (let radius = 1; radius <= maxRadius; radius += 1) {
    let best: { x: number; y: number; distance: number } | null = null;
    for (let offset = -radius; offset <= radius; offset += 1) {
      const candidates = [
        { x: origin.x + offset, y: origin.y - radius },
        { x: origin.x + offset, y: origin.y + radius },
        { x: origin.x - radius, y: origin.y + offset },
        { x: origin.x + radius, y: origin.y + offset },
      ];
      for (const candidate of candidates) {
        if (candidate.x < 0 || candidate.y < 0 || candidate.x >= grid.size || candidate.y >= grid.size) continue;
        if (!grid.roads[candidate.y * grid.size + candidate.x]) continue;
        const distance = Math.hypot(candidate.x - origin.x, candidate.y - origin.y);
        if (!best || distance < best.distance) best = { ...candidate, distance };
      }
    }
    if (best) return { x: best.x, y: best.y };
  }
  throw new Error("No mapped road was found near one of the selected points.");
}

type HeapNode = { index: number; score: number };

class MinHeap {
  private nodes: HeapNode[] = [];

  get length() {
    return this.nodes.length;
  }

  push(node: HeapNode) {
    this.nodes.push(node);
    let index = this.nodes.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.nodes[parent].score <= node.score) break;
      this.nodes[index] = this.nodes[parent];
      index = parent;
    }
    this.nodes[index] = node;
  }

  pop() {
    const first = this.nodes[0];
    const last = this.nodes.pop();
    if (!last || this.nodes.length === 0) return first;
    let index = 0;
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      if (left >= this.nodes.length) break;
      const child = right < this.nodes.length && this.nodes[right].score < this.nodes[left].score ? right : left;
      if (this.nodes[child].score >= last.score) break;
      this.nodes[index] = this.nodes[child];
      index = child;
    }
    this.nodes[index] = last;
    return first;
  }
}

function simplifyPath(path: Array<{ x: number; y: number }>) {
  if (path.length < 3) return path;
  const result = [path[0]];
  let previousDirection = "";
  for (let index = 1; index < path.length; index += 1) {
    const direction = `${Math.sign(path[index].x - path[index - 1].x)},${Math.sign(path[index].y - path[index - 1].y)}`;
    if (index > 1 && direction !== previousDirection) result.push(path[index - 1]);
    previousDirection = direction;
  }
  result.push(path[path.length - 1]);
  return result;
}

export function buildDayZRoadRoute(
  grid: DayZRoadGrid,
  start: DayZMapPoint,
  end: DayZMapPoint,
  worldSize: number,
): DayZRouteResult {
  const snappedStart = snapToRoad(start, grid);
  const snappedEnd = snapToRoad(end, grid);
  const startIndex = snappedStart.y * grid.size + snappedStart.x;
  const endIndex = snappedEnd.y * grid.size + snappedEnd.x;
  const scores = new Float32Array(grid.roads.length);
  scores.fill(Number.POSITIVE_INFINITY);
  scores[startIndex] = 0;
  const previous = new Int32Array(grid.roads.length);
  previous.fill(-1);
  const closed = new Uint8Array(grid.roads.length);
  const open = new MinHeap();
  open.push({ index: startIndex, score: 0 });
  const directions = [
    [-1, 0, 1], [1, 0, 1], [0, -1, 1], [0, 1, 1],
    [-1, -1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [1, 1, Math.SQRT2],
  ] as const;
  let iterations = 0;

  while (open.length && iterations < grid.roads.length * 2) {
    iterations += 1;
    const current = open.pop();
    if (!current || closed[current.index]) continue;
    if (current.index === endIndex) break;
    closed[current.index] = 1;
    const currentX = current.index % grid.size;
    const currentY = Math.floor(current.index / grid.size);
    for (const [deltaX, deltaY, step] of directions) {
      const nextX = currentX + deltaX;
      const nextY = currentY + deltaY;
      if (nextX < 0 || nextY < 0 || nextX >= grid.size || nextY >= grid.size) continue;
      const nextIndex = nextY * grid.size + nextX;
      if (closed[nextIndex]) continue;
      const terrainPenalty = grid.roads[nextIndex] ? 1 : 18;
      const nextScore = scores[current.index] + step * terrainPenalty;
      if (nextScore >= scores[nextIndex]) continue;
      scores[nextIndex] = nextScore;
      previous[nextIndex] = current.index;
      const heuristic = Math.hypot(snappedEnd.x - nextX, snappedEnd.y - nextY);
      open.push({ index: nextIndex, score: nextScore + heuristic });
    }
  }

  if (previous[endIndex] === -1 && startIndex !== endIndex) {
    throw new Error("A road route could not be calculated between those points.");
  }

  const cells: Array<{ x: number; y: number }> = [];
  let cursor = endIndex;
  let roadCells = 0;
  while (cursor !== -1) {
    const x = cursor % grid.size;
    const y = Math.floor(cursor / grid.size);
    cells.push({ x, y });
    if (grid.roads[cursor]) roadCells += 1;
    if (cursor === startIndex) break;
    cursor = previous[cursor];
  }
  cells.reverse();
  const simplified = simplifyPath(cells);
  const path = simplified.map((cell) => gridToPoint(cell.x, cell.y, grid.size));
  let distanceMeters = 0;
  for (let index = 1; index < cells.length; index += 1) {
    distanceMeters += Math.hypot(cells[index].x - cells[index - 1].x, cells[index].y - cells[index - 1].y) * (worldSize / grid.size);
  }

  return {
    path,
    snappedStart: gridToPoint(snappedStart.x, snappedStart.y, grid.size),
    snappedEnd: gridToPoint(snappedEnd.x, snappedEnd.y, grid.size),
    distanceMeters,
    roadCoverage: cells.length ? roadCells / cells.length : 1,
  };
}