import {
  BASE_ADMIN_CHANNEL,
  type CustomBase,
  daysUntil,
  firstOfNextMonth,
  loadBases,
  mapLink,
  saveBases,
} from "@/lib/custom-bases";

const KEEP_OWNER_ID = "1281756735161241621";

function botHeaders() {
  const token = process.env.DISCORD_TOKEN?.replace(/^Bot\s+/i, "");
  if (!token) return null;
  return { Authorization: `Bot ${token}`, "Content-Type": "application/json" };
}

function onlyDennis(store: { bases: CustomBase[] }) {
  const keep =
    store.bases.find((b) => b.code === "df4507049") ||
    store.bases.find((b) => /dennis fox/i.test(b.name));
  const base: CustomBase = keep
    ? {
        ...keep,
        name: "Dennis Fox",
        ownerName: "Dennis Fox",
        ownerDiscordId: KEEP_OWNER_ID,
        monthlyCost: 55_000,
        status: "active",
        despawnAt: undefined,
      }
    : {
        code: "df4507049",
        name: "Dennis Fox",
        ownerDiscordId: KEEP_OWNER_ID,
        ownerName: "Dennis Fox",
        monthlyCost: 55_000,
        amountPaid: 0,
        createdAt: new Date().toISOString(),
        nextDueAt: firstOfNextMonth(),
        status: "active",
      };
  store.bases = [base];
  return store;
}

export function baseDetailEmbed(base: CustomBase) {
  const due = daysUntil(base.nextDueAt);
  return {
    title: `${base.name} · ${base.code}`,
    color: base.status === "active" ? 0xd4a84b : base.status === "despawned" ? 0x666666 : 0xff4d4d,
    fields: [
      { name: "Owner", value: `<@${base.ownerDiscordId}>\n${base.ownerName}`, inline: true },
      { name: "Faction", value: base.faction || "—", inline: true },
      { name: "Status", value: base.status, inline: true },
      { name: "Created", value: base.createdAt.slice(0, 10), inline: true },
      { name: "Next rent", value: `${due}d · ${base.nextDueAt.slice(0, 10)}`, inline: true },
      { name: "Monthly", value: `${base.monthlyCost.toLocaleString()} cr`, inline: true },
      { name: "Paid so far", value: `${base.amountPaid.toLocaleString()} cr`, inline: true },
      { name: "Coords", value: base.x != null ? `Y ${base.x} / Z ${base.z}` : "unknown", inline: true },
      { name: "Map", value: mapLink(base), inline: false },
    ],
  };
}

export function boardPayload(bases: CustomBase[]) {
  const live = bases.filter((b) => b.status !== "despawned");
  const lines = live.slice(0, 20).map(
    (b) => `• **${b.name}** · \`${b.code}\` · <@${b.ownerDiscordId}> · ${b.monthlyCost.toLocaleString()} cr/mo`,
  );
  return {
    content: "",
    embeds: [
      {
        title: "DAYZ PRO · Custom bases",
        description: live.length ? lines.join("\n") : "No custom bases yet.",
        color: 0xd4a84b,
        footer: { text: `${live.length} active bases · rent on the 1st` },
      },
    ],
    components: [
      {
        type: 1,
        components: [
          {
            type: 3,
            custom_id: "base_select",
            placeholder: "Open a base",
            options: live.slice(0, 25).map((b) => ({
              label: `${b.name} · ${b.code}`.slice(0, 100),
              value: b.code,
              description: `${b.ownerName} · ${b.monthlyCost.toLocaleString()} cr`.slice(0, 100),
            })),
          },
        ],
      },
    ].filter((row) => (row.components[0] as { options?: unknown[] }).options?.length),
  };
}

export async function publishBaseBoard() {
  const headers = botHeaders();
  if (!headers) return { ok: false, error: "no discord token" };
  const store = onlyDennis(await loadBases());
  await saveBases(store);
  const body = boardPayload(store.bases);
  if (store.adminMessageId) {
    const edit = await fetch(`https://discord.com/api/v10/channels/${BASE_ADMIN_CHANNEL}/messages/${store.adminMessageId}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(body),
    });
    if (edit.ok) return { ok: true, messageId: store.adminMessageId, live: store.bases };
  }
  const created = await fetch(`https://discord.com/api/v10/channels/${BASE_ADMIN_CHANNEL}/messages`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const msg = (await created.json()) as { id?: string; message?: string };
  if (msg.id) {
    store.adminMessageId = msg.id;
    await saveBases(store);
  }
  return { ok: created.ok, messageId: msg.id, error: msg.message, live: store.bases };
}

export async function dmOwner(discordId: string, text: string) {
  const headers = botHeaders();
  if (!headers) return;
  const ch = await fetch("https://discord.com/api/v10/users/@me/channels", {
    method: "POST",
    headers,
    body: JSON.stringify({ recipient_id: discordId }),
  });
  const channel = (await ch.json()) as { id?: string };
  if (!channel.id) return;
  await fetch(`https://discord.com/api/v10/channels/${channel.id}/messages`, {
    method: "POST",
    headers,
    body: JSON.stringify({ content: text }),
  });
}

export async function listGuildMembers(query?: string) {
  const headers = botHeaders();
  const guild = process.env.DISCORD_GUILD_ID;
  if (!headers || !guild) return [];
  const url = query
    ? `https://discord.com/api/v10/guilds/${guild}/members/search?query=${encodeURIComponent(query)}&limit=25`
    : `https://discord.com/api/v10/guilds/${guild}/members?limit=100`;
  const res = await fetch(url, { headers });
  const rows = (await res.json()) as Array<{ user?: { id: string; username: string; bot?: boolean } }>;
  if (!Array.isArray(rows)) return [];
  return rows.filter((r) => r.user && !r.user.bot).map((r) => ({ id: r.user!.id, username: r.user!.username }));
}
