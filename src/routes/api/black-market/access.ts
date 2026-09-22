import { createFileRoute } from "@tanstack/react-router";
import { memberHasDonorRole } from "@/lib/black-market";

export const Route = createFileRoute("/api/black-market/access")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const userId = url.searchParams.get("userId") || "";
        const username = url.searchParams.get("username") || "";
        const auth = request.headers.get("authorization") || "";
        const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : "";
        const ok = await memberHasDonorRole(userId, token, username);
        return Response.json({ ok });
      },
    },
  },
});
