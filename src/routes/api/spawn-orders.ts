import { createFileRoute } from "@tanstack/react-router";
import { requireUser } from "@/lib/shop/auth.server";
import { listOrders } from "@/lib/shop/orders.server";
import { handle } from "@/lib/shop/mongo.server";

// GET /api/spawn-orders — alias of /api/orders for the Discord Activity (Bearer = Discord access token).
export const Route = createFileRoute("/api/spawn-orders")({
  server: { handlers: { GET: ({ request }) => handle(async () => listOrders(await requireUser(request))) } },
});
