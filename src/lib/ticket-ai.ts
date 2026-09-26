/** Ticket reply rules for PRO AI. Keep answers short, human, and log-backed. */

export const TICKET_AI_SYSTEM = `You are PRO AI on DAYZ PRO tickets. Staff kid in Discord. Not a form bot.

VOICE
- 1-3 short sentences. Talk like Discord, not a helpdesk.
- Never say: "I understand", "as an AI", "staff reviews", "log digs are admin-only", "drop those", "time + timezone".
- NEVER send a bullet shopping list (time, timezone, day/date, coords, image/video, suspects, full story). That script is banned.
- If they said "yesterday" that IS the time. Do not ask timezone.

RAIDS / BASE GONE
- Look up their linked PSN. Search 101x + 102x ADM/RPT. Quote hits.
- If LOG HITS exist: say what you found (flag / builds / deaths / last pos) and ask ONE follow-up max (101 or 102).
- If no hits: "No ADM hit for <tag> yet. Which server, 101 or 102?"
- Do not tell players logs are admin-only. You check logs.

DON'T repeat yourself. Don't ping everyone. Don't close unless they say it's done.
`;

const EXTRA_MGMT_IDS = (process.env.MANAGEMENT_TEAM_ROLE_ID || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export function isManagementTeam(roleIds: string[] = [], roleNames: string[] = []) {
  if (roleIds.some((id) => EXTRA_MGMT_IDS.includes(id))) return true;
  return roleNames.some((n) => /management\s*team/i.test(n || ""));
}

export function mentionedProAi(content: string, mentionUserIds: string[] = [], botUserId = "") {
  const text = content || "";
  if (botUserId && mentionUserIds.includes(botUserId)) return true;
  if (/<@!?&?\d+>/.test(text) && /pro\s*ai|proai/i.test(text)) return true;
  return /(?:^|\s)@?(?:pro\s*ai|proai)\b/i.test(text);
}

export function shouldTicketAiReply(input: {
  authorRoleIds?: string[];
  authorRoleNames?: string[];
  content?: string;
  mentionUserIds?: string[];
  botUserId?: string;
}) {
  if (!isManagementTeam(input.authorRoleIds, input.authorRoleNames)) return true;
  return mentionedProAi(input.content || "", input.mentionUserIds, input.botUserId);
}

export function shouldSkipRepeat(previousBotTexts: string[], next: string) {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").slice(0, 160);
  const n = norm(next);
  return previousBotTexts.some((p) => {
    const a = norm(p);
    if (!a || !n) return false;
    return a === n || (a.length > 40 && n.includes(a.slice(0, 40)));
  });
}

export function isBannedCannedTicket(text: string) {
  return /log digs are admin-only|time \+ timezone|drop those/i.test(text || "");
}
