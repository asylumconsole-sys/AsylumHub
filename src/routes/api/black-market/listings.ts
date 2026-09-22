import { createFileRoute } from "@tanstack/react-router";
import { addListing, loadListings, memberHasDonorRole } from "@/lib/black-market";

function bearer(request: Request) {
  const auth = request.headers.get("authorization") || "";
  return auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : "";
}

export const Route = createFileRoute("/api/black-market/listings")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const userId = new URL(request.url).searchParams.get("userId") || "";
        if (!(await memberHasDonorRole(userId, bearer(request)))) return Response.json({ error: "locked" }, { status: 403 });
        return Response.json({ listings: await loadListings() });
      },
      POST: async ({ request }) => {
        const body = (await request.json()) as {
          userId?: string;
          sellerName?: string;
          kind?: string;
          title?: string;
          price?: string;
          details?: string;
        };
        if (!(await memberHasDonorRole(body.userId || "", bearer(request)))) return Response.json({ error: "locked" }, { status: 403 });
        if (!body.title || !body.price) return Response.json({ error: "missing" }, { status: 400 });
        const row = await addListing({
          id: `${Date.now()}`,
          kind: body.kind || "Other",
          title: String(body.title).slice(0, 80),
          price: String(body.price).slice(0, 40),
          details: String(body.details || "").slice(0, 500),
          sellerId: body.userId || "",
          sellerName: body.sellerName || "Unknown",
          createdAt: new Date().toISOString(),
        });
        return Response.json({ ok: true, listing: row });
      },
    },
  },
});
