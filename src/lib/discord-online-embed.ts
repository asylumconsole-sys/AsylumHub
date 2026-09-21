import { DAYZ_SERVERS, resolveServiceId } from "@/lib/dayz/servers";
import { isRealPlayerName } from "@/lib/player-name";

const DISCORD_API = "https://discord.com/api/v10";

async function nitradoCount(serverId: "101x" | "102x") {
  const token = process.env.NITRADO_API_TOKEN;
  const catalog = DAYZ_SERVERS.find((s) => s.id === serverId);
  const fallbackMap = serverId === "102x" ? "Chernarus" : "Livonia";
  if (!token || !catalog) return { current: 0, max: 50, map: fallbackMap };
  try {
    const res = await fetch(`https://api.nitrado.net/services/${resolveServiceId(catalog)}/gameservers`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = (await res.json()) as {
      data?: { gameserver?: { query?: { player_current?: number; player_max?: number; map?: string } } };
    };
    const q = json.data?.gameserver?.query;
    return {
      current: q?.player_current ?? 0,
      max: q?.player_max ?? 50,
      map: q?.map || fallbackMap,
    };
  } catch {
    return { current: 0, max: 50, map: fallbackMap };
  }
}

function cleanNames(names: string[], cap: number) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of names) {
    const trimmed = name.trim();
    if (!isRealPlayerName(trimmed)) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
    if (out.length >= cap) break;
  }
  return out;
}

function embedFor(serverId: string, count: { current: number; max: number; map: string }, names: string[]) {
  const list = names.length
    ? names.map((n, i) => `${i + 1}. ${n}`).join("\n").slice(0, 1024)
    : count.current
      ? `${count.current} in-game (names pending live query)`
      : "Nobody online";
  return {
    title: `Online List · ${serverId.toUpperCase()} · ${count.map}`,
    color: count.current ? 0x22c55e : 0x6b7280,
    fields: [
      { name: count.map, value: `**${Math.min(names.length || count.current, count.max)} / ${count.max}** players online`, inline: false },
      { name: "Players", value: list || "Nobody online", inline: false },
    ],
    footer: { text: "DAYZ PRO · players only · no weapons / hits / ammo" },
    timestamp: new Date().toISOString(),
  };
}

async function discord(path: string, init?: RequestInit) {
  const token = process.env.DISCORD_TOKEN;
  if (!token) throw new Error("DISCORD_TOKEN missing on DAYZ PRO");
  const res = await fetch(`${DISCORD_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bot ${token.replace(/^Bot\s+/i, "")}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Discord ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

async function resolveOnlineChannel() {
  const envId = process.env.DISCORD_ONLINE_CHANNEL_ID;
  if (envId) return envId;
  const guild = process.env.DISCORD_GUILD_ID;
  if (!guild) return null;
  const channels = (await discord(`/guilds/${guild}/channels`)) as Array<{ id: string; name?: string }>;
  const hit = channels.find((c) => /online-?1/i.test(c.name || "")) || channels.find((c) => /online/i.test(c.name || ""));
  return hit?.id ?? null;
}

export async function repostOnlineEmbed(names: string[] = []) {
  const channelId = await resolveOnlineChannel();
  if (!channelId) throw new Error("online channel not found");
  const [s101, s102] = await Promise.all([nitradoCount("101x"), nitradoCount("102x")]);
  const names101 = cleanNames(names, s101.current || 30);
  const embeds = [embedFor("101x", s101, names101), embedFor("102x", s102, [])];
  const recent = (await discord(`/channels/${channelId}/messages?limit=30`)) as Array<{
    id: string;
    author?: { bot?: boolean };
    embeds?: Array<{ title?: string; fields?: Array<{ name?: string }> }>;
  }>;
  const existing = recent.filter(
    (m) =>
      m.author?.bot &&
      m.embeds?.some((e) => /online/i.test(e.title || "") || e.fields?.some((f) => /players/i.test(f.name || ""))),
  );
  if (existing[0]) {
    await discord(`/channels/${channelId}/messages/${existing[0].id}`, {
      method: "PATCH",
      body: JSON.stringify({ embeds, components: [] }),
    });
    for (const extra of existing.slice(1)) {
      await discord(`/channels/${channelId}/messages/${extra.id}`, { method: "DELETE" }).catch(() => null);
    }
    return { ok: true, action: "edited", messageId: existing[0].id, names: names101.length, channelId };
  }
  const created = (await discord(`/channels/${channelId}/messages`, {
    method: "POST",
    body: JSON.stringify({ embeds }),
  })) as { id: string };
  return { ok: true, action: "posted", messageId: created.id, names: names101.length, channelId };
}
