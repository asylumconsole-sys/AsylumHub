import { readJsonFile, writeJsonFile } from "@/lib/dayz/store";
import { uploadNitradoFile } from "@/lib/nitrado-files.functions";
import { DAYZ_SERVERS, resolveMissionPath, resolveServiceId } from "@/lib/dayz/servers";

const FILE = "weather-schedule.json";
const RAIN_EVERY_MS = 3 * 60 * 60 * 1000;
const BURST_MS = 25 * 60 * 1000;

const RAIN_PATTERNS = [
  { id: "sheet", overcast: 0.92, rain: 0.95, storm: 0.9 },
  { id: "heavy", overcast: 0.85, rain: 0.8, storm: 0.55 },
  { id: "steady", overcast: 0.78, rain: 0.62, storm: 0.2 },
  { id: "drizzle", overcast: 0.7, rain: 0.4, storm: 0.05 },
  { id: "front", overcast: 0.88, rain: 0.7, storm: 0.75 },
] as const;

const NIGHT_PATTERNS = [
  { id: "black", overcast: 0.98, storm: 0.35 },
  { id: "late", overcast: 0.9, storm: 0.15 },
  { id: "predawn", overcast: 0.86, storm: 0.05 },
  { id: "midnight", overcast: 0.95, storm: 0.25 },
] as const;

type Schedule = {
  rainStart: number;
  rainEnd: number;
  nightStart: number;
  nightEnd: number;
  lastRainId?: string;
  lastNightId?: string;
  usedRain: string[];
  usedNight: string[];
};

function pick<T extends { id: string }>(pool: readonly T[], used: string[], last?: string) {
  let available = pool.filter((p) => !used.includes(p.id) && p.id !== last);
  if (!available.length) {
    used.length = 0;
    available = pool.filter((p) => p.id !== last);
  }
  const scored = available.map((p) => ({ p, score: Math.random() }));
  scored.sort((a, b) => b.score - a.score);
  const hit = scored[0]?.p ?? pool[0];
  used.push(hit.id);
  if (used.length > 5) used.splice(0, used.length - 5);
  return hit;
}

function empty(): Schedule {
  const now = Date.now();
  return {
    rainStart: now,
    rainEnd: now + BURST_MS,
    nightStart: now + 50 * 60 * 1000,
    nightEnd: now + 50 * 60 * 1000 + BURST_MS,
    lastRainId: "sheet",
    lastNightId: "black",
    usedRain: ["sheet"],
    usedNight: ["black"],
  };
}

export async function loadWeatherSchedule() {
  return readJsonFile<Schedule>(FILE, empty());
}

export async function saveWeatherSchedule(s: Schedule) {
  await writeJsonFile(FILE, s);
}

export function inWindow(start: number, end: number, now = Date.now()) {
  return now >= start && now < end;
}

export async function advanceWeatherSchedule(now = Date.now(), forceRain = false) {
  const s = await loadWeatherSchedule();
  if (forceRain || !s.lastRainId) {
    const pat = pick(RAIN_PATTERNS, s.usedRain, s.lastRainId);
    s.lastRainId = pat.id;
    s.rainStart = now;
    s.rainEnd = now + BURST_MS;
  } else if (now >= s.rainEnd && now >= s.rainStart) {
    if (now < s.rainStart) {
      /* waiting for next burst */
    } else if (now >= s.rainEnd) {
      const jitter = Math.floor(Math.random() * 20 * 60 * 1000) - 10 * 60 * 1000;
      const next = now + RAIN_EVERY_MS + jitter;
      s.rainStart = next;
      s.rainEnd = next + BURST_MS;
      const pat = pick(RAIN_PATTERNS, s.usedRain, s.lastRainId);
      s.lastRainId = pat.id;
    }
  }
  if (now >= s.nightEnd) {
    const jitter = Math.floor(Math.random() * 40 * 60 * 1000) - 20 * 60 * 1000;
    let next = now + RAIN_EVERY_MS + jitter;
    if (Math.abs(next - s.rainStart) < 40 * 60 * 1000) next = s.rainEnd + 45 * 60 * 1000;
    s.nightStart = next;
    s.nightEnd = next + BURST_MS;
    const pat = pick(NIGHT_PATTERNS, s.usedNight, s.lastNightId);
    s.lastNightId = pat.id;
  }
  await saveWeatherSchedule(s);
  return s;
}

