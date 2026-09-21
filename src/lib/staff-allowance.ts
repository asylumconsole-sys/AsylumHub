import { readJsonFile, writeJsonFile } from "@/lib/dayz/store";

export const STAFF_TIERS = [
  { key: "moderator", name: "Moderator", pay: 25_000, next: "admin", monthsRequired: 1 },
  { key: "admin", name: "Admin", pay: 50_000, next: "financier", monthsRequired: 2 },
  { key: "financier", name: "Financier", pay: 75_000, next: "coowner", monthsRequired: 12 },
  { key: "coowner", name: "Co Owner", pay: 150_000, next: null, monthsRequired: 0 },
] as const;

export type StaffTierKey = (typeof STAFF_TIERS)[number]["key"];

type ClaimStore = {
  claims: Record<string, string>;
  tickets: Record<string, number>;
};

const EMPTY: ClaimStore = { claims: {}, tickets: {} };

export async function loadStaffClaims() {
  return readJsonFile<ClaimStore>("staff-claims.json", EMPTY);
}

export async function saveStaffClaims(store: ClaimStore) {
  await writeJsonFile("staff-claims.json", store);
}

export function currentMonthKey(d = new Date()) {
  return d.toISOString().slice(0, 7);
}

export function matchTier(roleNames: string[]) {
  const lower = roleNames.map((n) => n.toLowerCase().replace(/[-_]/g, " "));
  if (lower.some((n) => n.includes("co owner") || n.includes("coowner") || n === "owner")) return STAFF_TIERS[3];
  if (lower.some((n) => n.includes("financier"))) return STAFF_TIERS[2];
  if (lower.some((n) => /\badmin\b/.test(n) && !n.includes("co"))) return STAFF_TIERS[1];
  if (lower.some((n) => n.includes("mod"))) return STAFF_TIERS[0];
  return null;
}

export const STAFF_RULES = [
  "No leaking staff chats, tools, or player data.",
  "No spawning / refunds for friends. Same rules for everyone.",
  "Tickets first. Be calm. Screenshots before bans.",
  "Don't sit on reports. Escalate if you can't close it.",
  "No arguing staff calls in public. Take it to staff chat.",
  "Monthly pay is one claim per rank per month. Abuse = removed.",
].join("\n");
