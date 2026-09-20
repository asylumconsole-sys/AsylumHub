import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/bans-embed")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { postBansEmbed } = await import("@/lib/discord-bans-embed");
          return Response.json(await postBansEmbed());
        } catch (e) {
          return Response.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
        }
      },
      POST: async () => {
        try {
          const { postBansEmbed } = await import("@/lib/discord-bans-embed");
          return Response.json(await postBansEmbed());
        } catch (e) {
          return Response.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
        }
      },
    },
  },
});
