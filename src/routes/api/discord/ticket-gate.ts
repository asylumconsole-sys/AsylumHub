import { createFileRoute } from "@tanstack/react-router";
import { shouldTicketAiReply } from "@/lib/ticket-ai";

type Body = {
  authorRoleIds?: string[];
  authorRoleNames?: string[];
  content?: string;
  mentionUserIds?: string[];
  botUserId?: string;
};

export const Route = createFileRoute("/api/discord/ticket-gate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = ((await request.json().catch(() => ({}))) || {}) as Body;
        const reply = shouldTicketAiReply(body);
        return Response.json({
          reply,
          skip: !reply,
          reason: reply ? "ok" : "management-team-no-ping",
        });
      },
    },
  },
});
