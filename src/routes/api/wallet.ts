import { createFileRoute } from "@tanstack/react-router";
import { requireUser } from "@/lib/shop/auth.server";
import { wallet } from "@/lib/shop/orders.server";
import { handle } from "@/lib/shop/mongo.server";

// GET /api/wallet — your own Discord wallet balance (signed-in only).
export const Route = createFileRoute("/api/wallet")({
  server: { handlers: { GET: ({ request }) => handle(async () => ({ ok: true, ...(await wallet((await requireUser(request)).id)) })) } },
});
