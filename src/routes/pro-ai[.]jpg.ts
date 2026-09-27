import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/pro-ai.jpg")({
  server: {
    handlers: {
      GET: async () =>
        new Response(null, {
          status: 302,
          headers: {
            Location: "/server-logo.png",
            "Cache-Control": "public, max-age=300",
          },
        }),
    },
  },
});
