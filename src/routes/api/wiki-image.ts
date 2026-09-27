import { createFileRoute } from "@tanstack/react-router";
import { legacyWikiImage } from "@/lib/shop/images.server";

// Legacy path kept for old links. dayz.wiki.gg blocks Railway IPs, so icons are now served from the local volume.
export const Route = createFileRoute("/api/wiki-image")({
  server: {
    handlers: {
      GET: ({ request }) => legacyWikiImage(new URL(request.url).searchParams.get("file") || ""),
    },
  },
});
