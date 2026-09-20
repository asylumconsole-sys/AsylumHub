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

const LINE_PATTERNS: RegExp[] = [
  /\*\*([^*]+)\*\*\s+(?:killed|eliminated|downed)\s+\*\*([^*]+)\*\*(?:\s+with\s+\*\*([^*]+)\*\*)?/i,
  /([A-Za-z0-9_\-.\[\]]{2,32})\s+(?:killed|eliminated|downed)\s+([A-Za-z0-9_\-.\[\]]{2,32})(?:\s+with\s+([A-Za-z0-9_\-]+))?/i,
  /Player\s+["']([^"']+)["'].*killed by\s+(?:Player\s+)?["']([^"']+)["']/i,
];

function withinFiveDays(iso: string) {
  const t = Date.parse(iso.replace(" ", "T"));
  if (!Number.isFinite(t)) return true;
  return Date.now() - t <= FIVE_DAYS_MS;
}

function botHeaders() {
  const token = process.env.DISCORD_TOKEN?.replace(/^Bot\s+/i, "");
  if (!token) return null;
  return { Authorization: `Bot ${token}` };
}

function parseText(text: string): { killer: string; victim: string; weapon?: string } | null {
  const cleaned = text.replace(/<@!?\d+>/g, "").replace(/\n+/g, " ");
  for (const pattern of LINE_PATTERNS) {
    const m = cleaned.match(pattern);
    if (!m) continue;
    let killer = m[1]?.trim();
    let victim = m[2]?.trim();
    if (/killed by/i.test(cleaned)) {
      victim = m[1]?.trim();
      killer = m[2]?.trim();
    }
    if (!killer || !victim || killer.toLowerCase() === victim.toLowerCase()) continue;
    return { killer, victim, weapon: m[3]?.trim() };
  }
  return null;
}

function serverFromText(text: string): DayZServerId {
  return /102x|chernarus/i.test(text) ? "102x" : "101x";
}

async function findKillfeedChannelId(headers: Record<string, string>): Promise<string | null> {
  if (process.env.DISCORD_KILLFEED_CHANNEL_ID) return process.env.DISCORD_KILLFEED_CHANNEL_ID;
  const guilds = (await (await fetch("https://discord.com/api/v10/users/@me/guilds", { headers })).json()) as Array<{ id: string }>;
  const guildId = process.env.DISCORD_GUILD_ID || guilds?.[0]?.id;
  if (!guildId) return null;
  const channels = (await (await fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, { headers })).json()) as Array<{ id: string; name?: string; type: number }>;
  if (!Array.isArray(channels)) return null;
  const hit = channels.find((c) => /kill\s*-?feed|kills/i.test(c.name ?? ""));
  return hit?.id ?? null;
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
      const chunks = [msg.content ?? ""];
      for (const embed of msg.embeds ?? []) {
        chunks.push(`${embed.title ?? ""} ${embed.description ?? ""}`);
        for (const field of embed.fields ?? []) chunks.push(`${field.name} ${field.value}`);
      }
      const blob = chunks.join(" \n ");
      const parsed = parseText(blob);
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
        unavailable: [
          {
            server: "101x",
            reason: error instanceof Error ? error.message : "Discord killfeed read failed",
            missingEnv: requiredFtpEnv("101x"),
          },
        ],
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
