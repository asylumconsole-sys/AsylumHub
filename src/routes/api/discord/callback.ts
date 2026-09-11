import { createFileRoute } from "@tanstack/react-router";
import { createDiscordSessionFromUser, DISCORD_SESSION_KEY, discordCallbackUrl } from "@/lib/discord-login";

export const Route = createFileRoute("/api/discord/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const redirect = (() => {
          try {
            if (!state) return "/dashboard";
            const payload = JSON.parse(atob(state));
            return typeof payload.redirect === "string" ? payload.redirect : "/dashboard";
          } catch {
            return "/dashboard";
          }
        })();

        if (!code) {
          return Response.redirect(new URL(`/login?error=missing_code`, request.url), 302);
        }

        const clientId = process.env.DISCORD_CLIENT_ID;
        const clientSecret = process.env.DISCORD_CLIENT_SECRET;
        if (!clientId || !clientSecret) {
          return Response.redirect(new URL(`/login?error=discord_not_configured`, request.url), 302);
        }

        const redirectUri = discordCallbackUrl(url.origin);
        const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
          },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            code,
            redirect_uri: redirectUri,
          }),
        });

        if (!tokenRes.ok) {
          return Response.redirect(new URL(`/login?error=token_exchange_failed`, request.url), 302);
        }

        const tokenJson = (await tokenRes.json()) as {
          access_token?: string;
          refresh_token?: string;
        };
        const accessToken = tokenJson.access_token;
        if (!accessToken) {
          return Response.redirect(new URL(`/login?error=missing_access_token`, request.url), 302);
        }

        const userRes = await fetch("https://discord.com/api/v10/users/@me", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        if (!userRes.ok) {
          return Response.redirect(new URL(`/login?error=user_fetch_failed`, request.url), 302);
        }

        const user = (await userRes.json()) as {
          id: string;
          username: string;
          global_name?: string | null;
          email?: string | null;
          avatar?: string | null;
          discriminator?: string | null;
        };

        const session = createDiscordSessionFromUser(user, accessToken, tokenJson.refresh_token);
        const destination = new URL(redirect.startsWith("/") ? redirect : "/dashboard", request.url);
        destination.searchParams.set("discord_session", encodeURIComponent(JSON.stringify(session)));
        void DISCORD_SESSION_KEY;
        return Response.redirect(destination, 302);
      },
    },
  },
});
