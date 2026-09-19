import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/discord/client")({
  server: {
    handlers: {
      GET: async () => {
        const clientId = process.env.DISCORD_CLIENT_ID || process.env.VITE_DISCORD_CLIENT_ID || "";
        return Response.json({ clientId: clientId || null });
      },
    },
  },
});
