import { readJsonFile, writeJsonFile } from "@/lib/dayz/store";
import { BUILDER_CHANNEL_ID, BUILDER_ROLE_ID, PRO_BUILDER_KIT, PRO_BUILDER_PRICE, type ProBuildOrder } from "@/lib/pro-build";

const DISCORD_API = "https://discord.com/api/v10";

function token() {
  const raw = process.env.DISCORD_TOKEN;
  if (!raw) throw new Error("DISCORD_TOKEN missing");
  return raw.replace(/^Bot\s+/i, "");
}

async function discord(path: string, init?: RequestInit) {
  const res = await fetch(`${DISCORD_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bot ${token()}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Discord ${res.status}: ${text.slice(0, 280)}`);
  return text ? JSON.parse(text) : null;
}

async function listBuilders() {
  const guild = process.env.DISCORD_GUILD_ID;
  if (!guild) return [] as Array<{ id: string; name: string }>;
  const members = (await discord(`/guilds/${guild}/members?limit=1000`)) as Array<{
    user?: { id: string; username: string; global_name?: string | null; bot?: boolean };
    nick?: string | null;
    roles?: string[];
  }>;
  return members
    .filter((m) => (m.roles ?? []).includes(BUILDER_ROLE_ID) && m.user && !m.user.bot)
    .map((m) => ({
      id: m.user!.id,
      name: (m.nick || m.user!.global_name || m.user!.username).slice(0, 55),
    }))
    .slice(0, 8);
}

async function dm(userId: string, content: string) {
  const ch = await discord("/users/@me/channels", {
    method: "POST",
    body: JSON.stringify({ recipient_id: userId }),
  });
  await discord(`/channels/${ch.id}/messages`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}

export async function placeProBuildOrder(input: {
  playerId: string;
  playerName: string;
  discordId?: string;
  mode: "base" | "map";
  x?: number;
  z?: number;
  baseConfirmed: boolean;
  attachments: Array<{ name: string; type: string; bytes: Buffer }>;
}) {
  if (input.attachments.length < 3) throw new Error("Select at least 3 base photos");
  if (!input.baseConfirmed) throw new Error("Confirm the base location first");

  const eco = await readJsonFile<{
    accounts: Record<string, { playerId: string; displayName: string; balance: number; xp: number }>;
    transfers: unknown[];
  }>("economy.json", { accounts: {}, transfers: [] });
  const acc = eco.accounts[input.playerId] ?? {
    playerId: input.playerId,
    displayName: input.playerName,
    balance: 0,
    xp: 0,
  };
  if (acc.balance < PRO_BUILDER_PRICE) throw new Error("Need 200,000 credits");
  acc.balance -= PRO_BUILDER_PRICE;
  eco.accounts[input.playerId] = acc;
  await writeJsonFile("economy.json", eco);

  const order: ProBuildOrder = {
    id: `pb-${Date.now()}`,
    playerId: input.playerId,
    playerName: input.playerName,
    discordId: input.discordId,
    mode: input.mode,
    x: input.x,
    z: input.z,
    baseConfirmed: true,
    images: input.attachments.map((a) => a.name),
    status: "queued",
    createdAt: new Date().toISOString(),
  };
  const store = await readJsonFile<{ orders: ProBuildOrder[] }>("pro-build-orders.json", { orders: [] });
  store.orders.push(order);
  await writeJsonFile("pro-build-orders.json", store);

  const builders = await listBuilders();
  const coords =
    Number.isFinite(order.x) && Number.isFinite(order.z) ? `Y ${order.x} / Z ${order.z}` : "coords pending in ticket";
  const mention = order.discordId ? `<@${order.discordId}>` : order.playerName;
  const ticket =
    `**PRO Builder order** ${order.id}\nBuyer: ${mention}\nDrop: ${coords}\nPhotos: ${order.images.join(", ")}\nKit: ${PRO_BUILDER_KIT.waves}\nStaff place this. Player was told the AI drops it within 4 hours.`;

  const form = new FormData();
  form.append(
    "payload_json",
    JSON.stringify({
      content: `<@&${BUILDER_ROLE_ID}> New PRO Builder buy — ${mention} paid 200,000 cr.`,
      embeds: [{ title: "PRO Builder ticket", description: ticket.slice(0, 4000), color: 0xd4a84b }],
      allowed_mentions: { parse: ["roles", "users"] },
    }),
  );
  input.attachments.slice(0, 8).forEach((file, i) => {
    form.append(`files[${i}]`, new Blob([file.bytes], { type: file.type }), file.name);
  });
  const fileRes = await fetch(`${DISCORD_API}/channels/${BUILDER_CHANNEL_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bot ${token()}` },
    body: form,
  });
  if (!fileRes.ok) {
    const err = await fileRes.text();
    throw new Error(`Discord photos ${fileRes.status}: ${err.slice(0, 220)}`);
  }

  const answers = [
    ...builders.map((b) => ({ poll_media: { text: b.name } })),
    { poll_media: { text: "AI / unassigned" } },
  ].slice(0, 10);
  const posted = await discord(`/channels/${BUILDER_CHANNEL_ID}/messages`, {
    method: "POST",
    body: JSON.stringify({
      content: "Who is building it?",
      poll: {
        question: { text: "Who builds this PRO Builder drop?" },
        answers,
        duration: 48,
        allow_multiselect: false,
      },
    }),
  });

  for (const b of builders) {
    try {
      await dm(
        b.id,
        `PRO Builder buy: **${order.playerName}** paid 200k. Ticket ${order.id} in <#${BUILDER_CHANNEL_ID}>. Vote the poll if you can take the build.`,
      );
    } catch {
      /* DMs closed */
    }
  }
  if (order.discordId) {
    try {
      await dm(
        order.discordId,
        `PRO Builder is queued. Drop within **4 hours** after coords + 3 base photos. Ticket ${order.id}.`,
      );
    } catch {
      /* ignore */
    }
  }
  try {
    const msgId = posted?.id;
    if (msgId && answers.length) {
      await discord(`/channels/${BUILDER_CHANNEL_ID}/polls/${msgId}/answers/${answers.length}`, { method: "PUT" });
    }
  } catch {
    /* optional */
  }
  return { order, ticketChannel: BUILDER_CHANNEL_ID, pollId: posted?.id ?? null };
}
