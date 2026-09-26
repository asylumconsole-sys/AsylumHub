import { createFileRoute } from "@tanstack/react-router";
import { draftTicketReply } from "@/lib/ticket-ai-reply";
import { isBannedCannedTicket, shouldTicketAiReply } from "@/lib/ticket-ai";
import { discordPost } from "@/lib/staff-embed";

type Body = {
  authorRoleIds?: string[];
  authorRoleNames?: string[];
  content?: string;
  mentionUserIds?: string[];
  botUserId?: string;
  discordId?: string;
  channelId?: string;
  priorBot?: string[];
};

export const Route = createFileRoute("/api/discord/ticket-gate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = ((await request.json().catch(() => ({}))) || {}) as Body;
        const reply = shouldTicketAiReply(body);
        if (!reply) return Response.json({ reply: false, skip: true, reason: "management-team-no-ping" });
        const draft = body.discordId
          ? await draftTicketReply({ discordId: body.discordId, content: body.content || "", priorBot: body.priorBot })
          : { text: "Which server, 101 or 102?", tag: "", hits: [] as string[], names: [] as string[] };
        if (isBannedCannedTicket(draft.text)) draft.text = "Which server was that on, 101 or 102?";
        if (body.channelId && draft.text) {
          await discordPost(`/channels/${body.channelId}/messages`, { content: draft.text }).catch(() => null);
        }
        return Response.json({ reply: true, skip: false, reason: "ok", ...draft });
      },
    },
  },
});
