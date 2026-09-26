import { createFileRoute } from "@tanstack/react-router";
import { requireBridge } from "@/lib/shop/auth.server";
import { bridgePending, bridgeReport } from "@/lib/shop/orders.server";
import { handle } from "@/lib/shop/mongo.server";

// Box scheduler pull. GET = open orders to queue/track · POST {orderId,state,intents?,scheduledFor?,note?,error?} = status report.
export const Route = createFileRoute("/api/bridge/orders")({
  server: {
    handlers: {
      GET: ({ request }) => handle(async () => (requireBridge(request), bridgePending())),
      POST: ({ request }) =>
        handle(async () => {
          requireBridge(request);
          return bridgeReport((await request.json()) as Parameters<typeof bridgeReport>[0]);
        }),
    },
  },
});
