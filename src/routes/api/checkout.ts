import { createFileRoute } from "@tanstack/react-router";
import { requireUser } from "@/lib/shop/auth.server";
import { checkout } from "@/lib/shop/orders.server";
import { handle } from "@/lib/shop/mongo.server";

// POST /api/checkout {delivery:{mode:"last_position"|"safe_spot", spotId?}} + Idempotency-Key header. Prices come from the server cart only.
export const Route = createFileRoute("/api/checkout")({
  server: {
    handlers: {
      POST: ({ request }) =>
        handle(async () => {
          const user = await requireUser(request);
          const b = ((await request.json().catch(() => ({}))) || {}) as Parameters<typeof checkout>[1];
          return checkout(user, b, request.headers.get("idempotency-key"));
        }),
    },
  },
});
