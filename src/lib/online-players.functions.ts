import { createServerFn } from "@tanstack/react-start";
import { Client } from "basic-ftp";
import { Writable } from "node:stream";
import { DAYZ_SERVERS, resolveServiceId } from "@/lib/dayz/servers";

const SERVERS = ["101x", "102x"] as const;
type ServerId = (typeof SERVERS)[number];
const INVALID_PLAYER_NAMES = new Set(["peter-pit"]);
const ITEM_OR_AI_NAMES = new Set(
  [
    "hatchet",
    "axe",
    "knife",
    "m4a1",
    "akm",
    "bandage",
    "apple",
    "pear",
    "can",
    "zombie",
    "infected",
    "animal",
    "wolf",
    "bear",
    "cow",
    "pig",
    "sheep",
    "deer",
    "survivor",
    "civilian",
    "medic",
    "access_medic",
    "base_df",
  ].map((n) => n.toLowerCase()),
);

const FTP_KEYS = {
  "101x": { host: "FTP_101X_HOST", user: "FTP_101X_USER", pass: "FTP_101X_PASS", port: "FTP_101X_PORT", path: "FTP_101X_LOGS_PATH" },
  "102x": { host: "FTP_102X_HOST", user: "FTP_102X_USER", pass: "FTP_102X_PASS", port: "FTP_102X_PORT", path: "FTP_102X_LOGS_PATH" },
} as const;

export type OnlinePlayer = {
  id: string;
  name: string;
  server: ServerId;
  lastSeen: string;
  x?: number;
  y?: number;
  z?: number;
};

export type OnlinePlayersResult = {
  players: OnlinePlayer[];
  unavailable: Array<{ server: ServerId; reason: string }>;
};

function looksLikeClassname(name: string) {
  if (ITEM_OR_AI_NAMES.has(name.toLowerCase())) return true;
  if (/^(u|access|base|item|land|vehicle|animal|zombie|infected|survivor)_/i.test(name)) return true;
  if (/^[A-Z][A-Za-z0-9]+_[A-Z]/.test(name)) return true;
  return false;
}

function isKillLine(line: string) {
  return /\b(killed|killing|eliminated|was killed|has died|is dead|murdered)\b/i.test(line);
}

function isDisconnect(line: string) {
  return /(disconnected|disconnect|has left|logged out|logout|kicked|timeout)/i.test(line);
}

function isConnect(line: string) {
  return /(connected|has joined|logged in|login:\s)/i.test(line) && !isDisconnect(line) && !isKillLine(line);
}

function readNames(line: string) {
  if (isKillLine(line)) return [] as string[];
  const names: string[] = [];
  const patterns = [
    /Player\s+["']([^"']+)["']/gi,
    /(?:Login|logged in|connecting player|connected player)\s*(?:of|player)?\s*["']([^"']+)["']/gi,
  ];
  for (const pattern of patterns) {
    for (const match of line.matchAll(pattern)) {
      const name = match[1]
        ?.replace(/\s+(?:CREATED|CONNECTED|DISCONNECTED|DESTROYED)\b.*$/i, "")
        .trim()
        .replace(/\s+/g, " ");
      if (!name) continue;
      if (INVALID_PLAYER_NAMES.has(name.toLocaleLowerCase())) continue;
      if (looksLikeClassname(name)) continue;
      if (name.length < 2 || name.length > 32) continue;
      if (/^(identity|unknown|server|player|created|connected|disconnected|killed|killer|victim)$/i.test(name)) continue;
      names.push(name);
    }
  }
  return names;
}

function readPosition(line: string): { x: number; y: number; z: number } | null {
  const match =
    line.match(/pos(?:ition)?\s*[=:<>]\s*<?\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*>?/i) ||
    line.match(/<\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*>/);
  if (!match) return null;
  const x = Number(match[1]);
  const y = Number(match[2]);
  const z = Number(match[3]);
  if (![x, y, z].every(Number.isFinite)) return null;
  return { x, y, z };
}

