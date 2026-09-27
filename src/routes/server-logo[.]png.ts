import { createFileRoute } from "@tanstack/react-router";
import { SKULL } from "@/lib/skull";

export const Route = createFileRoute("/server-logo.png")({
  server: {
    handlers: {
      GET: async () => {
        const b64 = SKULL.split(",")[1] ?? "";
        return new Response(Buffer.from(b64, "base64"), {
          headers: {
            "Content-Type": "image/png",
            "Cache-Control": "public, max-age=300",
          },
        });
      },
    },
  },
});
