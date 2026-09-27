import { createFileRoute } from "@tanstack/react-router";

const B64 = "PLACEHOLDER";

export const Route = createFileRoute("/server-logo.png")({
  server: {
    handlers: {
      GET: async () => {
        const buf = Buffer.from(B64, "base64");
        return new Response(buf, {
          headers: {
            "Content-Type": "image/png",
            "Cache-Control": "public, max-age=86400",
          },
        });
      },
    },
  },
});