export function buildCfgWeather(s: Schedule, now = Date.now()) {
  const raining = inWindow(s.rainStart, s.rainEnd, now);
  const night = inWindow(s.nightStart, s.nightEnd, now);
  const rainPat = RAIN_PATTERNS.find((p) => p.id === s.lastRainId) ?? RAIN_PATTERNS[0];
  const nightPat = NIGHT_PATTERNS.find((p) => p.id === s.lastNightId) ?? NIGHT_PATTERNS[0];
  const overcast = raining ? rainPat.overcast : night ? nightPat.overcast : 0.18;
  const rain = raining ? rainPat.rain : 0;
  const storm = raining ? rainPat.storm : night ? nightPat.storm : 0;
  const remain = raining || night ? Math.max(60, Math.round(((raining ? s.rainEnd : s.nightEnd) - now) / 1000)) : 1800;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>
<weather reset="1" enable="1">
  <overcast>
    <current actual="${overcast.toFixed(2)}" time="20" duration="${remain}" />
    <limits min="${raining || night ? "0.7" : "0.05"}" max="${raining || night ? "1.0" : "0.4"}" />
    <timelimits min="600" max="1800" />
    <changelimits min="0.0" max="0.2" />
  </overcast>
  <fog>
    <current actual="0.0" time="5" duration="99999" />
    <limits min="0.0" max="0.0" />
    <timelimits min="900" max="1800" />
    <changelimits min="0.0" max="0.0" />
  </fog>
  <rain>
    <current actual="${rain.toFixed(2)}" time="20" duration="${remain}" />
    <limits min="0.0" max="${raining ? "1.0" : "0.0"}" />
    <timelimits min="1500" max="1500" />
    <changelimits min="0.0" max="${raining ? "0.2" : "0.0"}" />
    <thresholds min="${raining ? "0.35" : "1.0"}" max="1.0" end="60" />
  </rain>
  <windMagnitude>
    <current actual="${raining ? "12" : night ? "7" : "3"}" time="30" duration="${remain}" />
    <limits min="2" max="${raining ? "16" : "8"}" />
    <timelimits min="300" max="900" />
    <changelimits min="0" max="4" />
  </windMagnitude>
  <windDirection>
    <current actual="120" time="120" duration="900" />
    <limits min="0" max="360" />
    <timelimits min="300" max="1200" />
    <changelimits min="0" max="90" />
  </windDirection>
  <storm density="${storm.toFixed(2)}" threshold="0.7" timeout="30" />
</weather>
`;
}

export async function applyWeatherToNitrado(forceRain = false) {
  const s = await advanceWeatherSchedule(Date.now(), forceRain);
  const xml = buildCfgWeather(s);
  const uploaded: string[] = [];
  for (const server of DAYZ_SERVERS) {
    const id = resolveServiceId(server);
    const mission = resolveMissionPath(server);
    try {
      await uploadNitradoFile(id, "cfgweather.xml", xml, mission);
      uploaded.push(`${server.id}:${id}:${mission}`);
    } catch (err) {
      uploaded.push(`${server.id}:${id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return {
    ok: true,
    raining: inWindow(s.rainStart, s.rainEnd),
    night: inWindow(s.nightStart, s.nightEnd),
    rainId: s.lastRainId,
    nightId: s.lastNightId,
    rainStart: new Date(s.rainStart).toISOString(),
    rainEnd: new Date(s.rainEnd).toISOString(),
    uploaded,
  };
}
