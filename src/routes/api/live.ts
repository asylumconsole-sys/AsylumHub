import { createFileRoute } from "@tanstack/react-router";
import { getLiveOps, runLiveAction } from "@/lib/live-ops";
import { shoutServerChat } from "@/lib/server-chat-shout";

export const Route = createFileRoute("/api/live")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const say = new URL(request.url).searchParams.get("say");
        if (say) return Response.json(await shoutServerChat(say));
        return Response.json({ ok: true, ops: await getLiveOps() });
      },
      POST: async ({ request }) => {
        const secret = process.env.HUB_BOT_SECRET;
        const header = request.headers.get("x-hub-secret") || "";
        if (secret && header !== secret) return Response.json({ ok: false, error: "auth" }, { status: 401 });
        const body = ((await request.json().catch(() => ({}))) || {}) as Record<string, unknown>;
        const action = String(body.action || "get");
        if (action === "say-chat") {
          return Response.json(await shoutServerChat(String(body.content || "who got beef??")));
        }
        const result = await runLiveAction(action, body);
        return Response.json(result);
      },
    },
  },
});
