import { readJsonFile, writeJsonFile } from "@/lib/dayz/store";
import { DONATION_TIERS } from "@/lib/donation-tiers";

export const BLACK_MARKET_ROLE = "1551745699421622313";
const PLUS_NAMES = new Set(DONATION_TIERS.filter((t) => t.usd >= 30).map((t) => t.name));
const BYPASS_IDS = new Set(["1281756735161241621"]);

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

async function searchMember(query: string, headers: Record<string, string>) {
  const guild = guildId();
  if (!query.trim()) return null;
  const res = await fetch(
    `https://discord.com/api/v10/guilds/${guild}/members/search?query=${encodeURIComponent(query.trim())}&limit=5`,
    { headers },
  );
  if (!res.ok) return null;
  const rows = (await res.json()) as Array<{ user?: { id?: string; username?: string; global_name?: string }; roles?: string[] }>;
  return rows[0] || null;
}

export async function memberHasDonorRole(discordUserId: string, userAccessToken?: string, username?: string) {
  const id = String(discordUserId || "").trim();
  if (id && BYPASS_IDS.has(id)) return true;
  const guild = guildId();
  const bot = botToken();
  const botHeaders = bot ? { Authorization: `Bot ${bot}` } : null;

  if (userAccessToken && guild && !userAccessToken.startsWith("demo-") && !userAccessToken.startsWith("discord-access")) {
    const me = await fetch(`https://discord.com/api/v10/users/@me/guilds/${guild}/member`, {
      headers: { Authorization: `Bearer ${userAccessToken}` },
    });
    if (me.ok) {
      const member = (await me.json()) as { roles?: string[]; user?: { id?: string } };
      if (member.user?.id && BYPASS_IDS.has(member.user.id)) return true;
      const names = botHeaders ? await roleNamesById(botHeaders) : new Map<string, string>();
      if (allowed(member.roles ?? [], names)) return true;
    }
    const who = await fetch("https://discord.com/api/v10/users/@me", {
      headers: { Authorization: `Bearer ${userAccessToken}` },
    });
    if (who.ok) {
      const u = (await who.json()) as { id?: string; username?: string };
      if (u.id && BYPASS_IDS.has(u.id)) return true;
      if (botHeaders && u.username) {
        const hit = await searchMember(u.username, botHeaders);
        if (hit?.user?.id && BYPASS_IDS.has(hit.user.id)) return true;
        if (hit && botHeaders) {
          const names = await roleNamesById(botHeaders);
          if (allowed(hit.roles ?? [], names)) return true;
        }
      }
    }
  }

  if (botHeaders && id) {
    const memberRes = await fetch(`https://discord.com/api/v10/guilds/${guild}/members/${id}`, { headers: botHeaders });
    if (memberRes.ok) {
      const member = (await memberRes.json()) as { roles?: string[] };
      const names = await roleNamesById(botHeaders);
      if (allowed(member.roles ?? [], names)) return true;
    }
    const hit = await searchMember(id.length < 20 ? id : username || "", botHeaders);
    if (hit?.user?.id && BYPASS_IDS.has(hit.user.id)) return true;
    if (hit) {
      const names = await roleNamesById(botHeaders);
      if (allowed(hit.roles ?? [], names)) return true;
    }
  }

  if (botHeaders && username) {
    const hit = await searchMember(username, botHeaders);
    if (hit?.user?.id && BYPASS_IDS.has(hit.user.id)) return true;
    if (hit) {
      const names = await roleNamesById(botHeaders);
      if (allowed(hit.roles ?? [], names)) return true;
    }
  }
  return false;
}
