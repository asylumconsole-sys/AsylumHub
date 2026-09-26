import { discordGet, discordPatch } from "@/lib/staff-embed";

type Channel = { id: string; name?: string; type?: number };
type Msg = {
  id: string;
  content?: string;
  embeds?: Array<{ title?: string; description?: string }>;
  components?: Array<{ type: number; components?: Array<{ type: number; custom_id?: string; options?: Array<{ label?: string; value?: string; description?: string }> }> }>;
};

const ONLY = {
  label: "AI Support",
  value: "ai-support",
  description: "Ask PRO AI about rules, raids, players, logs, shop, or status.",
};

export async function slimTicketPanel() {
  const guild = process.env.DISCORD_GUILD_ID;
  if (!guild) return { ok: false, error: "no guild" };
  const channels = (await discordGet(`/guilds/${guild}/channels`)) as Channel[] | { message?: string };
  if (!Array.isArray(channels)) return { ok: false, error: "no channels" };
  const edited: string[] = [];
  for (const ch of channels.filter((c) => c.type === 0 || c.type === 5).slice(0, 80)) {
    const raw = (await discordGet(`/channels/${ch.id}/messages?limit=20`)) as Msg[] | { message?: string };
    if (!Array.isArray(raw)) continue;
    for (const msg of raw) {
      const menus = (msg.components || []).flatMap((row) => row.components || []).filter((c) => c.type === 3 && (c.options || []).length);
      const hit = menus.find((m) => (m.options || []).some((o) => /raid|shop \/ purchase|account audit|faction help/i.test(`${o.label} ${o.value}`)));
      if (!hit) continue;
      const next = (msg.components || []).map((row) => ({
        ...row,
        components: (row.components || []).map((c) =>
          c.type === 3 ? { ...c, options: [ONLY], placeholder: "AI Support" } : c,
        ),
      }));
      await discordPatch(`/channels/${ch.id}/messages/${msg.id}`, { components: next });
      edited.push(`${ch.name || ch.id}:${msg.id}`);
    }
  }
  return { ok: true, edited };
}
