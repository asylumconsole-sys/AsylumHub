import { createFileRoute } from "@tanstack/react-router";
import { memberHasDonorRole } from "@/lib/black-market";

export const Route = createFileRoute("/api/black-market/access")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const userId = new URL(request.url).searchParams.get("userId") || "";
        const ok = await memberHasDonorRole(userId);
        return Response.json({ ok });
      },
    },
  },
});
