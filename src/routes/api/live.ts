import { createFileRoute } from "@tanstack/react-router";
import { getLiveOps, runLiveAction } from "@/lib/live-ops";

export const Route = createFileRoute("/api/live")({
  server: {
    handlers: {
      GET: async () => Response.json({ ok: true, ops: await getLiveOps() }),
      POST: async ({ request }) => {
        const secret = process.env.HUB_BOT_SECRET;
        const header = request.headers.get("x-hub-secret") || "";
        if (secret && header !== secret) return Response.json({ ok: false, error: "auth" }, { status: 401 });
        const body = ((await request.json().catch(() => ({}))) || {}) as Record<string, unknown>;
        const action = String(body.action || "get");
        const result = await runLiveAction(action, body);
        return Response.json(result);
      },
    },
  },
});