async function nitradoCurrent(server: ServerId): Promise<number | null> {
  const token = process.env.NITRADO_API_TOKEN;
  const catalog = DAYZ_SERVERS.find((s) => s.id === server);
  if (!token || !catalog) return null;
  const serviceId = resolveServiceId(catalog);
  try {
    const res = await fetch(`https://api.nitrado.net/services/${serviceId}/gameservers`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: { gameserver?: { query?: { player_current?: number } } } };
    const n = json.data?.gameserver?.query?.player_current;
    return typeof n === "number" ? n : null;
  } catch {
    return null;
  }
}

async function readServerLogs(server: ServerId): Promise<OnlinePlayer[]> {
  const keys = FTP_KEYS[server];
  const host = process.env[keys.host] ?? process.env.FTP_HOST;
  const user = process.env[keys.user] ?? process.env.FTP_USER;
  const password = process.env[keys.pass] ?? process.env.FTP_PASS;
  const directory = process.env[keys.path] ?? process.env.FTP_LOGS_PATH ?? "/dayzps/config";
  if (!host || !user || !password) return [];

  const client = new Client();
  client.ftp.timeout = 20_000;
  try {
    await client.access({
      host,
      user,
      password,
      port: Number(process.env[keys.port] ?? process.env.FTP_PORT ?? 21),
    });
    const files = (await client.list(directory))
      .filter((file) => /\.(RPT|ADM)$/i.test(file.name))
      .sort((left, right) => right.modifiedAt - left.modifiedAt)
      .slice(0, 2)
      .sort((left, right) => left.name.localeCompare(right.name));
    const state = new Map<
      string,
      { name: string; lastSeen: string; x?: number; y?: number; z?: number }
    >();
    for (const file of files) {
      let text = "";
      const sink = new Writable({
        write(chunk, _encoding, callback) {
          text += chunk.toString();
          callback();
        },
      });
      await client.downloadTo(sink, `${directory.replace(/\/$/, "")}/${file.name}`);
      for (const line of text.split(/\r?\n/)) {
        if (isKillLine(line)) continue;
        const names = readNames(line);
        if (!names.length) continue;
        const timestamp =
          line.match(/(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2})/)?.[1] ??
          new Date(file.modifiedAt || Date.now()).toISOString();
        const pos = readPosition(line);
        for (const name of names) {
          const key = name.toLocaleLowerCase();
          if (isDisconnect(line)) {
            state.delete(key);
            continue;
          }
          const existing = state.get(key);
          if (isConnect(line)) {
            state.set(key, {
              name,
              lastSeen: timestamp,
              x: pos?.x ?? existing?.x,
              y: pos?.y ?? existing?.y,
              z: pos?.z ?? existing?.z,
            });
            continue;
          }
          if (existing && pos) {
            state.set(key, { ...existing, lastSeen: timestamp, x: pos.x, y: pos.y, z: pos.z });
          }
        }
      }
    }
    let players = Array.from(state.values()).map((player) => ({
      id: `${server}:${player.name.toLocaleLowerCase()}`,
      name: player.name,
      server,
      lastSeen: player.lastSeen,
      x: player.x,
      y: player.y,
      z: player.z,
    }));
    const liveCount = await nitradoCurrent(server);
    if (liveCount != null && players.length > liveCount) {
      players = players
        .sort((a, b) => String(b.lastSeen).localeCompare(String(a.lastSeen)))
        .slice(0, Math.max(0, liveCount));
    }
    return players;
  } finally {
    client.close();
  }
}

export async function loadOnlinePlayers(): Promise<OnlinePlayersResult> {
  const results = await Promise.all(
    SERVERS.map(async (server) => {
      try {
        return { server, players: await readServerLogs(server), reason: null };
      } catch (error) {
        return {
          server,
          players: [],
          reason: error instanceof Error ? error.message : "FTP log directory unavailable",
        };
      }
    }),
  );
  return {
    players: results.flatMap((result) => result.players),
    unavailable: results
      .filter((result) => result.reason)
      .map((result) => ({ server: result.server, reason: result.reason as string })),
  };
}

export const getOnlinePlayers = createServerFn({ method: "POST" })
  .inputValidator((data: { accessToken?: string }) => data)
  .handler(async ({ data }) => {
    const isDemo =
      data.accessToken === "demo-access-token" || data.accessToken === "discord-access-token";
    if (!isDemo && !data.accessToken) {
      throw new Error("Unauthorized: Sign in again.");
    }
    return loadOnlinePlayers();
  });
