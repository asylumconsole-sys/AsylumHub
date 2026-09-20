import { createServerFn } from "@tanstack/react-start";
import { Client } from "basic-ftp";
import { DAYZ_SERVERS, resolveServiceId } from "@/lib/dayz/servers";

const SERVERS = ["101x", "102x"] as const;
type ServerId = (typeof SERVERS)[number];
const INVALID_PLAYER_NAMES = new Set(["peter-pit"]);

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
  if (/^(u|access|base|item|land|vehicle|animal|zombie|infected|survivor)_/i.test(name)) return true;
  if (/^[A-Z][A-Za-z0-9]+_[A-Z]/.test(name)) return true;
  if (/^(hatchet|axe|knife|m4a1|akm|medic)$/i.test(name)) return true;
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
      names.push(name);
    }
  }
  return names;
}

async function nitradoCurrent(server: ServerId): Promise<number | null> {
  const token = process.env.NITRADO_API_TOKEN;
  const catalog = DAYZ_SERVERS.find((s) => s.id === server);
  if (!token || !catalog) return null;
  try {
    const res = await fetch(`https://api.nitrado.net/services/${resolveServiceId(catalog)}/gameservers`, {
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
      .slice(0, 2);
    const state = new Map<string, { name: string; lastSeen: string }>();
    for (const file of files) {
      const chunks: Buffer[] = [];
      await client.downloadTo(
        {
          write(chunk: Buffer, _enc: string, cb: () => void) {
            chunks.push(Buffer.from(chunk));
            cb();
          },
        } as never,
        `${directory.replace(/\/$/, "")}/${file.name}`,
      );
      const text = Buffer.concat(chunks).toString("utf8");
      for (const line of text.split(/\r?\n/)) {
        if (isKillLine(line)) continue;
        const names = readNames(line);
        const timestamp =
          line.match(/(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2})/)?.[1] ??
          new Date(file.modifiedAt || Date.now()).toISOString();
        for (const name of names) {
          const key = name.toLocaleLowerCase();
          if (isDisconnect(line)) {
            state.delete(key);
            continue;
          }
          if (isConnect(line)) state.set(key, { name, lastSeen: timestamp });
        }
      }
    }
    let players = Array.from(state.values()).map((player) => ({
      id: `${server}:${player.name.toLocaleLowerCase()}`,
      name: player.name,
      server,
      lastSeen: player.lastSeen,
    }));
    const liveCount = await nitradoCurrent(server);
    if (liveCount != null && players.length > liveCount) {
      players = players.sort((a, b) => String(b.lastSeen).localeCompare(String(a.lastSeen))).slice(0, liveCount);
    }
    return players;
  } finally {
    client.close();
  }
}

export const getOnlinePlayers = createServerFn({ method: "POST" })
  .inputValidator((data: { accessToken?: string }) => data)
  .handler(async ({ data }) => {
    const isDemo =
      data.accessToken === "demo-access-token" || data.accessToken === "discord-access-token";
    if (!isDemo && !data.accessToken) throw new Error("Unauthorized: Sign in again.");
    const results = await Promise.all(
      SERVERS.map(async (server) => {
        try {
          return { server, players: await readServerLogs(server), reason: null };
        } catch (error) {
          return {
            server,
            players: [] as OnlinePlayer[],
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
    } satisfies OnlinePlayersResult;
  });
