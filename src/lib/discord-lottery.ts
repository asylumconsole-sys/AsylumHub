import { discordGet } from "@/lib/staff-embed";

export const LOTTERY_CHANNEL_ID = "1557145808384565278";
const GOLD = 0xc4a35a;
const BANNER = "https://raw.githubusercontent.com/asylumconsole-sys/AsylumHub/main/public/pro%20casino.jpg";
const TICKET = "https://dayzpro.online/api/discord/lottery?view=buy";

export function lotteryBoardPayload() {
  return {
    embeds: [{
      title: "DAYZ PRO  \u00b7  SCRATCH",
      color: GOLD,
      description: [
        "Basic foil. **15,000** credits. No refunds.",
        "The stub prints a mark. Scratch the foil and uncover **all three** icons or the ticket burns.",
        "",
        "Most foil is dust. A few pay reputation. A few pay a voucher. Credits above 10k are scarce. Anything above 20k is a rumor. **500,000** is almost not real."
      ].join("\n"),
      fields: [
        { name: "Ticket", value: "15,000 credits", inline: true },
        { name: "Scratches", value: "5 on a 9-panel foil", inline: true },
        { name: "Claim", value: "Match the mark. All of it.", inline: true }
      ],
      image: { url: BANNER },
      footer: { text: "DayZ Pro  \u00b7  Dunes of Reckoning  \u00b7  scratch it or lose it" }
    }],
    components: [{ type: 1, components: [{ type: 2, style: 5, label: "Buy Lottery Ticket", url: TICKET }] }]
  };
}

export async function publishLotteryBoard(channelId = LOTTERY_CHANNEL_ID) {
  const token = process.env.DISCORD_TOKEN?.replace(/^Bot\s+/i, "") || process.env.DISCORD_BOT_TOKEN?.replace(/^Bot\s+/i, "");
  if (!token || !channelId) return { ok: false, error: "no token/channel" };
  const headers = { Authorization: `Bot ${token}`, "Content-Type": "application/json" };
  const recent = await discordGet(`/channels/${channelId}/messages?limit=20`).catch(() => null) as Array<{ id: string; embeds?: Array<{ title?: string }> }> | null;
  if (Array.isArray(recent)) {
    for (const msg of recent) {
      if ((msg.embeds?.[0]?.title || "").includes("SCRATCH")) {
        await fetch(`https://discord.com/api/v10/channels/${channelId}/messages/${msg.id}`, { method: "DELETE", headers: { Authorization: `Bot ${token}` } }).catch(() => null);
      }
    }
  }
  const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, { method: "POST", headers, body: JSON.stringify(lotteryBoardPayload()) });
  const posted = await res.json().catch(() => ({}));
  return { ok: res.ok, channelId, status: res.status, posted };
}
