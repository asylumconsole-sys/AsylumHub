import { readJsonFile, writeJsonFile } from "@/lib/dayz/store";
import {
  currentMonthKey,
  loadStaffClaims,
  matchTier,
  saveStaffClaims,
  STAFF_TIERS,
  type StaffTierKey,
} from "@/lib/staff-allowance";
import { discordGet, discordPost, resolveStaffChannel } from "@/lib/staff-embed";

type EconomyStore = {
  accounts: Record<string, { playerId: string; displayName: string; balance: number; xp: number }>;
  transfers: Array<{ id: string; fromPlayerId: string; toPlayerId: string; amount: number; note?: string; createdAt: string }>;
};

function monthsOnServer(joinedAt?: string) {
  if (!joinedAt) return 0;
  const ms = Date.now() - Date.parse(joinedAt);
  return Math.max(0, ms / (30.44 * 24 * 3600_000));
}

async function memberAndRoles(guildId: string, userId: string) {
  const member = (await discordGet(`/guilds/${guildId}/members/${userId}`)) as {
    joined_at?: string;
    roles?: string[];
    user?: { id: string; username: string };
    nick?: string;
  } | null;
  const roles = ((await discordGet(`/guilds/${guildId}/roles`)) as Array<{ id: string; name: string }>) || [];
  const mine = roles.filter((r) => member?.roles?.includes(r.id));
  return { member, roles, mine, names: mine.map((r) => r.name) };
}

async function countTickets(userId: string) {
  const store = await loadStaffClaims();
  if (store.tickets[userId]) return store.tickets[userId];
  const guild = process.env.DISCORD_GUILD_ID;
  if (!guild) return 0;
  const channels = (await discordGet(`/guilds/${guild}/channels`)) as Array<{ id: string; name?: string; topic?: string }>;
  if (!Array.isArray(channels)) return 0;
  const hits = channels.filter((c) => /ticket/i.test(`${c.name || ""} ${c.topic || ""}`) && c.name?.includes(userId.slice(-4)));
  store.tickets[userId] = hits.length;
  await saveStaffClaims(store);
  return hits.length;
}

export async function handleStaffClaim(userId: string) {
  const guild = process.env.DISCORD_GUILD_ID;
  if (!guild) return { content: "Guild not configured.", flags: 64 };
  const { names, member } = await memberAndRoles(guild, userId);
  const tier = matchTier(names);
  if (!tier) return { content: "You need a staff role (Moderator / Admin / Financier / Co Owner) to claim.", flags: 64 };
  const store = await loadStaffClaims();
  const key = `${userId}:${tier.key}`;
  const month = currentMonthKey();
  if (store.claims[key] === month) {
    return { content: `Already claimed ${tier.name} pay for ${month}.`, flags: 64 };
  }
  const economy = await readJsonFile<EconomyStore>("economy.json", { accounts: {}, transfers: [] });
  if (!economy.accounts[userId]) {
    economy.accounts[userId] = { playerId: userId, displayName: member?.nick || member?.user?.username || userId, balance: 0, xp: 0 };
  }
  economy.accounts[userId].balance += tier.pay;
  economy.transfers.push({
    id: `staff-${month}-${userId}`,
    fromPlayerId: "staff-payroll",
    toPlayerId: userId,
    amount: tier.pay,
    note: `${tier.name} monthly`,
    createdAt: new Date().toISOString(),
  });
  store.claims[key] = month;
  await writeJsonFile("economy.json", economy);
  await saveStaffClaims(store);
  return { content: `Paid ${tier.pay.toLocaleString()} cr for ${tier.name}. New balance ${economy.accounts[userId].balance.toLocaleString()} cr.`, flags: 64 };
}

export async function handleStaffPromo(userId: string) {
  const guild = process.env.DISCORD_GUILD_ID;
  if (!guild) return { content: "Guild not configured.", flags: 64 };
  const { names, member, roles } = await memberAndRoles(guild, userId);
  const tier = matchTier(names);
  if (!tier) return { content: "You need a staff role first.", flags: 64 };
  if (!tier.next) return { content: "Co Owner is the top staff rank.", flags: 64 };
  const next = STAFF_TIERS.find((t) => t.key === tier.next)!;
  const months = monthsOnServer(member?.joined_at);
  const tickets = await countTickets(userId);
  const timeOk = months + 0.01 >= next.monthsRequired;
  const name = member?.nick || member?.user?.username || userId;
  const summary = [
    `**Rank-up request** <@${userId}> (${name})`,
    `${tier.name} → ${next.name}`,
    `On Discord: ${months.toFixed(1)} months (need ${next.monthsRequired})`,
    `Tickets / help counted: ${tickets}`,
    timeOk ? "Time check passed." : "Time check failed — Co Owners can still override.",
  ].join("\n");
  const channelId = await resolveStaffChannel();
  const co = roles.find((r) => /co\s*owner/i.test(r.name));
  if (channelId) {
    await discordPost(`/channels/${channelId}/messages`, {
      content: `${co ? `<@&${co.id}>` : "@Co Owner"} vote this rank-up.`,
      embeds: [{ title: "Staff promotion", description: summary, color: 0xd4a84b }],
      components: [
        {
          type: 1,
          components: [
            { type: 2, style: 3, label: "Approve", custom_id: `staff_yes:${userId}:${next.key}` },
            { type: 2, style: 4, label: "Deny", custom_id: `staff_no:${userId}` },
          ],
        },
      ],
    });
  }
  return { content: `Request sent to Co Owners for ${next.name}.`, flags: 64 };
}

export async function handleStaffVote(actorId: string, approve: boolean, targetId: string, nextKey?: string) {
  const guild = process.env.DISCORD_GUILD_ID;
  if (!guild) return { content: "Guild not configured.", flags: 64 };
  const { names, roles } = await memberAndRoles(guild, actorId);
  const actor = matchTier(names);
  if (actor?.key !== "coowner") return { content: "Only Co Owners can vote.", flags: 64 };
  if (!approve) return { content: `Denied <@${targetId}>.`, flags: 64 };
  const next = STAFF_TIERS.find((t) => t.key === nextKey);
  const role = roles.find((r) => r.name.toLowerCase().replace(/[-_]/g, " ").includes(next?.name.toLowerCase() || "nope"));
  if (role) {
    await fetch(`https://discord.com/api/v10/guilds/${guild}/members/${targetId}/roles/${role.id}`, {
      method: "PUT",
      headers: {
        Authorization: `Bot ${process.env.DISCORD_TOKEN?.replace(/^Bot\s+/i, "")}`,
      },
    });
  }
  return { content: `Approved <@${targetId}> → ${next?.name || nextKey}.`, flags: 64 };
}
