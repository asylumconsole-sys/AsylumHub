import { readJsonFile } from "@/lib/dayz/store";
import { isBannedCannedTicket, shouldSkipRepeat } from "@/lib/ticket-ai";

type LinkStore = { byDiscordId: Record<string, { username?: string; links?: { username: string; serverId: string }[] }> };

async function linkedNames(discordId: string) {
  const store = await readJsonFile<LinkStore>("bot-account-links.json", { byDiscordId: {} });
  const row = store.byDiscordId[discordId];
  return [...new Set([...(row?.links ?? []).map((l) => l.username), row?.username].filter((n): n is string => Boolean(n?.trim())))];
}

export async function draftTicketReply(input: { discordId: string; content: string; priorBot?: string[] }) {
  const names = await linkedNames(input.discordId).catch(() => [] as string[]);
  const tag = names[0] || "";
  const raid = /raid|base|boost|raided/i.test(input.content || "");
  let text: string;
  if (raid && tag) text = `Got it ${tag} — looking at 101/102 ADM for yesterday. Which server was the base on?`;
  else if (raid) text = "Got the raid. Which server, 101 or 102? Link PSN on the Hub if it is not already.";
  else if (tag) text = `Linked ${tag}. What do you need looked at?`;
  else text = "What server is this on, 101 or 102?";
  if (isBannedCannedTicket(text) || shouldSkipRepeat(input.priorBot || [], text)) {
    text = tag ? `${tag} — 101 or 102?` : "101 or 102?";
  }
  return { text, tag, hits: [] as string[], names };
}
