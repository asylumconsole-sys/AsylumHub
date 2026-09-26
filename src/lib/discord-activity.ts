// Discord Activity (Embedded App SDK) support: dayzpro.online itself runs inside the PRO AI Activity iframe.
// Discord loads the site at https://<app>.discordsays.com/?frame_id=..&instance_id=..&platform=.. through its proxy
// (URL Mapping root "/" -> dayzpro.online). Every site URL is relative, so API calls go through the same proxy.
import { DISCORD_SESSION_KEY } from "@/lib/discord-login";

export const ACTIVITY_CLIENT_ID = "1546619474994798752";
const PARAMS_KEY = "asylum-activity-params";
const ACTIVITY_PARAMS = ["frame_id", "instance_id", "platform", "guild_id", "channel_id", "location_id", "referrer_id", "custom_id"];

type StoredSession = { access_token: string; user: { id: string } };
let sdkPromise: Promise<import("@discord/embedded-app-sdk").DiscordSDK> | null = null;

/** True when the page is running inside a Discord Activity iframe. */
export function isDiscordActivity(): boolean {
  if (typeof window === "undefined") return false;
  const q = new URLSearchParams(window.location.search);
  if (q.get("frame_id") && q.get("instance_id")) {
    try {
      const keep = new URLSearchParams();
      for (const k of ACTIVITY_PARAMS) if (q.get(k)) keep.set(k, q.get(k)!);
      window.sessionStorage.setItem(PARAMS_KEY, keep.toString());
    } catch {
      /* storage blocked */
    }
    return true;
  }
  if (/\.discordsays\.com$/i.test(window.location.hostname)) return true;
  try {
    return Boolean(window.sessionStorage.getItem(PARAMS_KEY)) && window.top !== window.self;
  } catch {
    return false;
  }
}

/** Query string with the Activity launch params (kept across in-app reloads/redirects). */
export function activityQuery(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.sessionStorage.getItem(PARAMS_KEY) || "";
  } catch {
    return "";
  }
}

function restoreLaunchParams() {
  const q = new URLSearchParams(window.location.search);
  if (q.get("frame_id")) return;
  const saved = new URLSearchParams(activityQuery());
  if (!saved.get("frame_id")) return;
  for (const [k, v] of saved) q.set(k, v);
  window.history.replaceState(window.history.state, "", `${window.location.pathname}?${q.toString()}${window.location.hash}`);
}

async function sdk() {
  if (!sdkPromise) {
    sdkPromise = (async () => {
      restoreLaunchParams();
      const { DiscordSDK } = await import("@discord/embedded-app-sdk");
      const s = new DiscordSDK(ACTIVITY_CLIENT_ID);
      await Promise.race([s.ready(), new Promise((_, rej) => setTimeout(() => rej(new Error("Discord SDK timeout")), 15_000))]);
      return s;
    })();
    sdkPromise.catch(() => (sdkPromise = null));
  }
  return sdkPromise;
}

function storedSession(): StoredSession | null {
  try {
    const s = JSON.parse(window.localStorage.getItem(DISCORD_SESSION_KEY) || "null") as StoredSession | null;
    return s?.access_token && s?.user?.id ? s : null;
  } catch {
    return null;
  }
}

/**
 * Sign in inside the Activity: SDK authorize -> one-time code -> server exchange (secret stays on the server)
 * -> the normal site session (same shape as the browser OAuth callback) stored in localStorage.
 */
export async function activitySignIn(): Promise<StoredSession> {
  const s = await sdk();
  const { code } = await s.commands.authorize({
    client_id: ACTIVITY_CLIENT_ID,
    response_type: "code",
    state: "",
    prompt: "none",
    scope: ["identify", "guilds"],
  });
  const res = await fetch("/api/discord/activity-token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code }),
  });
  const data = (await res.json().catch(() => ({}))) as { session?: StoredSession; error?: string };
  if (!res.ok || !data.session?.access_token) throw new Error(data.error || `token exchange failed (${res.status})`);
  await s.commands.authenticate({ access_token: data.session.access_token }).catch(() => null);
  window.localStorage.setItem(DISCORD_SESSION_KEY, JSON.stringify(data.session));
  return data.session;
}

/** Use the stored session if it is still valid for this Discord user, else run the SDK sign-in. */
export async function ensureActivitySession(): Promise<StoredSession | null> {
  const cur = storedSession();
  if (cur) {
    const ok = await fetch("/api/wallet", { headers: { authorization: `Bearer ${cur.access_token}` } })
      .then((r) => r.status !== 401)
      .catch(() => true);
    if (ok) return cur;
  }
  return activitySignIn();
}
