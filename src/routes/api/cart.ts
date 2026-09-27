import { createFileRoute } from "@tanstack/react-router";
import { requireUser } from "@/lib/shop/auth.server";
import { cartMutate, cartView } from "@/lib/shop/orders.server";
import { handle } from "@/lib/shop/mongo.server";

type Body = { id?: string; qty?: number; lines?: Array<{ id: string; qty: number }>; source?: string; cart?: string };
async function body(request: Request): Promise<Body> {
  const b = ((await request.json().catch(() => ({}))) || {}) as Body;
  // accept the Activity link format "akm:2,bandage:3"
  if (typeof b.cart === "string" && !b.lines) b.lines = b.cart.split(",").map((s) => s.split(":")).filter(([id]) => id).map(([id, q]) => ({ id: id.trim(), qty: Number(q) || 1 }));
  return b;
}

// GET cart · POST add {id,qty}|{lines}|{cart:"akm:2"} · PATCH set qty {id,qty} · PUT replace {lines} · DELETE {id} (no id = clear)
export const Route = createFileRoute("/api/cart")({
  server: {
    handlers: {
      GET: ({ request }) => handle(async () => cartView(await requireUser(request))),
      POST: ({ request }) => handle(async () => cartMutate(await requireUser(request), "add", await body(request))),
      PATCH: ({ request }) => handle(async () => cartMutate(await requireUser(request), "set", await body(request))),
      PUT: ({ request }) => handle(async () => cartMutate(await requireUser(request), "replace", await body(request))),
      DELETE: ({ request }) =>
        handle(async () => {
          const u = await requireUser(request);
          const b = await body(request);
          const id = b.id || new URL(request.url).searchParams.get("id") || undefined;
          return cartMutate(u, id ? "remove" : "clear", { id });
        }),
    },
  },
});
