import { STAFF_RULES } from "@/lib/staff-allowance";

const API = "https://discord.com/api/v10";
export const STAFF_CHANNEL_ID = process.env.DISCORD_STAFF_CHANNEL_ID || "1371740737707966585";
const HUB = "https://dayzpro.online";

function headers() {
  const token = process.env.DISCORD_TOKEN?.replace(/^Bot\s+/i, "");
  if (!token) return null;
  return { Authorization: `Bot ${token}`, "Content-Type": "application/json" };
}

function oauthLink(kind: "claim" | "promo") {
  const clientId = process.env.DISCORD_CLIENT_ID || process.env.VITE_DISCORD_CLIENT_ID || "";
  const redirectUri = `${HUB}/api/discord/callback`;
  const state = Buffer.from(
    JSON.stringify({ redirect: `/api/discord/interactions?action=staff_done&kind=${kind}`, redirectUri }),
  ).toString("base64");
  const fallback = `${HUB}/api/discord/interactions?action=staff_done&kind=${kind}`;
  if (!clientId) return fallback;
  return `https://discord.com/oauth2/authorize?${new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "identify",
    state,
  }).toString()}`;
}

export function staffBoardPayload() {
  return {
    content: "Tap a button — it opens login, then pays or files the rank-up.",
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
          { type: 2, style: 5, label: "Claim monthly pay", url: oauthLink("claim") },
          { type: 2, style: 5, label: "Request higher role", url: oauthLink("promo") },
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
  if (Array.isArray(recent)) {
    for (const msg of recent.filter((m) => m.author?.bot && m.embeds?.some((e) => /staff/i.test(e.title || "")))) {
      await fetch(`${API}/channels/${channelId}/messages/${msg.id}`, { method: "DELETE", headers: h });
    }
  }
  const created = await fetch(`${API}/channels/${channelId}/messages`, {
    method: "POST",
    headers: h,
    body: JSON.stringify(body),
  });
  const msg = (await created.json()) as { id?: string; message?: string };
  return { ok: created.ok, action: "posted", messageId: msg.id, channelId, error: msg.message, status: created.status, url: oauthLink("claim").slice(0, 80) };
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

export async function discordPatch(path: string, body: unknown) {
  const h = headers();
  if (!h) return null;
  const res = await fetch(`${API}${path}`, { method: "PATCH", headers: h, body: JSON.stringify(body) });
  return res.json();
}
