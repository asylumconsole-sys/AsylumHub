import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requiredFtpEnv, type DayZServerId } from "@/lib/dayz/servers";

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
export type LiveFeedResult = { events: LiveEvent[]; unavailable: KillfeedResult["unavailable"] };

const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;
const STOP = new Set(["by", "was", "with", "killed", "player", "the", "a", "an", "from", "and", "to", "of", "in", "on", "dead"]);

function withinFiveDays(iso: string) {
  const t = Date.parse(iso.replace(" ", "T"));
  if (!Number.isFinite(t)) return true;
  return Date.now() - t <= FIVE_DAYS_MS;
}

function cleanName(value: string | undefined): string | null {
  if (!value) return null;
  const name = value.replace(/[*_`]/g, "").replace(/<@!?\d+>/g, "").replace(/\s+/g, " ").trim();
  if (name.length < 2 || name.length > 32) return null;
  if (STOP.has(name.toLowerCase())) return null;
  if (!/[A-Za-z0-9]/.test(name)) return null;
  if (/^(was|by|killed|with)$/i.test(name)) return null;
  return name;
}

function distanceOf(text: string): number | undefined {
  const m = text.match(/(\d+(?:\.\d+)?)\s*(?:m|meters?|meter)\b/i);
  if (!m) return undefined;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : undefined;
}

function weaponOf(text: string): string | undefined {
  const m = text.match(/\bwith\s+\*?\*?([A-Za-z][A-Za-z0-9_\-\s]{1,40}?)\*?\*?(?:\s+from|\s+at|\s+\d|$)/i);
  const w = m?.[1]?.trim();
  if (!w || STOP.has(w.toLowerCase())) return undefined;
  return w;
}

function parsePair(text: string): { killer: string; victim: string; weapon?: string; distance?: number } | null {
  const blob = text.replace(/\n+/g, " ");
  const killedBy = blob.match(/(.+?)\s+was killed by\s+(.+?)(?:\s+with\s+(.+?))?(?:\s+from\s+([0-9.]+))?/i);
  if (killedBy) {
    const victim = cleanName(killedBy[1].split(/[•|-]/).pop());
    const killer = cleanName(killedBy[2].split(/\s+with\s+/i)[0]);
    if (killer && victim) {
      return { killer, victim, weapon: cleanName(killedBy[3] || "") || weaponOf(blob), distance: killedBy[4] ? Number(killedBy[4]) : distanceOf(blob) };
    }
  }
  const killed = blob.match(/(.+?)\s+killed\s+(.+?)(?:\s+with\s+(.+?))?(?:\s+from\s+([0-9.]+))?/i);
  if (killed && !/was killed/i.test(blob)) {
    const killer = cleanName(killed[1].split(/[•|-]/).pop());
    const victim = cleanName(killed[2].split(/\s+with\s+/i)[0]);
    if (killer && victim) {
      return { killer, victim, weapon: cleanName(killed[3] || "") || weaponOf(blob), distance: killed[4] ? Number(killed[4]) : distanceOf(blob) };
    }
  }
  return null;
}

function fieldMap(fields: Array<{ name: string; value: string }> | undefined) {
  const map: Record<string, string> = {};
  for (const field of fields ?? []) map[field.name.toLowerCase()] = field.value.replace(/[*_`]/g, "").trim();
  return map;
}

function botHeaders() {
  const token = process.env.DISCORD_TOKEN?.replace(/^Bot\s+/i, "");
  if (!token) return null;
  return { Authorization: `Bot ${token}` };
}

function serverFromText(text: string): DayZServerId {
  return /102x|chernarus/i.test(text) ? "102x" : "101x";
}

