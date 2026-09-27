import { createFileRoute } from "@tanstack/react-router";
import { requireUser } from "@/lib/shop/auth.server";
import { getOrder } from "@/lib/shop/orders.server";
import { handle } from "@/lib/shop/mongo.server";

export const Route = createFileRoute("/api/orders/$orderId")({
  server: { handlers: { GET: ({ request, params }) => handle(async () => getOrder(await requireUser(request), String((params as { orderId: string }).orderId))) } },
});
