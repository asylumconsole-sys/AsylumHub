import { discordPost } from "@/lib/staff-embed";

const CHANNEL = "1371150773857288324";
const HUB = "https://dayzpro.online";

export async function publishWipeAnnounce() {
  const wipeAt = Math.floor(Date.now() / 1000) + 60 * 60;
  const donateUntil = Math.floor(Date.now() / 1000) + 48 * 60 * 60;
  const body = {
    content: [
      "@everyone",
      "",
      "**SERVER WIPE**",
      "",
      "Custom base owners get **500,000 CR**",
      "Stick base owners get **50,000 CR**",
    ].join("\n"),
    allowed_mentions: { parse: ["everyone", "users"] },
    embeds: [
      {
        title: "WIPE  ·  500,000 CR  /  50,000 CR",
        color: 0xff2a2a,
        description: [
          "**THIS IS A FULL WIPE**",
          "",
          `Livonia resets  <t:${wipeAt}:R>`,
          `<t:${wipeAt}:F>`,
          "",
          "**PAYOUTS AFTER WIPE**",
          "",
          "**CUSTOM BASE**",
          "# 500,000 CR",
          "Five hundred thousand credits.",
          "",
          "**STICK BASE**",
          "# 50,000 CR",
          "Fifty thousand credits.",
          "",
          "**DONATE $20+ IN 48 HOURS**",
          "# +150,000 CR extra",
          `Window closes  <t:${donateUntil}:R>`,
          `<t:${donateUntil}:F>`,
          "",
          "**NEW CUSTOM BASE**",
          "@junior.gg will build it.",
          "Open a ticket and drop the brief.",
          "",
          "**WHAT STAYS**",
          "Hub credits after payout · Discord roles · linked PSN · faction records",
          "",
          "**WHAT GETS WIPED**",
          "The map · loot · unregistered builds · unlocked vehicles · field stashes",
        ].join("\n"),
        fields: [
          { name: "CUSTOM BASE", value: "**500,000 CR**", inline: true },
          { name: "STICK BASE", value: "**50,000 CR**", inline: true },
          { name: "$20+ DONATE", value: "**+150,000 CR**", inline: true },
          { name: "WIPE", value: `<t:${wipeAt}:R>`, inline: true },
          { name: "DONATE WINDOW", value: `<t:${donateUntil}:R>`, inline: true },
        ],
        footer: { text: "DAYZ PRO  ·  WIPE" },
        timestamp: new Date().toISOString(),
      },
    ],
    components: [
      {
        type: 1,
        components: [
          { type: 2, style: 5, label: "Donate $20+", url: `${HUB}/dashboard` },
          { type: 2, style: 5, label: "Open hub", url: HUB },
        ],
      },
    ],
  };
  const msg = (await discordPost(`/channels/${CHANNEL}/messages`, body)) as { id?: string; message?: string } | null;
  return { ok: Boolean(msg?.id), messageId: msg?.id, channelId: CHANNEL, error: msg?.message, wipeAt, donateUntil };
}
