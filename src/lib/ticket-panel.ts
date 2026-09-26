import { discordGet, discordPost } from "@/lib/staff-embed";

type Channel = { id: string; name?: string; type?: number };
type Msg = {
  id: string;
  author?: { bot?: boolean };
  embeds?: Array<{ title?: string; description?: string }>;
  components?: Array<{ type: number; components?: Array<{ type: number; custom_id?: string; options?: Array<{ label?: string; value?: string; description?: string }> }> }>;
};

const API = "https://discord.com/api/v10";
const ONLY = {
  label: "AI Support",
  value: "ai-support",
  description: "Ask PRO AI about rules, raids, players, logs, shop, or status.",
};

function botHeaders() {
  const token = process.env.DISCORD_TOKEN?.replace(/^Bot\s+/i, "");
  if (!token) return null;
  return { Authorization: `Bot ${token}`, "Content-Type": "application/json" };
}

function panelPayload() {
  return {
    content: "",
    embeds: [
      {
        title: "DAYZ PRO \u00b7 Tickets",
        color: 0xd4a84b,
        description: "Open **AI Support**. PRO AI handles raids, shop, accounts, factions, and logs in one place.",
      },
    ],
    components: [
      {
        type: 1,
        components: [
          {
            type: 3,
            custom_id: "ticket_topic",
            placeholder: "AI Support",
            options: [ONLY],
          },
        ],
      },
    ],
  };
}

function isOldPanel(msg: Msg) {
  const text = `${msg.embeds?.[0]?.title || ""} ${msg.embeds?.[0]?.description || ""}`;
  const opts = (msg.components || []).flatMap((r) => r.components || []).flatMap((c) => c.options || []);
  if (opts.some((o) => /raid|shop \/ purchase|account audit|faction help|ai support/i.test(`${o.label} ${o.value}`))) return true;
  return /ai support|ticket/i.test(text) && Boolean(msg.components?.length);
}

export async function slimTicketPanel() {
  const guild = process.env.DISCORD_GUILD_ID;
  const h = botHeaders();
  if (!guild || !h) return { ok: false, error: "no guild or token" };
  const channels = (await discordGet(`/guilds/${guild}/channels`)) as Channel[] | { message?: string };
  if (!Array.isArray(channels)) return { ok: false, error: "no channels", raw: channels };
  const prefer = process.env.DISCORD_TICKET_PANEL_CHANNEL;
  const targets = channels.filter((c) => c.type === 0 || c.type === 5);
  const named = targets.filter((c) => /ticket|support|create-ticket|open-ticket/i.test(c.name || ""));
  const scan = prefer ? targets.filter((c) => c.id === prefer) : named.length ? named : targets.slice(0, 30);
  const deleted: string[] = [];
  let postIn = prefer || named[0]?.id || "";
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
  const posted = await discordPost(`/channels/${postIn}/messages`, panelPayload());
  return { ok: true, deleted, posted: (posted as { id?: string })?.id, channelId: postIn };
}
