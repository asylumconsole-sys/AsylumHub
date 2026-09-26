export const DISCORD_SESSION_KEY = "asylum-discord-session";

export type DiscordSessionUser = {
  id: string;
  username: string;
  global_name?: string | null;
  email?: string | null;
  avatar?: string | null;
  discriminator?: string | null;
};

export type AppSession = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at: number;
  token_type: string;
  user: {
    id: string;
    email: string;
    app_metadata: { provider: "discord" };
    user_metadata: { name: string; avatar_url?: string | null; username?: string | null };
    aud: "authenticated";
    created_at: string;
    updated_at: string;
    role: "authenticated";
    confirmation_sent_at: string | null;
    email_confirmed_at: string | null;
    last_sign_in_at: string;
    phone: string | null;
    phone_confirmed_at: string | null;
    identities: unknown[];
    factors: unknown[];
  };
};

export function discordCallbackUrl(origin: string) {
  return `${origin.replace(/\/$/, "")}/api/discord/callback`;
}

async function resolveDiscordClientId() {
  const baked =
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_DISCORD_CLIENT_ID) || "";
  if (baked) return baked;
  try {
    const res = await fetch("/api/discord/client", { credentials: "same-origin" });
    if (!res.ok) return "";
    const data = (await res.json()) as { clientId?: string | null };
    return data.clientId || "";
  } catch {
    return "";
  }
}

export async function buildDiscordAuthUrl(redirect = "/dashboard") {
  const clientId = await resolveDiscordClientId();
  if (!clientId) {
    throw new Error("Discord client ID is not configured.");
  }

  const redirectUri = discordCallbackUrl(window.location.origin);
  const state = btoa(JSON.stringify({ redirect, redirectUri, nonce: crypto.randomUUID() }));
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "identify email guilds guilds.members.read",
    state,
    prompt: "consent",
  });
  return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
}

export function createDiscordSessionFromUser(user: DiscordSessionUser, accessToken: string, refreshToken?: string): AppSession {
  const now = Math.floor(Date.now() / 1000);
  const displayName = user.global_name || user.username || "Discord User";
  return {
    access_token: accessToken,
    refresh_token: refreshToken || "discord-refresh-token",
    expires_in: 3600,
    expires_at: now + 3600,
    token_type: "Bearer",
    user: {
      id: user.id,
      email: user.email || `${user.username}@discord.local`,
      app_metadata: { provider: "discord" },
      user_metadata: {
        name: displayName,
        avatar_url: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : null,
        username: user.username,
      },
      aud: "authenticated",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      role: "authenticated",
      confirmation_sent_at: null,
      email_confirmed_at: user.email ? new Date().toISOString() : null,
      last_sign_in_at: new Date().toISOString(),
      phone: null,
      phone_confirmed_at: null,
      identities: [],
      factors: [],
    },
  };
}

/** Start Discord sign-in: SDK flow inside the Discord Activity, normal OAuth redirect in a browser. */
export async function startDiscordLogin(redirect = "/dashboard") {
  const { isDiscordActivity, activitySignIn, activityQuery } = await import("@/lib/discord-activity");
  if (isDiscordActivity()) {
    await activitySignIn();
    const q = activityQuery();
    window.location.replace(`${redirect.startsWith("/") ? redirect : "/tools/item-shop"}${q ? `${redirect.includes("?") ? "&" : "?"}${q}` : ""}`);
    return;
  }
  window.location.href = await buildDiscordAuthUrl(redirect);
}
