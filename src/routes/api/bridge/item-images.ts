import { createFileRoute } from "@tanstack/react-router";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { requireBridge } from "@/lib/shop/auth.server";
import { IMAGE_DIR } from "@/lib/shop/catalog.server";
import { handle, ShopError } from "@/lib/shop/mongo.server";

// Box pushes item icons + shop-data.json (classname -> blob manifest) onto the /data volume. GET lists what is stored.
export const Route = createFileRoute("/api/bridge/item-images")({
  server: {
    handlers: {
      GET: ({ request }) =>
        handle(async () => {
          requireBridge(request);
          await mkdir(IMAGE_DIR, { recursive: true });
          return { ok: true, files: await readdir(IMAGE_DIR) };
        }),
      POST: ({ request }) =>
        handle(async () => {
          requireBridge(request);
          const name = new URL(request.url).searchParams.get("name") || "";
          if (!/^([a-f0-9]{8,40}\.webp|shop-data\.json)$/.test(name)) throw new ShopError(400, "bad_name", "bad file name");
          const buf = Buffer.from(await request.arrayBuffer());
          if (!buf.length || buf.length > 2_000_000) throw new ShopError(400, "bad_size", "bad size");
          if (name.endsWith(".json")) JSON.parse(buf.toString("utf8"));
          await mkdir(IMAGE_DIR, { recursive: true });
          await writeFile(path.join(IMAGE_DIR, name), buf);
          return { ok: true, name, bytes: buf.length };
        }),
    },
  },
});
