import { readJsonFile, writeJsonFile } from "@/lib/dayz/store";
import { ITEM_CATALOG, type ShopItem } from "@/lib/item-shop-catalog";
import { NPCS } from "@/lib/npc/roster";
import { SPAWN_PACKS } from "@/lib/npc/spawn-packs";
import { discordGet } from "@/lib/staff-embed";

export const SHOP_CHANNEL_ID = process.env.DISCORD_SHOP_CHANNEL_ID || "1476822217810776184";
const HUB = "https://dayzpro.online";
const GOLD = 0xd4a84b;
const BANNER =
  "https://raw.githubusercontent.com/asylumconsole-sys/AsylumHub/main/src/assets/console-1.jpg";

type EconomyStore = {
  accounts: Record<string, { playerId: string; displayName: string; balance: number; xp: number }>;
  transfers: Array<{ id: string; fromPlayerId: string; toPlayerId: string; amount: number; note?: string; createdAt: string }>;
};

type NpcInv = { charges: Record<string, Record<string, number>>; owned?: Record<string, string[]> };

function accountFor(store: EconomyStore, playerId: string, displayName: string) {
  store.accounts[playerId] ??= { playerId, displayName, balance: 0, xp: 0 };
  store.accounts[playerId].displayName = displayName || store.accounts[playerId].displayName;
  return store.accounts[playerId];
}

export function shopBoardPayload() {
  const cats = [...new Set(ITEM_CATALOG.map((i) => i.category))];
  return {
    embeds: [
      {
        title: "DAYZ PRO SHOP",
        color: GOLD,
        image: { url: BANNER },
        thumbnail: { url: BANNER },
      },
    ],
    components: [
      {
        type: 1,
        components: [
          {
            type: 3,
            custom_id: "shop_npc_pick",
            placeholder: "NPC",
            options: NPCS.slice(0, 25).map((n) => ({ label: n.name.slice(0, 100), value: n.id })),
          },
        ],
      },
      {
        type: 1,
        components: [
          {
            type: 3,
            custom_id: "shop_icat",
            placeholder: "Items",
            options: cats.slice(0, 25).map((c) => ({ label: c, value: c })),
          },
        ],
      },
      {
        type: 1,
        components: [
          { type: 2, style: 1, label: "Credits", custom_id: "shop_bal" },
          { type: 2, style: 5, label: "Hub", url: `${HUB}/tools` },
        ],
      },
    ],
  };
}

export function npcPickPayload(npcId: string) {
  const npc = NPCS.find((n) => n.id === npcId);
  if (!npc) return { flags: 64, content: "Unknown NPC." };
  return {
    flags: 64,
    content: npc.name,
    components: [
      {
        type: 1,
        components: SPAWN_PACKS.map((p) => ({
          type: 2,
          style: 3,
          label: `${p.spawns}  ·  ${p.price.toLocaleString()}`,
          custom_id: `shop_nbuy:${npc.id}:${p.spawns}:${p.price}`,
        })),
      },
    ],
  };
}

export function itemCategoryPayload(category: string) {
  const items = ITEM_CATALOG.filter((i) => i.category === category).slice(0, 25);
  return {
    flags: 64,
    content: category,
    components: [
      {
        type: 1,
        components: [
          {
            type: 3,
            custom_id: "shop_item",
            placeholder: "Buy",
            options: items.map((i) => ({
              label: i.name.slice(0, 100),
              value: i.id,
              description: `${i.price.toLocaleString()} cr`.slice(0, 100),
            })),
          },
        ],
      },
    ],
  };
}

export function itemPickPayload(itemId: string) {
  const item = ITEM_CATALOG.find((i) => i.id === itemId);
  if (!item) return { flags: 64, content: "Unknown item." };
  return {
    flags: 64,
    content: `${item.name}  ·  ${item.price.toLocaleString()} cr`,
    embeds: item.image ? [{ color: GOLD, image: { url: item.image } }] : [],
    components: [
      {
        type: 1,
        components: [{ type: 2, style: 3, label: "Buy", custom_id: `shop_ibuy:${item.id}` }],
      },
    ],
  };
}

