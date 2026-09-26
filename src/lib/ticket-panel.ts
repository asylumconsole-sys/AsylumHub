import { discordGet, discordPost } from "@/lib/staff-embed";

type Channel = { id: string; name?: string; type?: number };
type Msg = {
  id: string;
  embeds?: Array<{ title?: string; description?: string }>;
  components?: Array<{ type: number; components?: Array<{ type: number; options?: Array<{ label?: string; value?: string }> }> }>;
};

export type PanelCopy = {
  title: string;
  description: string;
  options: Array<{ label: string; value: string; description: string }>;
  image?: string;
  thumbnail?: string;
};

const API = "https://discord.com/api/v10";
const HUB = "https://dayzpro.online";
const DEFAULT_PANEL: PanelCopy = {
  title: "DAYZ PRO \u00b7 AI Support",
  description: [
    "Talk to **PRO AI** in a private ticket.",
    "",
    "**What it can do**",
    "\u2022 Raids / base gone \u2014 pulls linked PSN + 101/102 ADM",
    "\u2022 Shop, credits, NPC / vehicle / base buys",
    "\u2022 Linked accounts and Hub profile",
    "\u2022 Factions, rules, server status",
    "",
    "**How**",
    "Pick **AI Support** below. A private channel opens. Type normally \u2014 no form.",
    "Hub: https://dayzpro.online",
  ].join("\n"),
  image: `${HUB}/baseops.jpg`,
  thumbnail: `${HUB}/favicon.png`,
  options: [
    {
      label: "AI Support",
      value: "ai-support",
      description: "Raids, shop, accounts, factions, logs \u2014 one ticket.",
    },
  ],
};

function botHeaders() {
  const token = process.env.DISCORD_TOKEN?.replace(/^Bot\s+/i, "");
  if (!token) return null;
  return { Authorization: `Bot ${token}`, "Content-Type": "application/json" };
}

function panelPayload(copy: PanelCopy) {
  return {
    embeds: [
      {
        title: copy.title,
        color: 0xd4a84b,
        description: copy.description,
        thumbnail: copy.thumbnail ? { url: copy.thumbnail } : undefined,
        image: copy.image ? { url: copy.image } : undefined,
        footer: { text: "DAYZ PRO \u00b7 PRO AI" },
      },
    ],
    components: [
      {
        type: 1,
        components: [
          {
            type: 3,
            custom_id: "ticket_topic",
            placeholder: copy.options[0]?.label || "AI Support",
            options: copy.options.slice(0, 25),
          },
        ],
      },
    ],
  };
}

function isOldPanel(msg: Msg) {
  const text = `${msg.embeds?.[0]?.title || ""} ${msg.embeds?.[0]?.description || ""}`;
  const opts = (msg.components || []).flatMap((r) => r.components || []).flatMap((c) => c.options || []);
  if (opts.some((o) => /raid|shop|account audit|faction|ai support|ticket/i.test(`${o.label} ${o.value}`))) return true;
  return /ai support|ticket/i.test(text) && Boolean(msg.components?.length);
}

export async function slimTicketPanel(copy: PanelCopy = DEFAULT_PANEL) {
  const guild = process.env.DISCORD_GUILD_ID;
  const h = botHeaders();
  if (!guild || !h) return { ok: false, error: "no guild or token" };
  const channels = (await discordGet(`/guilds/${guild}/channels`)) as Channel[] | { message?: string };
  if (!Array.isArray(channels)) return { ok: false, error: "no channels", raw: channels };
  const prefer = process.env.DISCORD_TICKET_PANEL_CHANNEL || "1371151486527995995";
  const targets = channels.filter((c) => c.type === 0 || c.type === 5);
  const named = targets.filter((c) => c.id === prefer || /ticket|support|create-ticket|open-ticket/i.test(c.name || ""));
  const scan = named.length ? named : targets.slice(0, 20);
  const deleted: string[] = [];
  let postIn = prefer;
  for (const ch of scan) {
    const raw = (await discordGet(`/channels/${ch.id}/messages?limit=30`)) as Msg[] | { message?: string };
    if (!Array.isArray(raw)) continue;
    for (const msg of raw) {
      if (!isOldPanel(msg)) continue;
      postIn = postIn || ch.id;
      await fetch(`${API}/channels/${ch.id}/messages/${msg.id}`, { method: "DELETE", headers: h });
      deleted.push(`${ch.name || ch.id}:${msg.id}`);
    }
  }
  if (!postIn) return { ok: false, error: "no ticket channel", deleted };
  const posted = await discordPost(`/channels/${postIn}/messages`, panelPayload(copy));
  return { ok: true, deleted, posted, channelId: postIn };
}
