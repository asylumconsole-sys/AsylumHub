import { discordGet } from "@/lib/staff-embed";

export const LOTTERY_CHANNEL_ID = "1557145808384565278";

export async function publishLotteryBoard(channelId = LOTTERY_CHANNEL_ID) {
  const token = process.env.DISCORD_TOKEN?.replace(/^Bot\s+/i, "") || process.env.DISCORD_BOT_TOKEN?.replace(/^Bot\s+/i, "");
  if (!token || !channelId) return { ok: false, error: "no token/channel" };
  const recent = await discordGet(`/channels/${channelId}/messages?limit=30`).catch(() => null) as Array<{ id: string; embeds?: Array<{ title?: string }> }> | null;
  const removed: string[] = [];
  if (Array.isArray(recent)) {
    for (const msg of recent) {
      if ((msg.embeds?.[0]?.title || "").includes("SCRATCH")) {
        const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages/${msg.id}`, { method: "DELETE", headers: { Authorization: `Bot ${token}` } });
        if (res.ok) removed.push(msg.id);
      }
    }
  }
  return { ok: true, channelId, removed };
}
