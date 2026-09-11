import { createServerFn } from "@tanstack/react-start";
import { Client } from "basic-ftp";
import { Writable } from "node:stream";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DAYZ_SERVERS, requiredFtpEnv, type DayZServerId } from "@/lib/dayz/servers";

export type KillEvent = {
  id: string;
  server: DayZServerId;
  killer: string;
  victim: string;
  weapon?: string;
  distance?: number;
  at: string;
  raw: string;
};

export type LiveEventKind = "kill" | "connect" | "disconnect" | "suicide" | "other";

export type LiveEvent = {
  id: string;
  server: DayZServerId;
  kind: LiveEventKind;
  at: string;
  summary: string;
  actor?: string;
  target?: string;
  weapon?: string;
  distance?: number;
  raw: string;
};

export type KillfeedResult = {
  events: KillEvent[];
  unavailable: Array<{ server: DayZServerId; reason: string; missingEnv?: string[] }>;
};

export type LiveFeedResult = {
  events: LiveEvent[];
  unavailable: Array<{ server: DayZServerId; reason: string; missingEnv?: string[] }>;
};

const FTP_KEYS = {
  "101x": { host: "FTP_101X_HOST", user: "FTP_101X_USER", pass: "FTP_101X_PASS", port: "FTP_101X_PORT", path: "FTP_101X_LOGS_PATH" },
  "102x": { host: "FTP_102X_HOST", user: "FTP_102X_USER", pass: "FTP_102X_PASS", port: "FTP_102X_PORT", path: "FTP_102X_LOGS_PATH" },
} as const;

function lineTimestamp(line: string, fileStamp: string): string {
  return line.match(/(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2})/)?.[1] ?? fileStamp;
}

function parseKillLine(line: string, server: DayZServerId, fileStamp: string): KillEvent | null {
  const patterns = [
    /Player\s+["']([^"']+)["']\s+(?:\(DEAD\)\s+)?killed by\s+Player\s+["']([^"']+)["']/i,
    /["']([^"']+)["']\s+was killed by\s+["']([^"']+)["']/i,
    /Kill:\s*([^|]+)\s*\|\s*([^|]+)/i,
  ];
  for (const pattern of patterns) {
    const m = line.match(pattern);
    if (!m) continue;
    let victim = m[1]?.trim();
    let killer = m[2]?.trim();
    if (/^Kill:/i.test(line)) {
      killer = m[1]?.trim();
      victim = m[2]?.trim();
    }
    if (!killer || !victim || killer.toLowerCase() === victim.toLowerCase()) continue;
    if (/suicide/i.test(line)) continue;
    const at = lineTimestamp(line, fileStamp);
    return {
      id: `${server}:${at}:${killer}:${victim}`.toLowerCase(),
      server,
      killer,
      victim,
      at,
      raw: line.slice(0, 240),
    };
  }
  return null;
}

async function downloadRecentLogText(server: DayZServerId): Promise<{ lines: Array<{ line: string; stamp: string }>; missingEnv?: string[] }> {
  const keys = FTP_KEYS[server];
  const host = process.env[keys.host] ?? process.env.FTP_HOST;
  const user = process.env[keys.user] ?? process.env.FTP_USER;
  const password = process.env[keys.pass] ?? process.env.FTP_PASS;
  const directory = process.env[keys.path] ?? process.env.FTP_LOGS_PATH ?? "/dayzps/config";
  const missing = requiredFtpEnv(server).filter((k) => !process.env[k]);
  if (!host || !user || !password) return { lines: [], missingEnv: requiredFtpEnv(server) };

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
      .filter((file) => /\.(ADM|RPT)$/i.test(file.name))
      .sort((a, b) => Number(b.modifiedAt) - Number(a.modifiedAt))
      .slice(0, 3);
    const lines: Array<{ line: string; stamp: string }> = [];
    for (const file of files) {
      let text = "";
      const sink = new Writable({
        write(chunk, _enc, cb) {
          text += chunk.toString();
          cb();
        },
      });
      await client.downloadTo(sink, `${directory.replace(/\/$/, "")}/${file.name}`);
      const stamp = new Date(file.modifiedAt || Date.now()).toISOString();
      for (const line of text.split(/\r?\n/)) {
        if (line.trim()) lines.push({ line, stamp });
      }
    }
    return { lines, missingEnv: missing.length ? missing : undefined };
  } finally {
    client.close();
  }
}

export const getKillfeed = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { server?: DayZServerId | "all"; limit?: number } = {}) => d)
  .handler(async ({ data }): Promise<KillfeedResult> => {
    const wanted = data.server && data.server !== "all" ? [data.server] : (["101x", "102x"] as DayZServerId[]);
    const limit = Math.min(Math.max(data.limit ?? 100, 1), 300);
    const unavailable: KillfeedResult["unavailable"] = [];
    const events: KillEvent[] = [];
    for (const server of wanted) {
      try {
        const { lines, missingEnv } = await downloadRecentLogText(server);
        if (missingEnv?.length && lines.length === 0) {
          unavailable.push({ server, reason: "FTP credentials missing", missingEnv });
          continue;
        }
        const seen = new Set<string>();
        for (const { line, stamp } of lines) {
          const event = parseKillLine(line, server, stamp);
          if (!event || seen.has(event.id)) continue;
          seen.add(event.id);
          events.push(event);
        }
      } catch (error) {
        unavailable.push({
          server,
          reason: error instanceof Error ? error.message : "FTP log read failed",
          missingEnv: requiredFtpEnv(server),
        });
      }
    }
    events.sort((a, b) => b.at.localeCompare(a.at));
    return { events: events.slice(0, limit), unavailable };
  });

export const getLiveEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { server?: DayZServerId | "all"; limit?: number } = {}) => d)
  .handler(async ({ data }): Promise<LiveFeedResult> => {
    const feed = await getKillfeed({ data });
    return {
      events: feed.events.map((event) => ({
        id: `live:${event.id}`,
        server: event.server,
        kind: "kill" as const,
        at: event.at,
        summary: `${event.killer} killed ${event.victim}`,
        actor: event.killer,
        target: event.victim,
        weapon: event.weapon,
        distance: event.distance,
        raw: event.raw,
      })),
      unavailable: feed.unavailable,
    };
  });

export function killfeedMissingEnvSummary(unavailable: KillfeedResult["unavailable"]): string[] {
  const set = new Set<string>();
  for (const item of unavailable) item.missingEnv?.forEach((key) => set.add(key));
  if (set.size === 0) DAYZ_SERVERS.forEach((server) => requiredFtpEnv(server.id).forEach((key) => set.add(key)));
  return Array.from(set);
}
