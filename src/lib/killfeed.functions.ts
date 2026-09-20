import { createServerFn } from "@tanstack/react-start";
import { Client } from "basic-ftp";
import { Writable } from "node:stream";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DAYZ_SERVERS, requiredFtpEnv, resolveMissionPath, resolveServiceId, type DayZServerId } from "@/lib/dayz/servers";

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
  unavailable: KillfeedResult["unavailable"];
};

const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;

const KILL_PATTERNS: RegExp[] = [
  /Player\s+["']([^"']+)["']\s+(?:\(DEAD\)\s+)?killed by\s+Player\s+["']([^"']+)["'](?:\s+with\s+([^\s]+))?(?:\s+from\s+([0-9.]+)\s*m)?/i,
  /Player\s+["']([^"']+)["'].*has been killed by\s+(?:player\s+)?["']([^"']+)["']/i,
  /["']([^"']+)["']\s+was killed by\s+["']([^"']+)["'](?:\s+with\s+([^\s]+))?(?:\s+from\s+([0-9.]+)\s*meters?)?/i,
  /Kill:\s*([^|]+)\s*\|\s*([^|]+)\s*(?:\|\s*([^|]+))?/i,
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
    if (!killer || !victim || killer.toLowerCase() === victim.toLowerCase() || /suicide/i.test(line)) continue;
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

function withinFiveDays(iso: string) {
  const t = Date.parse(iso.replace(" ", "T"));
  if (!Number.isFinite(t)) return true;
  return Date.now() - t <= FIVE_DAYS_MS;
}

function logDirs(server: DayZServerId): string[] {
  const mission = resolveMissionPath(DAYZ_SERVERS.find((s) => s.id === server)!);
  const fromMission = mission.replace(/\/dayzps_missions\/.*$/, "/dayzps/config");
  const specific = server === "101x" ? process.env.FTP_101X_LOGS_PATH : process.env.FTP_102X_LOGS_PATH;
  return Array.from(
    new Set(
      [specific, process.env.FTP_LOGS_PATH, fromMission, "/dayzps/config", `${fromMission.replace(/\/config$/, "")}/config`].filter(Boolean) as string[],
    ),
  );
}

async function nitradoList(serviceId: string, dir: string, token: string) {
  const url = `https://api.nitrado.net/services/${serviceId}/gameservers/file_server/list?dir=${encodeURIComponent(dir)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const json = (await res.json()) as { data?: { entries?: Array<{ type?: string; name?: string; path?: string; modified_at?: number }> } };
  return json.data?.entries ?? [];
}

async function nitradoDownload(serviceId: string, filePath: string, token: string): Promise<string> {
  const url = `https://api.nitrado.net/services/${serviceId}/gameservers/file_server/download?file=${encodeURIComponent(filePath)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const json = (await res.json()) as { data?: { token?: { url?: string } } };
  const fileUrl = json.data?.token?.url;
  if (!fileUrl) return "";
  const file = await fetch(fileUrl);
  return file.ok ? await file.text() : "";
}

async function downloadViaNitrado(server: DayZServerId): Promise<Array<{ line: string; stamp: string }>> {
  const token = process.env.NITRADO_API_TOKEN;
  if (!token) return [];
  const serviceId = resolveServiceId(DAYZ_SERVERS.find((s) => s.id === server)!);
  const cutoff = Date.now() - FIVE_DAYS_MS;
  const lines: Array<{ line: string; stamp: string }> = [];
  for (const dir of logDirs(server)) {
    try {
      const entries = await nitradoList(serviceId, dir, token);
      const files = entries
        .filter((e) => /adm/i.test(`${e.name ?? ""} ${e.path ?? ""}`))
        .sort((a, b) => (b.modified_at ?? 0) - (a.modified_at ?? 0))
        .slice(0, 12);
      for (const file of files) {
        const modified = (file.modified_at ?? 0) * (String(file.modified_at ?? 0).length < 12 ? 1000 : 1);
        if (modified && modified < cutoff) continue;
        const path = file.path || `${dir.replace(/\/$/, "")}/${file.name}`;
        const text = await nitradoDownload(serviceId, path, token);
        const stamp = new Date(modified || Date.now()).toISOString();
        for (const line of text.split(/\r?\n/)) if (line.trim()) lines.push({ line, stamp });
      }
      if (lines.length) return lines;
    } catch {
      /* try next dir */
    }
  }
  return lines;
}

async function downloadViaFtp(server: DayZServerId): Promise<Array<{ line: string; stamp: string }>> {
  const host = process.env.FTP_101X_HOST ?? process.env.FTP_102X_HOST ?? process.env.FTP_HOST;
  const user = process.env.FTP_101X_USER ?? process.env.FTP_102X_USER ?? process.env.FTP_USER;
  const password = process.env.FTP_101X_PASS ?? process.env.FTP_102X_PASS ?? process.env.FTP_PASS;
  if (!host || !user || !password) return [];
  const directory = logDirs(server)[0] ?? "/dayzps/config";
  const client = new Client();
  client.ftp.timeout = 25_000;
  const cutoff = Date.now() - FIVE_DAYS_MS;
  try {
    await client.access({
      host,
      user,
      password,
      port: Number(process.env.FTP_101X_PORT ?? process.env.FTP_PORT ?? 21),
    });
    const listed = await client.list(directory);
    const files = listed
      .filter((file) => /adm/i.test(file.name))
      .filter((file) => !file.modifiedAt || file.modifiedAt >= cutoff)
      .sort((a, b) => (b.modifiedAt || 0) - (a.modifiedAt || 0))
      .slice(0, 12);
    const lines: Array<{ line: string; stamp: string }> = [];
    for (const file of files) {
      let text = "";
      const sink = new Writable({
        write(chunk, _enc, cb) {
          text += chunk.toString();
          if (text.length > 8_000_000) text = text.slice(-4_000_000);
          cb();
        },
      });
      await client.downloadTo(sink, `${directory.replace(/\/$/, "")}/${file.name}`);
      const stamp = new Date(file.modifiedAt || Date.now()).toISOString();
      for (const line of text.split(/\r?\n/)) if (line.trim()) lines.push({ line, stamp });
    }
    return lines;
  } finally {
    client.close();
  }
}

async function downloadRecentLogText(server: DayZServerId): Promise<{
  lines: Array<{ line: string; stamp: string }>;
  error?: string;
}> {
  try {
    const nitrado = await downloadViaNitrado(server);
    if (nitrado.length) return { lines: nitrado };
  } catch (error) {
    /* fall through */
  }
  try {
    const ftp = await downloadViaFtp(server);
    if (ftp.length) return { lines: ftp };
  } catch (error) {
    return { lines: [], error: error instanceof Error ? error.message : "FTP log read failed" };
  }
  return { lines: [], error: "No ADM logs found on Nitrado or FTP" };
}

async function readServerKills(server: DayZServerId): Promise<{ events: KillEvent[]; error?: string }> {
  const { lines, error } = await downloadRecentLogText(server);
  const events: KillEvent[] = [];
  const seen = new Set<string>();
  for (const { line, stamp } of lines) {
    if (!/(kill|killed)/i.test(line)) continue;
    const event = parseKillLine(line, server, stamp);
    if (!event || seen.has(event.id) || !withinFiveDays(event.at)) continue;
    seen.add(event.id);
    events.push(event);
  }
  events.sort((a, b) => b.at.localeCompare(a.at));
  return { events: events.slice(0, 800), error: events.length ? undefined : error };
}

export const getKillfeed = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { server?: DayZServerId | "all"; limit?: number } = {}) => d)
  .handler(async ({ data }): Promise<KillfeedResult> => {
    const wanted = data.server && data.server !== "all" ? [data.server] : (["101x", "102x"] as DayZServerId[]);
    const limit = Math.min(Math.max(data.limit ?? 250, 1), 800);
    const unavailable: KillfeedResult["unavailable"] = [];
    const events: KillEvent[] = [];
    for (const server of wanted) {
      try {
        const result = await readServerKills(server);
        events.push(...result.events);
        if (result.error && result.events.length === 0) {
          unavailable.push({ server, reason: result.error, missingEnv: requiredFtpEnv(server) });
        }
      } catch (error) {
        unavailable.push({
          server,
          reason: error instanceof Error ? error.message : "Log read failed",
          missingEnv: requiredFtpEnv(server),
        });
      }
    }
    events.sort((a, b) => b.at.localeCompare(a.at));
    return { events: events.filter((e) => withinFiveDays(e.at)).slice(0, limit), unavailable };
  });

export const getLiveEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { server?: DayZServerId | "all"; limit?: number } = {}) => d)
  .handler(async ({ data }): Promise<LiveFeedResult> => {
    const feed = await getKillfeed({ data: { server: data.server, limit: data.limit ?? 250 } });
    return {
      events: feed.events.map((kill) => ({
        id: `live:${kill.id}`,
        server: kill.server,
        kind: "kill" as const,
        at: kill.at,
        summary: `${kill.killer} killed ${kill.victim}${kill.weapon ? ` with ${kill.weapon}` : ""}`,
        actor: kill.killer,
        target: kill.victim,
        weapon: kill.weapon,
        distance: kill.distance,
        raw: kill.raw,
      })),
      unavailable: feed.unavailable,
    };
  });

export function killfeedMissingEnvSummary(unavailable: KillfeedResult["unavailable"]): string[] {
  const set = new Set<string>();
  for (const u of unavailable) u.missingEnv?.forEach((k) => set.add(k));
  return Array.from(set);
}
