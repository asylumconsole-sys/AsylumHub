import { createFileRoute } from "@tanstack/react-router";

async function run() {
  try {
    const { repostOnlineEmbed } = await import("@/lib/discord-online-embed");
    const result = await repostOnlineEmbed();
    return Response.json(result);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}

export const Route = createFileRoute("/api/public/online-embed")({
  server: {
    handlers: {
      GET: () => run(),
      POST: () => run(),
    },
  },
});
