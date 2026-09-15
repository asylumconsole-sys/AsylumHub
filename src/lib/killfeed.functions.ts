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

const KILL_PATTERNS: RegExp[] = [
  /Player\s+["']([^"']+)["']\s+(?:\(DEAD\)\s+)?killed by\s+Player\s+["']([^"']+)["'](?:\s+with\s+([^\s]+))?(?:\s+from\s+([0-9.]+)\s*m)?/i,
  /["']([^"']+)["']\s+was killed by\s+["']([^"']+)["'](?:\s+with\s+([^\s]+))?(?:\s+from\s+([0-9.]+)\s*meters?)?/i,
  /Kill:\s*([^|]+)\s*\|\s*([^|]+)\s*(?:\|\s*([^|]+))?/i,
];

const SUICIDE_PATTERNS: RegExp[] = [
  /Player\s+["']([^"']+)["'].*(?:committed suicide|suicided|died of suicide)/i,
  /["']([^"']+)["']\s+(?:committed suicide|suicided)/i,
];

const CONNECT_PATTERNS: RegExp[] = [
  /Player\s+["']([^"']+)["'].*(?:is connected|connected|has joined|logged in)/i,
  /(?:Login|logged in|connecting player|connected player)\s*(?:of|player)?\s*["']([^"']+)["']/i,
  /["']([^"']+)["']\s+(?:connected|has joined|logged in)/i,
];

const DISCONNECT_PATTERNS: RegExp[] = [
  /Player\s+["']([^"']+)["'].*(?:disconnected|has left|logged out|logout|kicked|timeout)/i,
  /["']([^"']+)["']\s+(?:disconnected|has left|logged out)/i,
  /(?:Logout|logged out)\s*(?:of|player)?\s*["']([^"']+)["']/i,
];

const OTHER_PATTERNS: RegExp[] = [
  /(?:Admin|ADMIN)\s+["']?([^"'\s]+)["']?\s+(?:banned|kicked|teleported|spawned|gave|set)/i,
  /#(?:login|logout|kick|ban|shutdown|restart)\b/i,
  /Player\s+["']([^"']+)["'].*(?:was kicked|was banned|unconscious|bled out)/i,
  /Player\s+["']([^"']+)["'].*(?:headshot|spawn\s*kill|combat\s*log|(?:car|vehicle)\s+(?:destroyed|destroy)|(?:animal|wolf|bear|deer|boar|cow|goat|chicken)\s+(?:killed|slain))/i,
];

function lineTimestamp(line: string, fileStamp: string): string {
  return line.match(/(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2})/)?.[1] ?? fileStamp;
}

function parseKillLine(line: string, server: DayZServerId, fileStamp: string): KillEvent | null {
  for (const pattern of KILL_PATTERNS) {
    const m = line.match(pattern);
    if (!m) continue;
    let victim = m[1]?.trim();
    let killer = m[2]?.trim();
    if (/^Kill:/i.test(line)) {
      killer = m[1]?.trim();
      victim = m[2]?.trim();
    }
    if (!killer || !victim) continue;
    if (killer.toLowerCase() === victim.toLowerCase()) continue;
    if (/suicide/i.test(line)) continue;
    const weapon = m[3]?.trim();
    const distance = m[4] ? Number(m[4]) : undefined;
    const at = lineTimestamp(line, fileStamp);
    return {
      id: `${server}:${at}:${killer}:${victim}:${weapon ?? ""}`.toLowerCase(),
      server,
      killer,
      victim,
      weapon: weapon || undefined,
      distance: Number.isFinite(distance) ? distance : undefined,
      at,
      raw: line.slice(0, 240),
    };
  }
  return null;
}

function firstCapture(patterns: RegExp[], line: string): string | null {
  for (const pattern of patterns) {
    const m = line.match(pattern);
    const name = m?.[1]?.trim();
    if (name) return name;
  }
  return null;
}

