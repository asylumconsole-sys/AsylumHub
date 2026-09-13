import { createFileRoute } from "@tanstack/react-router";
import type { HubEventPayload } from "@/lib/hub-events";

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

function authorize(request: Request) {
  const expected = process.env.HUB_BOT_SECRET;
  if (!expected) return false;
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return Boolean(match && match[1] === expected);
}

function isHubEventPayload(value: unknown): value is HubEventPayload {
  if (!value || typeof value !== "object") return false;
  const body = value as Record<string, unknown>;
  const serverId = body.serverId;
  const meta = body.meta;
  return (
    typeof body.type === "string" &&
    body.type.length > 0 &&
    typeof body.playerId === "string" &&
    body.playerId.length > 0 &&
    typeof body.playerName === "string" &&
    body.playerName.length > 0 &&
    (serverId === null || serverId === "101" || serverId === "102") &&
    typeof body.ts === "number" &&
    Number.isFinite(body.ts) &&
    typeof meta === "object" &&
    meta !== null &&
    !Array.isArray(meta)
  );
}

export const Route = createFileRoute("/api/bot/events")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!authorize(request)) return json({ error: "unauthorized" }, 401);

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return json({ error: "invalid JSON body" }, 400);
        }

        if (!isHubEventPayload(body)) return json({ error: "invalid hub event payload" }, 400);
        return json({ ok: true });
      },
    },
  },
});