export async function shopBalance(userId: string, displayName: string) {
  const store = await readJsonFile<EconomyStore>("economy.json", { accounts: {}, transfers: [] });
  const inv = await readJsonFile<NpcInv>("npc-inventory.json", { charges: {} });
  const account = accountFor(store, userId, displayName);
  const charges = Object.entries(inv.charges[userId] ?? {}).filter(([, n]) => n > 0);
  const npcLine = charges.length ? charges.map(([id, n]) => `${NPCS.find((x) => x.id === id)?.name ?? id} ${n}`).join("  ·  ") : "no NPC charges";
  return { flags: 64, content: `**${account.balance.toLocaleString()}** cr\n${npcLine}` };
}

export async function buyNpcPack(userId: string, displayName: string, npcId: string, spawns: number, price: number) {
  const npc = NPCS.find((n) => n.id === npcId);
  if (!npc) return "Unknown NPC.";
  const pack = SPAWN_PACKS.find((p) => p.spawns === spawns) ?? SPAWN_PACKS[0];
  const charge = pack?.price ?? price;
  const qty = pack?.spawns ?? spawns;
  const store = await readJsonFile<EconomyStore>("economy.json", { accounts: {}, transfers: [] });
  const inv = await readJsonFile<NpcInv>("npc-inventory.json", { charges: {} });
  const account = accountFor(store, userId, displayName);
  if (account.balance < charge) return `${account.balance.toLocaleString()} / ${charge.toLocaleString()} cr`;
  account.balance -= charge;
  store.transfers.unshift({
    id: `tx_${Date.now().toString(36)}`,
    fromPlayerId: userId,
    toPlayerId: "system",
    amount: charge,
    note: `shop npc ${npc.name} x${qty}`,
    createdAt: new Date().toISOString(),
  });
  inv.charges[userId] ??= {};
  inv.charges[userId][npcId] = (inv.charges[userId][npcId] ?? 0) + qty;
  await writeJsonFile("economy.json", store);
  await writeJsonFile("npc-inventory.json", inv);
  return `${npc.name}  +${qty}   ·   ${account.balance.toLocaleString()} cr`;
}

export async function buyShopItem(userId: string, displayName: string, itemId: string) {
  const item: ShopItem | undefined = ITEM_CATALOG.find((i) => i.id === itemId);
  if (!item) return "Unknown item.";
  const store = await readJsonFile<EconomyStore>("economy.json", { accounts: {}, transfers: [] });
  const account = accountFor(store, userId, displayName);
  if (account.balance < item.price) return `${account.balance.toLocaleString()} / ${item.price.toLocaleString()} cr`;
  account.balance -= item.price;
  store.transfers.unshift({
    id: `tx_${Date.now().toString(36)}`,
    fromPlayerId: userId,
    toPlayerId: "system",
    amount: item.price,
    note: `shop item ${item.name}`,
    createdAt: new Date().toISOString(),
  });
  await writeJsonFile("economy.json", store);
  return `${item.name}   ·   ${account.balance.toLocaleString()} cr`;
}

export async function publishShopBoard(channelId = SHOP_CHANNEL_ID) {
  const token = process.env.DISCORD_TOKEN?.replace(/^Bot\s+/i, "");
  if (!token || !channelId) return { ok: false, error: "no token/channel" };
  const headers = { Authorization: `Bot ${token}`, "Content-Type": "application/json" };
  const recent = (await discordGet(`/channels/${channelId}/messages?limit=50`)) as Array<{
    id: string;
    embeds?: Array<{ title?: string }>;
  }>;
  const wipe = new Set(["DAYZ PRO · NPC Shop", "DAYZ PRO · Item Shop", "DAYZ PRO SHOP"]);
  for (const msg of recent || []) {
    if (wipe.has(msg.embeds?.[0]?.title || "")) {
      await fetch(`https://discord.com/api/v10/channels/${channelId}/messages/${msg.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bot ${token}` },
      }).catch(() => null);
    }
  }
  const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: "POST",
    headers,
    body: JSON.stringify(shopBoardPayload()),
  });
  const posted = await res.json();
  return { ok: res.ok, channelId, posted };
}
