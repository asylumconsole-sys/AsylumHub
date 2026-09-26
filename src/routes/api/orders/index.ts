import { createFileRoute } from "@tanstack/react-router";
import { requireUser } from "@/lib/shop/auth.server";
import { listOrders } from "@/lib/shop/orders.server";
import { handle } from "@/lib/shop/mongo.server";

// GET /api/orders — the signed-in user's orders + restart countdown.
export const Route = createFileRoute("/api/orders/")({
  server: { handlers: { GET: ({ request }) => handle(async () => listOrders(await requireUser(request))) } },
});
