import { createFileRoute } from "@tanstack/react-router";
import { catalog, publicOrigin } from "@/lib/shop/catalog.server";
import { handle } from "@/lib/shop/mongo.server";

// GET /api/shop/catalog — compact list for the Discord Activity: id, classname, name, price, category, image.
export const Route = createFileRoute("/api/shop/catalog")({
  server: {
    handlers: {
      GET: ({ request }) =>
        handle(async () => {
          const origin = publicOrigin(request);
          const { items } = await catalog();
          return { ok: true, currency: "CR", deliveryLabel: "Arrives at next server restart (every 2h)", count: items.length, items: items.map((i) => ({ id: i.id, classname: i.classname, name: i.name, price: i.price, category: i.category, image: i.image, imageUrl: origin + i.image, hasImage: i.hasImage, featured: i.featured })) };
        }),
    },
  },
});
