import { DAYZ_SERVERS, resolveServiceId } from "@/lib/dayz/servers";
import { loadOnlinePlayers, type OnlinePlayer } from "@/lib/online-players.functions";

const DISCORD_API = "https://discord.com/api/v10";

async function nitradoCount(serverId: "101x" | "102x") {
  const token = process.env.NITRADO_API_TOKEN;
  const catalog = DAYZ_SERVERS.find((s) => s.id === serverId);
  if (!token || !catalog) return { current: 0, max: 50, map: serverId === "102x" ? "Chernarus" : "Livonia" };
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
      map: q?.map || (serverId === "102x" ? "Chernarus" : "Livonia"),
    };
  } catch {
    return { current: 0, max: 50, map: serverId === "102x" ? "Chernarus" : "Livonia" };
  }
}

function embedFor(serverId: "101x" | "102x", count: { current: number; max: number; map: string }, players: OnlinePlayer[]) {
  const names = players.filter((p) => p.server === serverId).map((p) => p.name);
  const listed = names.slice(0, Math.max(count.current, 0));
  const lines =
    listed.length === 0
      ? "Nobody online"
      : listed.map((name, i) => `${i + 1}. ${name}`).join("\n");
  return {
    title: `Online List · ${serverId.toUpperCase()} · ${count.map}`,
    color: listed.length ? 0x22c55e : 0x6b7280,
    fields: [
      { name: count.map, value: `**${count.current} / ${count.max}** players online`, inline: false },
      { name: "Players", value: lines.slice(0, 1024), inline: false },
    ],
    footer: { text: "DAYZ PRO · dayzpro.online · online players only" },
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

export async function repostOnlineEmbed() {
  const channelId = process.env.DISCORD_ONLINE_CHANNEL_ID;
  if (!channelId) throw new Error("DISCORD_ONLINE_CHANNEL_ID missing");
  const [playersResult, s101, s102] = await Promise.all([
    loadOnlinePlayers(),
    nitradoCount("101x"),
    nitradoCount("102x"),
  ]);
  const players = playersResult.players;
  const embeds = [
    embedFor("101x", s101, players),
    embedFor("102x", s102, players),
  ];

  const recent = (await discord(`/channels/${channelId}/messages?limit=20`)) as Array<{
    id: string;
    author?: { bot?: boolean };
    embeds?: Array<{ title?: string }>;
  }>;
  const existing = recent.find((m) => m.author?.bot && m.embeds?.some((e) => /online list/i.test(e.title || "")));
  if (existing) {
    await discord(`/channels/${channelId}/messages/${existing.id}`, {
      method: "PATCH",
      body: JSON.stringify({ embeds }),
    });
    return { ok: true, action: "edited", messageId: existing.id, players: players.map((p) => p.name) };
  }
  const created = (await discord(`/channels/${channelId}/messages`, {
    method: "POST",
    body: JSON.stringify({ embeds }),
  })) as { id: string };
  return { ok: true, action: "posted", messageId: created.id, players: players.map((p) => p.name) };
}
