import { createFileRoute } from "@tanstack/react-router";
import { catalog, publicOrigin, withAbsImage } from "@/lib/shop/catalog.server";
import { handle } from "@/lib/shop/mongo.server";

// GET /api/shop/items?q=&category=&featured=1 — full deliverable catalog, server prices.
export const Route = createFileRoute("/api/shop/items")({
  server: {
    handlers: {
      GET: ({ request }) =>
        handle(async () => {
          const u = new URL(request.url);
          const q = (u.searchParams.get("q") || "").toLowerCase();
          const cat = u.searchParams.get("category");
          const featured = u.searchParams.get("featured") === "1";
          const origin = publicOrigin(request);
          const { items } = await catalog();
          const rows = items.filter((i) => (!q || i.name.toLowerCase().includes(q) || i.classname.toLowerCase().includes(q)) && (!cat || i.category === cat) && (!featured || i.featured));
          return { ok: true, currency: "CR", deliveryLabel: "Arrives at next server restart (every 2h)", count: rows.length, categories: [...new Set(items.map((i) => i.category))], items: rows.map((i) => ({ ...i, imageUrl: withAbsImage(i, origin).image })) };
        }),
    },
  },
});
