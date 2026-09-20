import { EARN_ROLES } from "@/lib/earn-roles-catalog";
import { readJsonFile, writeJsonFile } from "@/lib/dayz/store";

const DISCORD_API = "https://discord.com/api/v10";
const CHANNEL = process.env.DISCORD_EARN_ROLES_CHANNEL_ID || "1371718892304728104";
const CREDITS = 1000;

type RoleMap = { guildId?: string; roles: Record<string, string> };

const GROUPS: Array<{ title: string; match: (key: string) => boolean }> = [
  { title: "Survivor", match: (k) => k.startsWith("surv_") || ["fresh_meat", "iron", "unbroken"].includes(k) },
  { title: "Combat", match: (k) => k.startsWith("kill_") || ["blooded", "marksman", "executioner", "legend"].includes(k) },
  { title: "Raid & build", match: (k) => k.startsWith("build_") || k.startsWith("raid_") || ["builder", "architect", "raider", "siege"].includes(k) },
  { title: "Trade & NPC", match: (k) => k.startsWith("trade_") || k.startsWith("npc_") || ["trader", "magnate", "operator", "battalion", "patron"].includes(k) },
  { title: "Ops", match: (k) => k.startsWith("recon_") || k.startsWith("supply_") || k.startsWith("event_") || ["ghost", "warlord", "pilot", "medic"].includes(k) },
  { title: "Maps & status", match: (k) => k.startsWith("night_") || ["livonia", "chernarus", "inner", "asylum"].includes(k) },
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
  const map = await loadMap();
  map.guildId = channel.guild_id;
  const existing = (await discord(`/guilds/${channel.guild_id}/roles`)) as Array<{ id: string; name: string }>;
  let created = 0;
  for (const role of EARN_ROLES) {
    const found = existing.find((r) => r.name === role.name);
    if (found) {
      map.roles[role.key] = found.id;
      continue;
    }
    if (map.roles[role.key] || created >= 12) continue;
    const made = (await discord(`/guilds/${channel.guild_id}/roles`, {
      method: "POST",
      body: JSON.stringify({ name: role.name, mentionable: true, hoist: false, color: 0x16a34a }),
    })) as { id: string };
    map.roles[role.key] = made.id;
    existing.push({ id: made.id, name: role.name });
    created += 1;
  }
  await writeJsonFile("earn-roles.json", map);
  return { map, created, total: Object.keys(map.roles).length, need: EARN_ROLES.length };
}

function mention(map: RoleMap, key: string) {
  const id = map.roles[key];
  const role = EARN_ROLES.find((r) => r.key === key);
  return id ? `<@&${id}>` : `**${role?.name ?? key}**`;
}

function boardPayload(map: RoleMap) {
  const used = new Set<string>();
  const fields = GROUPS.map((g) => {
    const roles = EARN_ROLES.filter((r) => g.match(r.key));
    roles.forEach((r) => used.add(r.key));
    return {
      name: g.title,
      value: roles.slice(0, 10).map((r) => `• ${mention(map, r.key)}`).join("\n").slice(0, 1024) || "—",
      inline: true,
    };
  });
  const menus = GROUPS.slice(0, 5).map((g, idx) => {
    const roles = EARN_ROLES.filter((r) => g.match(r.key)).slice(0, 25);
    return {
      type: 1,
      components: [
        {
          type: 3,
          custom_id: `earn_pick_${idx}`,
          placeholder: g.title,
          options: roles.map((r) => ({
            label: r.name.slice(0, 100),
            value: r.key,
            description: `${r.challenge} · +1000 cr`.slice(0, 100),
          })),
        },
      ],
    };
  });
  return {
    content: "",
    embeds: [
      {
        title: "EARN ROLES",
        description: "Complete the challenge.\nYou receive the **Discord role** and **1,000 credits**.\n\nUse a menu to inspect a role and who holds it.",
        color: 0x22c55e,
        fields: fields.slice(0, 6),
        footer: { text: "DAYZ PRO  ·  dayzpro.online" },
      },
    ],
    components: menus,
    allowed_mentions: { parse: [] },
  };
}

export async function postEarnRolesEmbed() {
  const me = (await discord("/users/@me")) as { id: string };
  const ensured = await ensureEarnRoles();
  const payload = boardPayload(ensured.map);
  const recent = (await discord(`/channels/${CHANNEL}/messages?limit=50`)) as Array<{
    id: string;
    author?: { id?: string };
  }>;
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
  return { ok: true, action: "posted-new", messageId: created.id, bot: me.id, total: ensured.total, need: ensured.need };
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
          { name: "Reward", value: "Role + 1,000 cr", inline: false },
          { name: "Who has it", value: holders.slice(0, 1024), inline: false },
        ],
      },
    ],
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
