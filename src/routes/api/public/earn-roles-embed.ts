import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/earn-roles-embed")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { postEarnRolesEmbed } = await import("@/lib/discord-earn-roles");
          return Response.json(await postEarnRolesEmbed());
        } catch (e) {
          return Response.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
        }
      },
    },
  },
});
