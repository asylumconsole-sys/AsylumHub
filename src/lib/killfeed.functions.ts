import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { type DayZServerId } from "@/lib/dayz/servers";

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
  id: string; server: DayZServerId; kind: LiveEventKind; at: string; summary: string;
  actor?: string; target?: string; weapon?: string; distance?: number; raw: string;
};
export type KillfeedResult = { events: KillEvent[]; unavailable: Array<{ server: DayZServerId; reason: string; missingEnv?: string[] }> };
export type LiveFeedResult = { events: LiveEvent[]; unavailable: KillfeedResult["unavailable"] };

const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;
const STOP = new Set(["by","was","with","killed","player","the","a","an","from","and","to","of","in","on","dead","kill","feed"]);

function withinFiveDays(iso: string) {
  const t = Date.parse(iso.replace(" ", "T"));
  return Number.isFinite(t) ? Date.now() - t <= FIVE_DAYS_MS : true;
}
function cleanName(value?: string) {
  if (!value) return null;
  const name = value.replace(/[*_`~]/g, "").replace(/<@!?\d+>/g, "").replace(/\s+/g, " ").trim();
  if (name.length < 2 || name.length > 32) return null;
  if (STOP.has(name.toLowerCase())) return null;
  if (!/[A-Za-z0-9]/.test(name)) return null;
  return name;
}
function distanceOf(text: string) {
  const m = text.match(/(\d+(?:\.\d+)?)\s*(?:m|meters?)\b/i);
  return m ? Number(m[1]) : undefined;
}
function parsePair(text: string) {
  const blob = text.replace(/\n+/g, " ");
  const bolds = [...blob.matchAll(/\*\*([^*]{2,32})\*\*/g)].map((m) => cleanName(m[1])).filter(Boolean) as string[];
  const killedBy = blob.match(/(.{2,40}?)\s+was killed by\s+(.{2,40}?)(?:\s+with\s+(.{2,40}))?/i);
  if (killedBy) {
    const victim = cleanName(killedBy[1].split(/[|•]/).pop());
    const killer = cleanName(killedBy[2].split(/\s+with\s+/i)[0]);
    if (killer && victim) return { killer, victim, weapon: cleanName(killedBy[3] || "") || undefined, distance: distanceOf(blob) };
  }
  if (bolds.length >= 2) {
    const [a, b] = bolds;
    if (/was killed by/i.test(blob)) return { killer: b, victim: a, weapon: bolds[2], distance: distanceOf(blob) };
    if (/killed/i.test(blob)) return { killer: a, victim: b, weapon: bolds[2], distance: distanceOf(blob) };
  }
  const killed = blob.match(/(.{2,40}?)\s+killed\s+(.{2,40}?)(?:\s+with\s+(.{2,40}))?/i);
  if (killed && !/was killed/i.test(blob)) {
    const killer = cleanName(killed[1].split(/[|•]/).pop());
    const victim = cleanName(killed[2].split(/\s+with\s+/i)[0]);
    if (killer && victim) return { killer, victim, weapon: cleanName(killed[3] || "") || undefined, distance: distanceOf(blob) };
  }
  return null;
}
function botHeaders() {
  const token = process.env.DISCORD_TOKEN?.replace(/^Bot\s+/i, "");
  return token ? { Authorization: `Bot ${token}` } : null;
}
async function findKillfeedChannelId(headers: Record<string, string>) {
  if (process.env.DISCORD_KILLFEED_CHANNEL_ID) return process.env.DISCORD_KILLFEED_CHANNEL_ID;
  const guilds = (await (await fetch("https://discord.com/api/v10/users/@me/guilds", { headers })).json()) as Array<{ id: string }>;
  if (!Array.isArray(guilds)) return null;
  for (const guild of guilds) {
    const channels = (await (await fetch(`https://discord.com/api/v10/guilds/${guild.id}/channels`, { headers })).json()) as Array<{ id: string; name?: string }>;
    if (!Array.isArray(channels)) continue;
    const hit = channels.find((c) => /kill/i.test(c.name ?? ""));
    if (hit) return hit.id;
  }
  return null;
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
    const messages = (await (await fetch(`https://discord.com/api/v10/channels/${channelId}/messages?${qs}`, { headers })).json()) as Array<{
      id: string; content?: string; timestamp?: string;
      embeds?: Array<{ title?: string; description?: string; fields?: Array<{ name: string; value: string }> }>;
    }>;
    if (!Array.isArray(messages) || !messages.length) break;
    before = messages[messages.length - 1]?.id;
    let older = false;
    for (const msg of messages) {
      const at = msg.timestamp || new Date().toISOString();
      if (Date.parse(at) < cutoff) { older = true; continue; }
      const fields = Object.fromEntries((msg.embeds ?? []).flatMap((e) => (e.fields ?? []).map((f) => [f.name.toLowerCase(), f.value])));
      const blob = [msg.content ?? "", ...(msg.embeds ?? []).flatMap((e) => [e.title ?? "", e.description ?? ""]), ...Object.values(fields)].join(" \n ");
      let parsed = parsePair(blob);
      if (!parsed) {
        const killer = cleanName(fields.killer || fields.attacker);
        const victim = cleanName(fields.victim || fields.killed);
        if (killer && victim) parsed = { killer, victim, weapon: cleanName(fields.weapon), distance: distanceOf(fields.distance || blob) };
      }
      if (!parsed) continue;
      const id = `${at}:${parsed.killer}:${parsed.victim}`.toLowerCase();
      if (seen.has(id)) continue;
      seen.add(id);
      events.push({ id, server: /102x|chernarus/i.test(blob) ? "102x" : "101x", killer: parsed.killer, victim: parsed.victim, weapon: parsed.weapon, distance: parsed.distance, at, raw: blob.slice(0, 240) });
    }
    if (older) break;
  }
  return events.sort((a, b) => b.at.localeCompare(a.at));
}
export const getKillfeed = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).inputValidator((d: { server?: DayZServerId | "all"; limit?: number } = {}) => d).handler(async ({ data }): Promise<KillfeedResult> => {
  const limit = Math.min(Math.max(data.limit ?? 250, 1), 800);
  let events = await downloadViaDiscord();
  if (data.server && data.server !== "all") events = events.filter((e) => e.server === data.server);
  return { events: events.filter((e) => withinFiveDays(e.at)).slice(0, limit), unavailable: [] };
});
export const getLiveEvents = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).inputValidator((d: { server?: DayZServerId | "all"; limit?: number } = {}) => d).handler(async ({ data }): Promise<LiveFeedResult> => {
  const feed = await getKillfeed({ data });
  return { events: feed.events.map((kill) => ({ id: `live:${kill.id}`, server: kill.server, kind: "kill" as const, at: kill.at, summary: `${kill.killer} killed ${kill.victim}`, actor: kill.killer, target: kill.victim, weapon: kill.weapon, distance: kill.distance, raw: kill.raw })), unavailable: feed.unavailable };
});
export function killfeedMissingEnvSummary(unavailable: KillfeedResult["unavailable"]) {
  return Array.from(new Set(unavailable.flatMap((u) => u.missingEnv ?? [])));
}
