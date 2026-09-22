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

function botToken() {
  return (process.env.DISCORD_TOKEN || process.env.DISCORD_BOT_TOKEN || "").replace(/^Bot\s+/i, "");
}

function guildId() {
  return process.env.DISCORD_GUILD_ID || process.env.DISCORD_SERVER_ID || "";
}

async function roleNamesById(headers: Record<string, string>) {
  const guild = guildId();
  const res = await fetch(`https://discord.com/api/v10/guilds/${guild}/roles`, { headers });
  if (!res.ok) return new Map<string, string>();
  const roles = (await res.json()) as Array<{ id: string; name: string }>;
  return new Map(roles.map((r) => [r.id, r.name]));
}

function allowed(ids: string[], names: Map<string, string>) {
  if (ids.includes(BLACK_MARKET_ROLE)) return true;
  return ids.some((id) => PLUS_NAMES.has(names.get(id) || ""));
}

export async function memberHasDonorRole(discordUserId: string, userAccessToken?: string) {
  const guild = guildId();
  const bot = botToken();
  if (!guild) return false;

  if (userAccessToken && !userAccessToken.startsWith("demo-") && !userAccessToken.startsWith("discord-access")) {
    const me = await fetch(`https://discord.com/api/v10/users/@me/guilds/${guild}/member`, {
      headers: { Authorization: `Bearer ${userAccessToken}` },
    });
    if (me.ok) {
      const member = (await me.json()) as { roles?: string[]; user?: { id?: string } };
      const names = bot ? await roleNamesById({ Authorization: `Bot ${bot}` }) : new Map<string, string>();
      if (allowed(member.roles ?? [], names)) return true;
    }
  }

  if (bot && discordUserId) {
    const memberRes = await fetch(`https://discord.com/api/v10/guilds/${guild}/members/${discordUserId}`, {
      headers: { Authorization: `Bot ${bot}` },
    });
    if (memberRes.ok) {
      const member = (await memberRes.json()) as { roles?: string[] };
      const names = await roleNamesById({ Authorization: `Bot ${bot}` });
      if (allowed(member.roles ?? [], names)) return true;
    }
  }
  return false;
}
