import { readJsonFile, writeJsonFile } from "@/lib/dayz/store";
import { slimTicketPanel } from "@/lib/ticket-panel";
import { setTicketAiPaused } from "@/lib/ticket-ai-pause";
import { discordPost } from "@/lib/staff-embed";

const FILE = "live-ops.json";

export type LiveOps = {
  ticketPanel: {
    title: string;
    description: string;
    options: Array<{ label: string; value: string; description: string }>;
  };
  ticketPrompt: string;
  updatedAt: string;
};

const FALLBACK: LiveOps = {
  ticketPanel: {
    title: "DAYZ PRO \u00b7 Tickets",
    description: "Open AI Support. PRO AI handles raids, shop, accounts, factions, and logs in one place.",
    options: [
      {
        label: "AI Support",
        value: "ai-support",
        description: "Ask PRO AI about rules, raids, players, logs, shop, or status.",
      },
    ],
  },
  ticketPrompt: "Talk like staff. No raid checklists.",
  updatedAt: "",
};

export async function getLiveOps() {
  return readJsonFile<LiveOps>(FILE, FALLBACK);
}

export async function setLiveOps(patch: Partial<LiveOps>) {
  const cur = await getLiveOps();
  const next: LiveOps = {
    ...cur,
    ...patch,
    ticketPanel: { ...cur.ticketPanel, ...(patch.ticketPanel || {}) },
    updatedAt: new Date().toISOString(),
  };
  await writeJsonFile(FILE, next);
  return next;
}

export async function runLiveAction(action: string, body: Record<string, unknown>) {
  if (action === "get") return { ok: true, ops: await getLiveOps() };
  if (action === "set") return { ok: true, ops: await setLiveOps(body as Partial<LiveOps>) };
  if (action === "ticket-panel") {
    const ops = body.ticketPanel ? await setLiveOps({ ticketPanel: body.ticketPanel as LiveOps["ticketPanel"] }) : await getLiveOps();
    const posted = await slimTicketPanel(ops.ticketPanel);
    return { ok: true, ops, posted };
  }
  if (action === "aion") return { ok: true, store: await setTicketAiPaused(false, "live") };
  if (action === "aioff") return { ok: true, store: await setTicketAiPaused(true, "live") };
  if (action === "say" && typeof body.channelId === "string" && typeof body.content === "string") {
    const msg = await discordPost(`/channels/${body.channelId}/messages`, {
      content: body.content,
      embeds: Array.isArray(body.embeds) ? body.embeds : undefined,
    });
    return { ok: true, msg };
  }
  return { ok: false, error: "unknown action" };
}