async function findKillfeedChannelId(headers: Record<string, string>): Promise<string | null> {
  if (process.env.DISCORD_KILLFEED_CHANNEL_ID) return process.env.DISCORD_KILLFEED_CHANNEL_ID;
  const guilds = (await (await fetch("https://discord.com/api/v10/users/@me/guilds", { headers })).json()) as Array<{ id: string }>;
  const guildId = process.env.DISCORD_GUILD_ID || guilds?.[0]?.id;
  if (!guildId) return null;
  const channels = (await (await fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, { headers })).json()) as Array<{ id: string; name?: string }>;
  if (!Array.isArray(channels)) return null;
  return channels.find((c) => /kill\s*-?feed|kills/i.test(c.name ?? ""))?.id ?? null;
}

async function downloadViaDiscord(): Promise<KillEvent[]> {
  const headers = botHeaders();
  if (!headers) return [];
  const channelId = await findKillfeedChannelId(headers);
  if (!channelId) return [];
  const cutoff = Date.now() - FIVE_DAYS_MS;
  const events: KillEvent[] = [];
  const seen = new Set<string>();
  let before: string | undefined;
  for (let page = 0; page < 15; page++) {
    const qs = new URLSearchParams({ limit: "100" });
    if (before) qs.set("before", before);
    const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages?${qs}`, { headers });
    const messages = (await res.json()) as Array<{
      id: string;
      content?: string;
      timestamp?: string;
      embeds?: Array<{ title?: string; description?: string; fields?: Array<{ name: string; value: string }> }>;
    }>;
    if (!Array.isArray(messages) || messages.length === 0) break;
    before = messages[messages.length - 1]?.id;
    let older = false;
    for (const msg of messages) {
      const at = msg.timestamp || new Date().toISOString();
      if (Date.parse(at) < cutoff) {
        older = true;
        continue;
      }
      const fields = fieldMap(msg.embeds?.flatMap((e) => e.fields ?? []) ?? []);
      const blob = [
        msg.content ?? "",
        ...(msg.embeds ?? []).flatMap((e) => [e.title ?? "", e.description ?? ""]),
        ...Object.values(fields),
      ].join(" \n ");
      let parsed = parsePair(blob);
      if (!parsed) {
        const killer = cleanName(fields.killer || fields.attacker || fields.player);
        const victim = cleanName(fields.victim || fields.killed || fields.target);
        if (killer && victim) parsed = { killer, victim, weapon: cleanName(fields.weapon || fields.gun) || undefined, distance: distanceOf(fields.distance || blob) };
      }
      if (!parsed) continue;
      const id = `${at}:${parsed.killer}:${parsed.victim}`.toLowerCase();
      if (seen.has(id)) continue;
      seen.add(id);
      events.push({
        id,
        server: serverFromText(blob),
        killer: parsed.killer,
        victim: parsed.victim,
        weapon: parsed.weapon,
        distance: parsed.distance,
        at,
        raw: blob.slice(0, 240),
      });
    }
    if (older) break;
  }
  events.sort((a, b) => b.at.localeCompare(a.at));
  return events;
}

export const getKillfeed = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { server?: DayZServerId | "all"; limit?: number } = {}) => d)
  .handler(async ({ data }): Promise<KillfeedResult> => {
    const limit = Math.min(Math.max(data.limit ?? 250, 1), 800);
    try {
      let events = await downloadViaDiscord();
      if (data.server && data.server !== "all") events = events.filter((e) => e.server === data.server);
      return { events: events.filter((e) => withinFiveDays(e.at)).slice(0, limit), unavailable: [] };
    } catch (error) {
      return {
        events: [],
        unavailable: [{ server: "101x", reason: error instanceof Error ? error.message : "Discord killfeed read failed", missingEnv: requiredFtpEnv("101x") }],
      };
    }
  });

export const getLiveEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { server?: DayZServerId | "all"; limit?: number } = {}) => d)
  .handler(async ({ data }): Promise<LiveFeedResult> => {
    const feed = await getKillfeed({ data });
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
  return Array.from(new Set(unavailable.flatMap((u) => u.missingEnv ?? [])));
}
