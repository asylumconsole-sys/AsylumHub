import { EARN_ROLES } from "@/lib/earn-roles-catalog";
import { readJsonFile, writeJsonFile } from "@/lib/dayz/store";

const DISCORD_API = "https://discord.com/api/v10";
const CHANNEL = process.env.DISCORD_EARN_ROLES_CHANNEL_ID || "1371718892304728104";
const CREDITS = 1000;

type RoleMap = { guildId?: string; roles: Record<string, string> };

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
  const map = await loadMap();
  map.guildId = guildId;
  const existing = (await discord(`/guilds/${guildId}/roles`)) as Array<{ id: string; name: string }>;
  for (const role of EARN_ROLES) {
    const found = existing.find((r) => r.name === role.name);
    if (found) {
      map.roles[role.key] = found.id;
      continue;
    }
    try {
      const created = (await discord(`/guilds/${guildId}/roles`, {
        method: "POST",
        body: JSON.stringify({ name: role.name, mentionable: true, hoist: false, color: 0x22c55e }),
      })) as { id: string };
      map.roles[role.key] = created.id;
    } catch {
      /* Manage Roles missing */
    }
  }
  await writeJsonFile("earn-roles.json", map);
  return map;
}

function mention(map: RoleMap, key: string) {
  const id = map.roles[key];
  const role = EARN_ROLES.find((r) => r.key === key);
  return id ? `<@&${id}>` : `**${role?.name ?? key}**`;
}

function boardPayload(map: RoleMap) {
  const lines = EARN_ROLES.map((r) => `${mention(map, r.key)} — ${r.challenge} · **+1000 cr**`).join("\n");
  const half = Math.ceil(EARN_ROLES.length / 2);
  const a = EARN_ROLES.slice(0, half);
  const b = EARN_ROLES.slice(half);
  const opts = (list: typeof EARN_ROLES) =>
    list.slice(0, 25).map((r) => ({
      label: r.name,
      value: r.key,
      description: `${r.challenge} · +1000 cr`.slice(0, 100),
    }));
  return {
    content: lines.slice(0, 1800),
    embeds: [
      {
        title: "Earn roles",
        description: "Finish the line. Role + **1000 cr** apply automatically. Pick a role to see who has it.",
        color: 0x22c55e,
        footer: { text: "DAYZ PRO · 1000 cr each · no extra tags" },
      },
    ],
    components: [
      { type: 1, components: [{ type: 3, custom_id: "earn_pick_a", placeholder: "Roles 1", options: opts(a) }] },
      { type: 1, components: [{ type: 3, custom_id: "earn_pick_b", placeholder: "Roles 2", options: opts(b) }] },
    ],
    allowed_mentions: { parse: ["roles"] },
  };
}

export async function postEarnRolesEmbed() {
  const me = (await discord("/users/@me")) as { id: string };
  const map = await ensureEarnRoles();
  const payload = boardPayload(map);
  const recent = (await discord(`/channels/${CHANNEL}/messages?limit=100`)) as Array<{
    id: string;
    author?: { id?: string };
    embeds?: Array<{ title?: string }>;
  }>;
  const ours = recent.find((m) => m.author?.id === me.id && m.embeds?.some((e) => /earn roles/i.test(e.title || "")));
  let messageId = ours?.id;
  if (ours) {
    await discord(`/channels/${CHANNEL}/messages/${ours.id}`, { method: "PATCH", body: JSON.stringify(payload) });
  } else {
    const created = (await discord(`/channels/${CHANNEL}/messages`, { method: "POST", body: JSON.stringify(payload) })) as { id: string };
    messageId = created.id;
  }
  for (const msg of recent) {
    if (msg.id === messageId) continue;
    try {
      await discord(`/channels/${CHANNEL}/messages/${msg.id}`, { method: "DELETE" });
    } catch {
      /* ignore */
    }
  }
  return { ok: true, messageId, roles: Object.keys(map.roles).length };
}

export async function roleHoldersEmbed(key: string) {
  const role = EARN_ROLES.find((r) => r.key === key);
  if (!role) return { embeds: [{ title: "Unknown role", color: 0x6b7280 }] };
  const map = await loadMap();
  const roleId = map.roles[key];
  let holders = "Nobody has this role yet.";
  if (roleId && map.guildId) {
    const members = (await discord(`/guilds/${map.guildId}/members?limit=1000`)) as Array<{
      user?: { username?: string; global_name?: string };
      nick?: string;
      roles?: string[];
    }>;
    const names = members
      .filter((m) => m.roles?.includes(roleId))
      .map((m) => m.nick || m.user?.global_name || m.user?.username)
      .filter(Boolean) as string[];
    if (names.length) holders = names.slice(0, 40).map((n, i) => `${i + 1}. ${n}`).join("\n");
  }
  return {
    embeds: [
      {
        title: role.name,
        color: 0x22c55e,
        fields: [
          { name: "Challenge", value: role.challenge, inline: false },
          { name: "Reward", value: "Role + 1000 cr", inline: false },
          { name: "Who has it", value: holders.slice(0, 1024), inline: false },
        ],
      },
    ],
  };
}

export async function grantEarnRole(discordUserId: string, key: string) {
  const role = EARN_ROLES.find((r) => r.key === key);
  if (!role) throw new Error("unknown role");
  const map = await ensureEarnRoles();
  const roleId = map.roles[key];
  if (!map.guildId || !roleId) throw new Error("role missing — bot needs Manage Roles");
  await discord(`/guilds/${map.guildId}/members/${discordUserId}/roles/${roleId}`, { method: "PUT" });
  try {
    const { creditPlayer } = await import("@/lib/economy.functions");
    await creditPlayer({ data: { playerId: discordUserId, amount: CREDITS, reason: `earn-role:${key}` } as never });
  } catch {
    /* credits best-effort */
  }
  return { ok: true, role: role.name, credits: CREDITS };
}
