import { createFileRoute } from "@tanstack/react-router";

async function run(request: Request) {
  const secret = process.env.HUB_BOT_SECRET;
  const header = request.headers.get("authorization") || "";
  const query = new URL(request.url).searchParams.get("secret");
  if (secret && header !== `Bearer ${secret}` && query !== secret) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
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
      GET: ({ request }) => run(request),
      POST: ({ request }) => run(request),
    },
  },
});
