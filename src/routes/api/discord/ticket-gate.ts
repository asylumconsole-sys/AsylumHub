import { createFileRoute } from "@tanstack/react-router";

// PRO AI (Discord bot) now owns the ticket panel and ticket replies.
// This endpoint used to (unauthenticated) delete/repost the panel and auto-reply in ticket channels,
// which caused double answers. It is now a no-op kept only so old callers get a clean response.
function authorized(request: Request) {
  const secret = process.env.HUB_BOT_SECRET || "";
  const bearer = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const header = request.headers.get("x-hub-secret") || bearer;
  return Boolean(secret) && header === secret;
}

export const Route = createFileRoute("/api/discord/ticket-gate")({
  server: {
    handlers: {
      GET: async () => Response.json({ ok: true, disabled: true, reason: "PRO AI owns ticket panel and replies" }),
      POST: async ({ request }) => {
        if (!authorized(request)) return Response.json({ ok: false, error: "auth" }, { status: 401 });
        return Response.json({ reply: false, skip: true, reason: "pro-ai-owns-ticket-replies" });
      },
    },
  },
});
