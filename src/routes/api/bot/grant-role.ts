import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/bot/grant-role")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => null)) as { discordUserId?: string; key?: string } | null;
        if (!body?.discordUserId || !body.key) return Response.json({ error: "discordUserId and key required" }, { status: 400 });
        try {
          const { grantEarnRole } = await import("@/lib/discord-earn-roles");
          return Response.json(await grantEarnRole(body.discordUserId, body.key));
        } catch (e) {
          return Response.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
        }
      },
    },
  },
});
