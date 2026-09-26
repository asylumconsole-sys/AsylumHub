import { createFileRoute } from "@tanstack/react-router";
import { handle } from "@/lib/shop/mongo.server";
import { serverStatus } from "@/lib/shop/status.server";

// GET /api/server/status — players online + next restart (deliveries ride it).
export const Route = createFileRoute("/api/server/status")({
  server: { handlers: { GET: () => handle(serverStatus) } },
});
