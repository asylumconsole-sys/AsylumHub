import { createFileRoute } from "@tanstack/react-router";
import { requireBridge } from "@/lib/shop/auth.server";
import { bridgeHeartbeat } from "@/lib/shop/orders.server";
import { handle } from "@/lib/shop/mongo.server";

export const Route = createFileRoute("/api/bridge/heartbeat")({
  server: {
    handlers: {
      POST: ({ request }) =>
        handle(async () => {
          requireBridge(request);
          return bridgeHeartbeat(((await request.json().catch(() => ({}))) || {}) as Record<string, unknown>);
        }),
    },
  },
});
