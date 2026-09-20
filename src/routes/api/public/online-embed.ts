import { createFileRoute } from "@tanstack/react-router";
import { repostOnlineEmbed } from "@/lib/discord-online-embed";

async function run(request: Request) {
  const secret = process.env.HUB_BOT_SECRET;
  const header = request.headers.get("authorization") || "";
  const query = new URL(request.url).searchParams.get("secret");
  if (secret && header !== `Bearer ${secret}` && query !== secret) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
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
