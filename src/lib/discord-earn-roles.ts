import { EARN_ROLES } from "@/lib/earn-roles-catalog";
import { readJsonFile, writeJsonFile } from "@/lib/dayz/store";

const DISCORD_API = "https://discord.com/api/v10";
const CHANNEL = process.env.DISCORD_EARN_ROLES_CHANNEL_ID || "1371718892304728104";
const CREDITS = 1000;
const JUNK = /^(Survivor|Kills|Trader|Builder|Raider|NPC|Recon|Courier|Night Owl|Event) \d+$/i;

type RoleMap = { guildId?: string; roles: Record<string, string> };

const GROUPS = [
  { title: "Survive", keys: ["fresh_meat", "survivor", "hardened", "unbroken"] },
  { title: "Combat", keys: ["blooded", "hunter", "slayer", "medic"] },
  { title: "World", keys: ["builder", "raider", "livonia", "chernarus"] },
  { title: "Work", keys: ["trader", "operator", "pilot", "ghost"] },
  { title: "Status", keys: ["night_owl", "warlord", "inner", "asylum"] },
];

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

async function loadMap(): Promise<RoleMap> {
  return readJsonFile<RoleMap>("earn-roles.json", { roles: {} });
}

export async function ensureEarnRoles() {
  const channel = (await discord(`/channels/${CHANNEL}`)) as { guild_id: string };
  const guildId = channel.guild_id;
  const existing = (await discord(`/guilds/${guildId}/roles`)) as Array<{ id: string; name: string; managed?: boolean }>;
  let deleted = 0;
  for (const role of existing) {
    if (!JUNK.test(role.name) || role.managed) continue;
    if (deleted >= 20) break;
    try {
      await discord(`/guilds/${guildId}/roles/${role.id}`, { method: "DELETE" });
      deleted += 1;
    } catch {
      /* hierarchy */
    }
  }
  const map: RoleMap = { guildId, roles: {} };
  const fresh = (await discord(`/guilds/${guildId}/roles`)) as Array<{ id: string; name: string }>;
  let created = 0;
  for (const role of EARN_ROLES) {
    const found = fresh.find((r) => r.name === role.name);
    if (found) {
      map.roles[role.key] = found.id;
      continue;
    }
    if (created >= 20) continue;
    const made = (await discord(`/guilds/${guildId}/roles`, {
      method: "POST",
      body: JSON.stringify({ name: role.name, mentionable: true, hoist: false, color: role.color }),
    })) as { id: string };
    map.roles[role.key] = made.id;
    fresh.push({ id: made.id, name: role.name });
    created += 1;
  }
  await writeJsonFile("earn-roles.json", map);
  return { map, created, deleted, total: Object.keys(map.roles).length, need: EARN_ROLES.length };
}

function mention(map: RoleMap, key: string) {
  const id = map.roles[key];
  const role = EARN_ROLES.find((r) => r.key === key);
  return id ? `<@&${id}>` : `**${role?.name ?? key}**`;
}

function boardPayload(map: RoleMap) {
  const fields = GROUPS.map((g) => ({
    name: g.title,
    value: g.keys.map((k) => mention(map, k)).join("\n"),
    inline: true,
  }));
  return {
    content: "",
    embeds: [
      {
        title: "Earn roles",
        description: "Finish the challenge. You get the **role** and **1,000 cr**.",
        color: 0x22c55e,
        fields,
        footer: { text: "DAYZ PRO  ·  20 roles" },
      },
    ],
    components: [],
    allowed_mentions: { parse: [] },
  };
}

export async function postEarnRolesEmbed() {
  const ensured = await ensureEarnRoles();
  const payload = boardPayload(ensured.map);
  const recent = (await discord(`/channels/${CHANNEL}/messages?limit=30`)) as Array<{ id: string }>;
  for (const msg of recent) {
    try {
      await discord(`/channels/${CHANNEL}/messages/${msg.id}`, { method: "DELETE" });
    } catch {
      /* ignore */
    }
  }
  const created = (await discord(`/channels/${CHANNEL}/messages`, {
    method: "POST",
    body: JSON.stringify(payload),
  })) as { id: string };
  return { ok: true, action: "posted-new", messageId: created.id, ...ensured, map: undefined };
}

export async function roleHoldersEmbed(key: string) {
  const role = EARN_ROLES.find((r) => r.key === key);
  if (!role) return { embeds: [{ title: "Unknown role", color: 0x6b7280 }] };
  return {
    embeds: [{ title: role.name, description: `${role.challenge}\nReward: role + 1,000 cr`, color: role.color }],
  };
}

export async function grantEarnRole(discordUserId: string, key: string) {
  const role = EARN_ROLES.find((r) => r.key === key);
  if (!role) throw new Error("unknown role");
  const { map } = await ensureEarnRoles();
  const roleId = map.roles[key];
  if (!map.guildId || !roleId) throw new Error("role missing");
  await discord(`/guilds/${map.guildId}/members/${discordUserId}/roles/${roleId}`, { method: "PUT" });
  return { ok: true, role: role.name, credits: CREDITS };
}
