import { createFileRoute } from "@tanstack/react-router";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function pull(url: string) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8" },
    redirect: "follow",
  });
  if (!res.ok) return null;
  const type = res.headers.get("content-type") || "";
  if (!type.includes("image") && !type.includes("octet-stream")) return null;
  const buf = await res.arrayBuffer();
  if (buf.byteLength < 80) return null;
  return { buf, type: type.includes("image") ? type : "image/png" };
}

export const Route = createFileRoute("/api/wiki-image")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const file = new URL(request.url).searchParams.get("file") || "";
        if (!file || file.includes("..")) return new Response("bad file", { status: 400 });
        const enc = encodeURIComponent(file);
        const hit =
          (await pull(`https://dayz.wiki.gg/wiki/Special:FilePath/${enc}`)) ||
          (await pull(`https://dayz.fandom.com/wiki/Special:FilePath/${enc}`)) ||
          (await pull(`https://static.wikia.nocookie.net/dayz_gamepedia/images/${enc}`));
        if (!hit) return new Response("missing", { status: 404 });
        return new Response(hit.buf, {
          headers: {
            "Content-Type": hit.type,
            "Cache-Control": "public, max-age=86400",
          },
        });
      },
    },
  },
});
