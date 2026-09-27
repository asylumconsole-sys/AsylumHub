import { discordGet, discordPost } from "@/lib/staff-embed";

type Channel = { id: string; name?: string; type?: number };

export async function shoutServerChat(text: string) {
  const guild = process.env.DISCORD_GUILD_ID;
  const pinned = [process.env.CHANNEL_SERVER_CHAT_1, process.env.CHANNEL_SERVER_CHAT_2, process.env.DISCORD_SERVER_CHAT_CHANNEL].filter(
    (id): id is string => Boolean(id),
  );
  const posted: Array<{ id: string; name?: string; result?: unknown }> = [];
  const targets = new Set(pinned);
  if (guild) {
    const channels = (await discordGet(`/guilds/${guild}/channels`)) as Channel[] | { message?: string };
    if (Array.isArray(channels)) {
      for (const ch of channels) {
        if (ch.type !== 0 && ch.type !== 5) continue;
        if (/server[\s_-]*chat|ingame[\s_-]*chat|101x|102x/i.test(ch.name || "") && /chat/i.test(ch.name || "")) {
          targets.add(ch.id);
          posted.push({ id: ch.id, name: ch.name });
        }
      }
    }
  }
  const ids = [...targets];
  if (!ids.length) return { ok: false, error: "no server-chat channel", posted };
  const results = [];
  for (const id of ids) {
    const result = await discordPost(`/channels/${id}/messages`, { content: text });
    results.push({ id, result });
  }
  return { ok: true, text, results };
}
