import { listBans, getBan, type BanRecord } from "@/lib/bans-store";

const DISCORD_API = "https://discord.com/api/v10";
const CHANNEL = process.env.DISCORD_BANS_CHANNEL_ID || "1450540542839488532";

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
  if (!res.ok) throw new Error(`Discord ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

function detailEmbed(ban: BanRecord) {
  return {
    title: ban.name,
    color: 0xef4444,
    fields: [
      { name: "When", value: ban.bannedAt, inline: true },
      { name: "Duration", value: ban.duration || "Permanent", inline: true },
      { name: "Type", value: ban.kind === "id" ? "ID ban" : "Gamertag ban", inline: true },
      { name: "Reason", value: ban.reason || "—", inline: false },
      { name: "Bail", value: ban.bail || "No bail", inline: true },
      { name: "Servers", value: ban.servers?.join(", ") || "101x + 102x", inline: true },
    ],
    footer: { text: "DAYZ PRO · banned players" },
  };
}

function listPayload(bans: BanRecord[]) {
  const names =
    bans.length === 0
      ? "No active bans on file. Staff can add them in the hub."
      : bans
          .slice(0, 40)
          .map((b, i) => `${i + 1}. **${b.name}** · ${b.kind === "id" ? "ID" : "GT"} · ${b.duration || "perm"}`)
          .join("\n");
  const options = bans.slice(0, 25).map((b) => ({
    label: b.name.slice(0, 100),
    value: b.id,
    description: `${b.kind === "id" ? "ID" : "Gamertag"} · ${b.duration || "perm"}`.slice(0, 100),
  }));
  return {
    embeds: [
      {
        title: "Banned players",
        description: names.slice(0, 4000),
        color: 0x7f1d1d,
        footer: { text: "Pick a name below for when / why / duration / bail / servers" },
        timestamp: new Date().toISOString(),
      },
    ],
    components: options.length
      ? [
          {
            type: 1,
            components: [
              {
                type: 3,
                custom_id: "ban_pick",
                placeholder: "Click a banned name",
                options,
              },
            ],
          },
        ]
      : [],
  };
}

export async function postBansEmbed() {
  const bans = await listBans();
  const payload = listPayload(bans);
  const recent = (await discord(`/channels/${CHANNEL}/messages?limit=15`)) as Array<{
    id: string;
    author?: { bot?: boolean };
    embeds?: Array<{ title?: string }>;
  }>;
  const existing = recent.find((m) => m.author?.bot && m.embeds?.some((e) => /banned players/i.test(e.title || "")));
  if (existing) {
    await discord(`/channels/${CHANNEL}/messages/${existing.id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    return { ok: true, action: "edited", count: bans.length, messageId: existing.id };
  }
  const created = (await discord(`/channels/${CHANNEL}/messages`, {
    method: "POST",
    body: JSON.stringify(payload),
  })) as { id: string };
  return { ok: true, action: "posted", count: bans.length, messageId: created.id };
}

export async function banDetailResponse(banId: string) {
  const ban = await getBan(banId);
  if (!ban) return { embeds: [{ title: "Ban not found", color: 0x6b7280 }] };
  return { embeds: [detailEmbed(ban)] };
}
