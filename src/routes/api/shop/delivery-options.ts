import { createFileRoute } from "@tanstack/react-router";
import { requireUser } from "@/lib/shop/auth.server";
import { deliveryOptions } from "@/lib/shop/delivery.server";
import { handle } from "@/lib/shop/mongo.server";

// GET /api/shop/delivery-options — your own last ADM position (linked PSN only) + public safe spots.
export const Route = createFileRoute("/api/shop/delivery-options")({
  server: { handlers: { GET: ({ request }) => handle(async () => deliveryOptions((await requireUser(request)).id)) } },
});
