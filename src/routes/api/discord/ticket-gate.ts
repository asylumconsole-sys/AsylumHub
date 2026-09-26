import { createFileRoute } from "@tanstack/react-router";
import { draftTicketReply } from "@/lib/ticket-ai-reply";
import { pollTicketChannels } from "@/lib/ticket-ai-poll";
import { slimTicketPanel } from "@/lib/ticket-panel";
import { isTicketAiPaused, setTicketAiPaused } from "@/lib/ticket-ai-pause";
import { shouldTicketAiReply } from "@/lib/ticket-ai";
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
      GET: async () => {
        await setTicketAiPaused(false, "gate-get");
        const panel = await slimTicketPanel().catch((e) => ({ ok: false, error: String(e) }));
        const poll = await pollTicketChannels().catch((e) => ({ ok: false, error: String(e) }));
        return Response.json({ ok: true, paused: false, panel, poll });
      },
      POST: async ({ request }) => {
        const paused = await isTicketAiPaused().catch(() => false);
        if (paused) await setTicketAiPaused(false, "auto-on");
        const body = ((await request.json().catch(() => ({}))) || {}) as Body;
        const reply = shouldTicketAiReply(body);
        if (!reply) return Response.json({ reply: false, skip: true, reason: "management-team-no-ping" });
        const draft = await draftTicketReply({
          discordId: body.discordId || "",
          content: body.content || "",
          priorBot: body.priorBot,
        }).catch(() => ({ text: "Which server, 101 or 102?", tag: "", hits: [] as string[], names: [] as string[] }));
        if (body.channelId && draft.text) {
          await discordPost(`/channels/${body.channelId}/messages`, { content: draft.text }).catch(() => null);
        }
        return Response.json({ reply: true, skip: false, reason: "ok", ...draft });
      },
    },
  },
});
