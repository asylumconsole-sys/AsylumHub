import { STAFF_RULES } from "@/lib/staff-allowance";

const API = "https://discord.com/api/v10";
export const STAFF_CHANNEL_ID = process.env.DISCORD_STAFF_CHANNEL_ID || "1371740737707966585";

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
  return override || STAFF_CHANNEL_ID;
}

export async function publishStaffBoard(override?: string | null) {
  const h = headers();
  const channelId = await resolveStaffChannel(override);
  if (!h || !channelId) return { ok: false, error: "no staff channel or token", channelId };
  const body = staffBoardPayload();
  const recentRes = await fetch(`${API}/channels/${channelId}/messages?limit=30`, { headers: h });
  const recent = (await recentRes.json()) as Array<{ id: string; author?: { bot?: boolean }; embeds?: Array<{ title?: string }> }>;
  const existing = Array.isArray(recent)
    ? recent.find((m) => m.author?.bot && m.embeds?.some((e) => /staff/i.test(e.title || "")))
    : null;
  if (existing) {
    const edit = await fetch(`${API}/channels/${channelId}/messages/${existing.id}`, {
      method: "PATCH",
      headers: h,
      body: JSON.stringify(body),
    });
    return { ok: edit.ok, action: "edited", messageId: existing.id, channelId, status: edit.status };
  }
  const created = await fetch(`${API}/channels/${channelId}/messages`, {
    method: "POST",
    headers: h,
    body: JSON.stringify(body),
  });
  const msg = (await created.json()) as { id?: string; message?: string };
  return { ok: created.ok, action: "posted", messageId: msg.id, channelId, error: msg.message, status: created.status };
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
