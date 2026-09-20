import { EARN_ROLES } from "@/lib/earn-roles-catalog";
import { readJsonFile, writeJsonFile } from "@/lib/dayz/store";

const DISCORD_API = "https://discord.com/api/v10";
const CHANNEL = process.env.DISCORD_EARN_ROLES_CHANNEL_ID || "1371718892304728104";
const JUNK = /^(Survivor|Kills|Trader|Builder|Raider|NPC|Recon|Courier|Night Owl|Event) \d+$/i;

async function discord(path: string, init?: RequestInit) {
  const token = process.env.DISCORD_TOKEN;
  if (!token) throw new Error("DISCORD_TOKEN missing");
  const res = await fetch(`${DISCORD_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bot ${token.replace(/^Bot\s+/i, "")}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Discord ${res.status}: ${text.slice(0, 280)}`);
  return text ? JSON.parse(text) : null;
}

export async function wipeEarnRoles() {
  const channel = (await discord(`/channels/${CHANNEL}`).catch(() => null)) as { guild_id?: string } | null;
  const map = await readJsonFile<{ guildId?: string; roles?: Record<string, string> }>("earn-roles.json", { roles: {} });
  const guildId = channel?.guild_id || map.guildId;
  const deletedRoles: string[] = [];
  if (guildId) {
    const existing = (await discord(`/guilds/${guildId}/roles`)) as Array<{ id: string; name: string; managed?: boolean }>;
    const ours = new Set([
      ...Object.values(map.roles || {}),
      ...EARN_ROLES.map((r) => existing.find((e) => e.name === r.name)?.id).filter(Boolean) as string[],
    ]);
    for (const role of existing) {
      if (role.managed) continue;
      if (!ours.has(role.id) && !JUNK.test(role.name)) continue;
      try {
        await discord(`/guilds/${guildId}/roles/${role.id}`, { method: "DELETE" });
        deletedRoles.push(role.name);
      } catch {
        /* hierarchy or leftover */
      }
    }
  }
  let channelDeleted = false;
  try {
    await discord(`/channels/${CHANNEL}`, { method: "DELETE" });
    channelDeleted = true;
  } catch {
    /* already gone or missing perms */
  }
  await writeJsonFile("earn-roles.json", { roles: {} });
  return { ok: true, deletedRoles, channelDeleted, channel: CHANNEL };
}

export async function postEarnRolesEmbed() {
  return wipeEarnRoles();
}

export async function ensureEarnRoles() {
  return { map: { roles: {} }, created: 0, total: 0, need: 0 };
}

export async function roleHoldersEmbed() {
  return { embeds: [{ title: "Earn roles disabled", color: 0x6b7280 }] };
}

export async function grantEarnRole() {
  throw new Error("earn roles disabled");
}