function parseLiveLine(line: string, server: DayZServerId, fileStamp: string): LiveEvent | null {
  const at = lineTimestamp(line, fileStamp);
  const trimmed = line.trim();
  if (!trimmed || trimmed.length < 8) return null;

  const kill = parseKillLine(line, server, fileStamp);
  if (kill) {
    return {
      id: `live:${kill.id}`,
      server,
      kind: "kill",
      at: kill.at,
      summary: `${kill.killer} killed ${kill.victim}${kill.weapon ? ` with ${kill.weapon}` : ""}`,
      actor: kill.killer,
      target: kill.victim,
      weapon: kill.weapon,
      distance: kill.distance,
      raw: kill.raw,
    };
  }

  if (/(suicide|suicided|committed suicide)/i.test(line)) {
    const actor =
      firstCapture(SUICIDE_PATTERNS, line) ?? firstCapture([/Player\s+["']([^"']+)["']/i], line);
    if (actor) {
      return {
        id: `${server}:suicide:${at}:${actor}`.toLowerCase(),
        server,
        kind: "suicide",
        at,
        summary: `${actor} died (suicide)`,
        actor,
        raw: trimmed.slice(0, 240),
      };
    }
  }

  if (/(disconnected|has left|logged out|logout|kicked|timeout)/i.test(line) && !/(kill|killed)/i.test(line)) {
    const actor = firstCapture(DISCONNECT_PATTERNS, line);
    if (actor) {
      return {
        id: `${server}:disconnect:${at}:${actor}`.toLowerCase(),
        server,
        kind: "disconnect",
        at,
        summary: `${actor} disconnected`,
        actor,
        raw: trimmed.slice(0, 240),
      };
    }
  }

  if (/(is connected|\bconnected\b|has joined|logged in|\blogin\b)/i.test(line) && !/(disconnected|kill|killed)/i.test(line)) {
    const actor = firstCapture(CONNECT_PATTERNS, line);
    if (actor) {
      return {
        id: `${server}:connect:${at}:${actor}`.toLowerCase(),
        server,
        kind: "connect",
        at,
        summary: `${actor} connected`,
        actor,
        raw: trimmed.slice(0, 240),
      };
    }
  }

  if (/(?:\bAdmin\b|#(?:login|logout|kick|ban|shutdown|restart)|was kicked|was banned|bled out|unconscious|headshot|spawn\s*kill|combat\s*log|(?:car|vehicle)\s+(?:destroyed|destroy)|(?:animal|wolf|bear|deer|boar|cow|goat|chicken)\s+(?:killed|slain))/i.test(line)) {
    const actor =
      firstCapture(OTHER_PATTERNS, line) ?? firstCapture([/Player\s+["']([^"']+)["']/i], line) ?? undefined;
    const cleaned = trimmed.replace(/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}\s*/, "");
    const summary = actor ? `${actor}: ${cleaned.slice(0, 120)}` : cleaned.slice(0, 140);
    return {
      id: `${server}:other:${at}:${summary.slice(0, 60)}`.toLowerCase(),
      server,
      kind: "other",
      at,
      summary,
      actor,
      raw: trimmed.slice(0, 240),
    };
  }

  return null;
}

async function downloadRecentLogText(server: DayZServerId): Promise<{
  lines: Array<{ line: string; stamp: string }>;
  missingEnv?: string[];
}> {
  const keys = FTP_KEYS[server];
  const host = process.env[keys.host] ?? process.env.FTP_HOST;
  const user = process.env[keys.user] ?? process.env.FTP_USER;
  const password = process.env[keys.pass] ?? process.env.FTP_PASS;
  const directory = process.env[keys.path] ?? process.env.FTP_LOGS_PATH ?? "/dayzps/config";
  const missing = requiredFtpEnv(server).filter((k) => !process.env[k] && !process.env[k.replace(/_101X|_102X/, "")]);
  if (!host || !user || !password) {
    return { lines: [], missingEnv: requiredFtpEnv(server) };
  }

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
      .sort((a, b) => b.modifiedAt - a.modifiedAt)
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

async function readServerKills(server: DayZServerId): Promise<{ events: KillEvent[]; missingEnv?: string[] }> {
  const { lines, missingEnv } = await downloadRecentLogText(server);
  if (missingEnv?.length && lines.length === 0) return { events: [], missingEnv };
  const events: KillEvent[] = [];
  const seen = new Set<string>();
  for (const { line, stamp } of lines) {
    if (!/(kill|killed)/i.test(line)) continue;
    const event = parseKillLine(line, server, stamp);
    if (!event || seen.has(event.id)) continue;
    seen.add(event.id);
    events.push(event);
  }
  events.sort((a, b) => b.at.localeCompare(a.at));
  return { events: events.slice(0, 200), missingEnv };
}

async function readServerLiveEvents(server: DayZServerId): Promise<{ events: LiveEvent[]; missingEnv?: string[] }> {
  const { lines, missingEnv } = await downloadRecentLogText(server);
  if (missingEnv?.length && lines.length === 0) return { events: [], missingEnv };
  const events: LiveEvent[] = [];
  const seen = new Set<string>();
  for (const { line, stamp } of lines) {
    if (
      !/(kill|killed|connect|disconnect|login|logout|suicide|admin|#kick|#ban|bled out|unconscious|joined|kicked|banned)/i.test(
        line,
      )
    ) {
      continue;
    }
    const event = parseLiveLine(line, server, stamp);
    if (!event || seen.has(event.id)) continue;
    seen.add(event.id);
    events.push(event);
  }
  events.sort((a, b) => b.at.localeCompare(a.at));
  return { events: events.slice(0, 300), missingEnv };
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
        const result = await readServerKills(server);
        if (result.missingEnv?.length && result.events.length === 0) {
          unavailable.push({
            server,
            reason: "FTP credentials missing",
            missingEnv: result.missingEnv,
          });
        } else {
          events.push(...result.events);
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
    const wanted = data.server && data.server !== "all" ? [data.server] : (["101x", "102x"] as DayZServerId[]);
    const limit = Math.min(Math.max(data.limit ?? 150, 1), 400);
    const unavailable: LiveFeedResult["unavailable"] = [];
    const events: LiveEvent[] = [];

    for (const server of wanted) {
      try {
        const result = await readServerLiveEvents(server);
        if (result.missingEnv?.length && result.events.length === 0) {
          unavailable.push({
            server,
            reason: "FTP credentials missing",
            missingEnv: result.missingEnv,
          });
        } else {
          events.push(...result.events);
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

export function killfeedMissingEnvSummary(unavailable: KillfeedResult["unavailable"]): string[] {
  const set = new Set<string>();
  for (const u of unavailable) u.missingEnv?.forEach((k) => set.add(k));
  if (set.size === 0) DAYZ_SERVERS.forEach((s) => requiredFtpEnv(s.id).forEach((k) => set.add(k)));
  return Array.from(set);
}