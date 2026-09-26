import { createFileRoute } from "@tanstack/react-router";
import { createDiscordSessionFromUser } from "@/lib/discord-login";

// Discord Activity sign-in: the Embedded App SDK returns a one-time OAuth code; exchange it here so the client
// secret never leaves the server, then hand back the same session shape the browser OAuth callback creates.
const hits = new Map<string, number[]>();
function limited(request: Request) {
  const ip = (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "anon";
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > 20;
}

export const Route = createFileRoute("/api/discord/activity-token")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (limited(request)) return Response.json({ error: "rate_limited" }, { status: 429 });
        const body = ((await request.json().catch(() => ({}))) || {}) as { code?: unknown };
        const code = typeof body.code === "string" ? body.code.trim() : "";
        if (!/^[A-Za-z0-9]{10,100}$/.test(code)) return Response.json({ error: "invalid_code" }, { status: 400 });
        const clientId = process.env.DISCORD_CLIENT_ID || "1546619474994798752";
        const clientSecret = process.env.DISCORD_CLIENT_SECRET;
        if (!clientSecret) return Response.json({ error: "not_configured" }, { status: 503 });
        const tokenRes = await fetch("https://discord.com/api/v10/oauth2/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: "authorization_code", code }),
          signal: AbortSignal.timeout(8000),
        }).catch(() => null);
        if (!tokenRes) return Response.json({ error: "upstream_error" }, { status: 502 });
        const tok = (await tokenRes.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; error?: string };
        if (!tokenRes.ok || !tok.access_token) {
          console.warn("[activity] token exchange failed", tokenRes.status, tok.error || "");
          return Response.json({ error: tok.error || "exchange_failed" }, { status: 400 });
        }
        const userRes = await fetch("https://discord.com/api/v10/users/@me", {
          headers: { Authorization: `Bearer ${tok.access_token}` },
          signal: AbortSignal.timeout(6000),
        }).catch(() => null);
        if (!userRes?.ok) return Response.json({ error: "user_fetch_failed" }, { status: 502 });
        const user = (await userRes.json()) as { id: string; username: string; global_name?: string | null; email?: string | null; avatar?: string | null };
        const session = createDiscordSessionFromUser(user, tok.access_token, tok.refresh_token);
        return Response.json({ session }, { headers: { "cache-control": "no-store" } });
      },
    },
  },
});
