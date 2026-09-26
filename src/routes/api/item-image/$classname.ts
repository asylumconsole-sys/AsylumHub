import { createFileRoute } from "@tanstack/react-router";
import { itemImageResponse } from "@/lib/shop/images.server";

// GET /api/item-image/<Classname> — locally hosted icon (volume), clean SVG placeholder if missing.
export const Route = createFileRoute("/api/item-image/$classname")({
  server: { handlers: { GET: ({ params }) => itemImageResponse(String((params as { classname: string }).classname)) } },
});
