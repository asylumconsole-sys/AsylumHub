import { readJsonFile, writeJsonFile } from "@/lib/dayz/store";

export const BLACK_MARKET_ROLE = "1551745699421622313";

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
  const res = await fetch(`https://discord.com/api/v10/guilds/${guild}/members/${discordUserId}`, {
    headers: { Authorization: `Bot ${token}` },
  });
  if (!res.ok) return false;
  const member = (await res.json()) as { roles?: string[] };
  const roles = member.roles ?? [];
  if (roles.includes(BLACK_MARKET_ROLE)) return true;
  // $30 and every higher dollar-named role also counts if present by id later; role id is the lock.
  return false;
}
