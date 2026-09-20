import { readJsonFile, writeJsonFile } from "@/lib/dayz/store";
import { LIVONIA_ZONES, ZONE_REWARD, inZone } from "@/lib/challenges/livonia-zones";

type Discoveries = Record<string, string[]>;
type Notices = Array<{ id: string; playerId: string; text: string; at: string; read?: boolean }>;

async function dmDiscord(discordId: string, text: string) {
  const token = process.env.DISCORD_TOKEN;
  if (!token || !discordId) return false;
  const headers = {
    Authorization: `Bot ${token.replace(/^Bot\s+/i, "")}`,
    "Content-Type": "application/json",
  };
  const ch = await fetch("https://discord.com/api/v10/users/@me/channels", {
    method: "POST",
    headers,
    body: JSON.stringify({ recipient_id: discordId }),
  });
  if (!ch.ok) return false;
  const channel = (await ch.json()) as { id: string };
  const msg = await fetch(`https://discord.com/api/v10/channels/${channel.id}/messages`, {
    method: "POST",
    headers,
    body: JSON.stringify({ content: text }),
  });
  return msg.ok;
}

export async function listDiscoveries(playerId: string) {
  const store = await readJsonFile<{ found: Discoveries }>("zone-discoveries.json", { found: {} });
  return store.found[playerId] ?? [];
}

export async function listNotices(playerId: string) {
  const store = await readJsonFile<{ items: Notices }>("hub-notices.json", { items: [] });
  return store.items.filter((n) => n.playerId === playerId).slice(-20).reverse();
}

export async function recordDiscoveries(input: {
  playerId: string;
  discordId?: string;
  psn?: string;
  x?: number;
  z?: number;
}) {
  if (!Number.isFinite(input.x) || !Number.isFinite(input.z)) {
    return { awarded: [] as string[], remaining: LIVONIA_ZONES.length };
  }
  const store = await readJsonFile<{ found: Discoveries }>("zone-discoveries.json", { found: {} });
  const have = new Set(store.found[input.playerId] ?? []);
  const awarded: string[] = [];
  for (const zone of LIVONIA_ZONES) {
    if (have.has(zone.id)) continue;
    if (!inZone(input.x as number, input.z as number, zone)) continue;
    have.add(zone.id);
    awarded.push(zone.id);
    try {
      const { creditPlayer } = await import("@/lib/economy.functions");
      await creditPlayer({ data: { playerId: input.playerId, amount: ZONE_REWARD, note: `zone:${zone.id}` } as never });
    } catch {
      const eco = await readJsonFile<{ accounts?: Record<string, { balance: number; xp?: number }> }>("economy.json", {});
      const acc = (eco.accounts ??= {});
      const row = (acc[input.playerId] ??= { balance: 0, xp: 0 });
      row.balance += ZONE_REWARD;
      await writeJsonFile("economy.json", eco);
    }
    const text = `Zone discovered: ${zone.name} (Livonia). +${ZONE_REWARD} credits.`;
    const notices = await readJsonFile<{ items: Notices }>("hub-notices.json", { items: [] });
    notices.items.push({
      id: `${Date.now()}-${zone.id}`,
      playerId: input.playerId,
      text,
      at: new Date().toISOString(),
    });
    await writeJsonFile("hub-notices.json", notices);
    if (input.discordId) {
      await dmDiscord(input.discordId, `**DAYZ PRO** — ${text}`);
    }
  }
  store.found[input.playerId] = [...have];
  await writeJsonFile("zone-discoveries.json", store);
  return { awarded, found: [...have], remaining: LIVONIA_ZONES.length - have.size };
}
