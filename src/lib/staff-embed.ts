import { STAFF_RULES } from "@/lib/staff-allowance";

const API = "https://discord.com/api/v10";

function headers() {
  const token = process.env.DISCORD_TOKEN?.replace(/^Bot\s+/i, "");
  if (!token) return null;
  return { Authorization: `Bot ${token}`, "Content-Type": "application/json" };
}

export function staffBoardPayload() {
  return {
    content: "",
    embeds: [
      {
        title: "DAYZ PRO · Staff",
        color: 0xd4a84b,
        description: [
          "**Monthly pay**",
          "Moderator `25,000` · Admin `50,000` · Financier `75,000` · Co Owner `150,000`",
          "",
          "**Rules**",
          STAFF_RULES,
          "",
          "Promote: Mod→Admin 1 month · Admin→Financier 2 months · Financier→Co Owner 1 year.",
          "Co Owners must approve every rank-up.",
        ].join("\n"),
      },
    ],
    components: [
      {
        type: 1,
        components: [
          { type: 2, style: 3, label: "Claim monthly pay", custom_id: "staff_claim" },
          { type: 2, style: 1, label: "Request higher role", custom_id: "staff_promo" },
        ],
      },
    ],
  };
}

export async function resolveStaffChannel(override?: string | null) {
  if (override) return override;
  if (process.env.DISCORD_STAFF_CHANNEL_ID) return process.env.DISCORD_STAFF_CHANNEL_ID;
  const h = headers();
  if (!h) return null;
  const guildIds = [process.env.DISCORD_GUILD_ID].filter(Boolean) as string[];
  if (!guildIds.length) {
    const guilds = (await (await fetch(`${API}/users/@me/guilds`, { headers: h })).json()) as Array<{ id: string }>;
    if (Array.isArray(guilds)) guildIds.push(...guilds.map((g) => g.id));
  }
  for (const guild of guildIds) {
    const channels = (await (await fetch(`${API}/guilds/${guild}/channels`, { headers: h })).json()) as Array<{ id: string; name?: string }>;
    if (!Array.isArray(channels)) continue;
    const hit =
      channels.find((c) => /staff[-_ ]?(intro|info|hub)/i.test(c.name || "")) ||
      channels.find((c) => /^staff$/i.test(c.name || "")) ||
      channels.find((c) => /staff/i.test(c.name || ""));
    if (hit) return hit.id;
  }
  return null;
}

export async function publishStaffBoard(override?: string | null) {
  const h = headers();
  const channelId = await resolveStaffChannel(override);
  if (!h || !channelId) return { ok: false, error: "no staff channel or token", channelId };
  const body = staffBoardPayload();
  const recent = (await (await fetch(`${API}/channels/${channelId}/messages?limit=30`, { headers: h })).json()) as Array<{
    id: string;
    author?: { bot?: boolean };
    embeds?: Array<{ title?: string }>;
  }>;
  const existing = Array.isArray(recent)
    ? recent.find((m) => m.author?.bot && m.embeds?.some((e) => /staff/i.test(e.title || "")))
    : null;
  if (existing) {
    const edit = await fetch(`${API}/channels/${channelId}/messages/${existing.id}`, {
      method: "PATCH",
      headers: h,
      body: JSON.stringify(body),
    });
    return { ok: edit.ok, action: "edited", messageId: existing.id, channelId };
  }
  const created = await fetch(`${API}/channels/${channelId}/messages`, {
    method: "POST",
    headers: h,
    body: JSON.stringify(body),
  });
  const msg = (await created.json()) as { id?: string; message?: string };
  return { ok: created.ok, action: "posted", messageId: msg.id, channelId, error: msg.message };
}

export async function discordGet(path: string) {
  const h = headers();
  if (!h) return null;
  const res = await fetch(`${API}${path}`, { headers: h });
  return res.json();
}

export async function discordPost(path: string, body: unknown) {
  const h = headers();
  if (!h) return null;
  const res = await fetch(`${API}${path}`, { method: "POST", headers: h, body: JSON.stringify(body) });
  return res.json();
}
