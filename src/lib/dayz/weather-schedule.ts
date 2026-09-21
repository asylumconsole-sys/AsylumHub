import { readJsonFile, writeJsonFile } from "@/lib/dayz/store";
import { uploadNitradoFile } from "@/lib/nitrado-files.functions";

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
  { id: "black", hour: 0 },
  { id: "late", hour: 22 },
  { id: "predawn", hour: 3 },
  { id: "midnight", hour: 1 },
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
  const hit = available[Math.floor(Math.random() * available.length)] ?? pool[0];
  used.push(hit.id);
  return hit;
}

function empty(): Schedule {
  const now = Date.now();
  return {
    rainStart: now,
    rainEnd: now + BURST_MS,
    nightStart: now + 40 * 60 * 1000,
    nightEnd: now + 40 * 60 * 1000 + BURST_MS,
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
  } else if (now >= s.rainEnd) {
    const next = now + RAIN_EVERY_MS + Math.floor(Math.random() * 15 * 60 * 1000);
    s.rainStart = next;
    s.rainEnd = next + BURST_MS;
    const pat = pick(RAIN_PATTERNS, s.usedRain, s.lastRainId);
    s.lastRainId = pat.id;
  }
  if (now >= s.nightEnd) {
    const next = now + RAIN_EVERY_MS + Math.floor(Math.random() * 25 * 60 * 1000);
    if (Math.abs(next - s.rainStart) < 40 * 60 * 1000) {
      s.nightStart = s.rainEnd + 45 * 60 * 1000;
    } else {
      s.nightStart = next;
    }
    s.nightEnd = s.nightStart + BURST_MS;
    const pat = pick(NIGHT_PATTERNS, s.usedNight, s.lastNightId);
    s.lastNightId = pat.id;
  }
  await saveWeatherSchedule(s);
  return s;
}

export function buildCfgWeather(s: Schedule, now = Date.now()) {
  const raining = inWindow(s.rainStart, s.rainEnd, now);
  const pat = RAIN_PATTERNS.find((p) => p.id === s.lastRainId) ?? RAIN_PATTERNS[0];
  const overcast = raining ? pat.overcast : 0.22;
  const rain = raining ? pat.rain : 0;
  const storm = raining ? pat.storm : 0;
  const remain = raining ? Math.max(60, Math.round((s.rainEnd - now) / 1000)) : 900;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>
<weather reset="0" enable="1">
  <overcast>
    <current actual="${overcast.toFixed(2)}" time="30" duration="${remain}" />
    <limits min="${raining ? "0.65" : "0.05"}" max="${raining ? "1.0" : "0.45"}" />
    <timelimits min="600" max="1800" />
    <changelimits min="0.0" max="${raining ? "0.15" : "0.25"}" />
  </overcast>
  <fog>
    <current actual="0.0" time="10" duration="99999" />
    <limits min="0.0" max="0.0" />
    <timelimits min="900" max="1800" />
    <changelimits min="0.0" max="0.0" />
  </fog>
  <rain>
    <current actual="${rain.toFixed(2)}" time="20" duration="${remain}" />
    <limits min="0.0" max="${raining ? "1.0" : "0.0"}" />
    <timelimits min="1500" max="1500" />
    <changelimits min="0.0" max="${raining ? "0.2" : "0.0"}" />
    <thresholds min="${raining ? "0.4" : "1.0"}" max="1.0" end="60" />
  </rain>
  <windMagnitude>
    <current actual="${raining ? "11" : "4"}" time="60" duration="${remain}" />
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

export async function applyWeatherToNitrado(forceRain = true) {
  const s = await advanceWeatherSchedule(Date.now(), forceRain);
  const xml = buildCfgWeather(s);
  const services = [
    process.env.NITRADO_SERVICE_101X || process.env.NITRADO_SERVICE_101,
    process.env.NITRADO_SERVICE_102X || process.env.NITRADO_SERVICE_102,
  ].filter(Boolean) as string[];
  const uploaded: string[] = [];
  for (const id of services) {
    try {
      await uploadNitradoFile(id, "cfgweather.xml", xml);
      uploaded.push(id);
    } catch (err) {
      uploaded.push(`${id}: ${err instanceof Error ? err.message : String(err)}`);
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
