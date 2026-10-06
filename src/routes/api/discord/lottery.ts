import { createFileRoute } from "@tanstack/react-router";
import { publishLotteryBoard } from "@/lib/discord-lottery";

export const Route = createFileRoute("/api/discord/lottery")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const channel = new URL(request.url).searchParams.get("channel") || undefined;
        return Response.json(await publishLotteryBoard(channel));
      },
    },
  },
});
