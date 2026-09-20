import { EARN_ROLES } from "@/lib/earn-roles-catalog";
import { readJsonFile, writeJsonFile } from "@/lib/dayz/store";

const DISCORD_API = "https://discord.com/api/v10";
const CHANNEL = process.env.DISCORD_EARN_ROLES_CHANNEL_ID || "1371718892304728104";

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
    const found = existing.find((r) => r.name === role.name) || (map.roles[role.key] ? { id: map.roles[role.key], name: role.name } : null);
    if (found) {
      map.roles[role.key] = found.id;
      continue;
    }
    const created = (await discord(`/guilds/${guildId}/roles`, {
      method: "POST",
      body: JSON.stringify({ name: role.name, color: role.color, mentionable: true, hoist: false }),
    })) as { id: string };
    map.roles[role.key] = created.id;
  }
  await writeJsonFile("earn-roles.json", map);
  return map;
}

function boardPayload() {
  const combat = EARN_ROLES.filter((r) => ["blooded", "hunter", "slayer", "reaper", "raider", "warlord", "legend", "ghost", "operator", "battalion", "pilot"].includes(r.key));
  const life = EARN_ROLES.filter((r) => !combat.includes(r));
  const block = (list: typeof EARN_ROLES) =>
    list.map((r) => `**${r.name}** — ${r.challenge}\nReward: ${r.reward}`).join("\n\n").slice(0, 1024);
  return {
    embeds: [
      {
        title: "Earn roles",
        description:
          "Pick a role below. Finish the challenge and the bot adds the Discord role + credits automatically. Click a role to see who already has it.",
        color: 0x22c55e,
        fields: [
          { name: "Combat & ops", value: block(combat) || "—", inline: false },
          { name: "Survival & status", value: block(life) || "—", inline: false },
        ],
        footer: { text: "DAYZ PRO · earn roles · dayzpro.online" },
        timestamp: new Date().toISOString(),
      },
    ],
    components: [
      {
        type: 1,
        components: [
          {
            type: 3,
            custom_id: "earn_pick",
            placeholder: "View a role — who has it + how to earn it",
            options: EARN_ROLES.slice(0, 25).map((r) => ({
              label: r.name,
              value: r.key,
              description: r.reward.slice(0, 100),
            })),
          },
        ],
      },
    ],
  };
}

export async function postEarnRolesEmbed() {
  const map = await ensureEarnRoles();
  const payload = boardPayload();
  const recent = (await discord(`/channels/${CHANNEL}/messages?limit=100`)) as Array<{
    id: string;
    embeds?: Array<{ title?: string }>;
  }>;
  const existing = recent.find((m) => m.embeds?.some((e) => /earn roles/i.test(e.title || "")));
  let messageId = existing?.id;
  if (existing) {
    await discord(`/channels/${CHANNEL}/messages/${existing.id}`, { method: "PATCH", body: JSON.stringify(payload) });
  } else {
    const created = (await discord(`/channels/${CHANNEL}/messages`, { method: "POST", body: JSON.stringify(payload) })) as { id: string };
    messageId = created.id;
  }
  const extra = recent.map((m) => m.id).filter((id) => id !== messageId);
  if (extra.length >= 2) {
    try {
      await discord(`/channels/${CHANNEL}/messages/bulk-delete`, {
        method: "POST",
        body: JSON.stringify({ messages: extra.slice(0, 100) }),
      });
    } catch {
      for (const id of extra) {
        try {
          await discord(`/channels/${CHANNEL}/messages/${id}`, { method: "DELETE" });
        } catch {
          /* ignore */
        }
      }
    }
  } else {
    for (const id of extra) {
      try {
        await discord(`/channels/${CHANNEL}/messages/${id}`, { method: "DELETE" });
      } catch {
        /* ignore */
      }
    }
  }
  return { ok: true, messageId, roles: Object.keys(map.roles).length };
}

export async function roleHoldersEmbed(key: string) {
  const role = EARN_ROLES.find((r) => r.key === key);
  if (!role) return { embeds: [{ title: "Unknown role", color: 0x6b7280 }] };
  const map = await loadMap();
  const roleId = map.roles[key];
  const guildId = map.guildId;
  let holders = "Nobody has this role yet.";
  if (roleId && guildId) {
    const members = (await discord(`/guilds/${guildId}/members?limit=1000`)) as Array<{
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
        color: role.color,
        fields: [
          { name: "Challenge", value: role.challenge, inline: false },
          { name: "Reward", value: role.reward, inline: false },
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
  if (!map.guildId || !roleId) throw new Error("role missing");
  await discord(`/guilds/${map.guildId}/members/${discordUserId}/roles/${roleId}`, { method: "PUT" });
  return { ok: true, role: role.name, credits: role.credits };
}
