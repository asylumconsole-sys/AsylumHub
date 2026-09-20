import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/discord/interactions")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => null)) as {
          type?: number;
          data?: { custom_id?: string; values?: string[] };
        } | null;
        if (!body) return Response.json({ error: "bad json" }, { status: 400 });
        if (body.type === 1) return Response.json({ type: 1 });
        if (body.type === 3 && body.data?.custom_id === "ban_pick") {
          const id = body.data.values?.[0];
          const { banDetailResponse } = await import("@/lib/discord-bans-embed");
          const payload = await banDetailResponse(id || "");
          return Response.json({ type: 4, data: { ...payload, flags: 64 } });
        }
        return Response.json({ type: 4, data: { content: "Unknown action", flags: 64 } });
      },
    },
  },
});
