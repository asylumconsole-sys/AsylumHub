import { readJsonFile, writeJsonFile } from "@/lib/dayz/store";
import { DONATION_TIERS } from "@/lib/donation-tiers";

export const BLACK_MARKET_ROLE = "1551745699421622313";
const PLUS_NAMES = new Set(DONATION_TIERS.filter((t) => t.usd >= 30).map((t) => t.name));

export type MarketListing = {
  id: string;
  kind: string;
  title: string;
  price: string;
  details: string;
  sellerId: string;
  sellerName: string;
  createdAt: string;
};

const FILE = "black-market-listings.json";

export async function loadListings() {
  return readJsonFile<MarketListing[]>(FILE, []);
}

export async function addListing(row: MarketListing) {
  const all = await loadListings();
  all.unshift(row);
  await writeJsonFile(FILE, all.slice(0, 200));
  return row;
}

export async function memberHasDonorRole(discordUserId: string) {
  const token = process.env.DISCORD_TOKEN?.replace(/^Bot\s+/i, "");
  const guild = process.env.DISCORD_GUILD_ID;
  if (!token || !guild || !discordUserId) return false;
  const headers = { Authorization: `Bot ${token}` };
  const memberRes = await fetch(`https://discord.com/api/v10/guilds/${guild}/members/${discordUserId}`, { headers });
  if (!memberRes.ok) return false;
  const member = (await memberRes.json()) as { roles?: string[] };
  const ids = member.roles ?? [];
  if (ids.includes(BLACK_MARKET_ROLE)) return true;
  const rolesRes = await fetch(`https://discord.com/api/v10/guilds/${guild}/roles`, { headers });
  if (!rolesRes.ok) return false;
  const roles = (await rolesRes.json()) as Array<{ id: string; name: string }>;
  return roles.some((r) => ids.includes(r.id) && PLUS_NAMES.has(r.name));
}
