import { draftTicketReply } from "@/lib/ticket-ai-reply";
import { shouldTicketAiReply } from "@/lib/ticket-ai";
import { discordGet, discordPost } from "@/lib/staff-embed";

type Channel = { id: string; name?: string; parent_id?: string; type?: number };
type Member = { roles?: string[]; user?: { id: string } };
type Role = { id: string; name: string };
type Msg = {
  id: string;
  content?: string;
  author?: { id: string; bot?: boolean; username?: string };
  member?: { roles?: string[] };
  mentions?: Array<{ id: string }>;
  timestamp?: string;
};

const TICKET_PARENT = process.env.DISCORD_TICKET_CATEGORY_ID || "";

function isTicketChannel(ch: Channel) {
  if (ch.type !== 0 && ch.type !== 5) return false;
  if (TICKET_PARENT && ch.parent_id === TICKET_PARENT) return true;
  return /ticket|support|raid|help/i.test(ch.name || "");
}

export async function pollTicketChannels() {
  const guild = process.env.DISCORD_GUILD_ID;
  if (!guild) return { ok: false, error: "no guild" };
  const channels = (await discordGet(`/guilds/${guild}/channels`)) as Channel[] | { message?: string };
  if (!Array.isArray(channels)) return { ok: false, error: (channels as { message?: string }).message || "no channels" };
  const roles = ((await discordGet(`/guilds/${guild}/roles`)) as Role[]) || [];
  const tickets = channels.filter(isTicketChannel).slice(0, 40);
  const posted: Array<{ channel: string; text: string }> = [];
  for (const ch of tickets) {
    const raw = (await discordGet(`/channels/${ch.id}/messages?limit=8`)) as Msg[] | { message?: string };
    if (!Array.isArray(raw) || !raw.length) continue;
    const last = raw[0];
    if (!last?.author || last.author.bot) continue;
    const age = last.timestamp ? Date.now() - Date.parse(last.timestamp) : 0;
    if (age > 20 * 60_000) continue;
    if (raw.some((m) => m.author?.bot && Date.parse(m.timestamp || "") >= Date.parse(last.timestamp || ""))) continue;
    const member = (await discordGet(`/guilds/${guild}/members/${last.author.id}`)) as Member | null;
    const names = roles.filter((r) => member?.roles?.includes(r.id)).map((r) => r.name);
    const allow = shouldTicketAiReply({
      authorRoleIds: member?.roles || last.member?.roles || [],
      authorRoleNames: names,
      content: last.content || "",
      mentionUserIds: (last.mentions || []).map((m) => m.id),
    });
    if (!allow) continue;
    const draft = await draftTicketReply({
      discordId: last.author.id,
      content: last.content || "",
      priorBot: raw.filter((m) => m.author?.bot).map((m) => m.content || ""),
    });
    await discordPost(`/channels/${ch.id}/messages`, { content: draft.text });
    posted.push({ channel: ch.name || ch.id, text: draft.text });
  }
  return { ok: true, scanned: tickets.length, posted };
}
