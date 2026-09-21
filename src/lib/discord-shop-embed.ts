import { readJsonFile, writeJsonFile } from "@/lib/dayz/store";
import { ITEM_CATALOG, type ShopItem } from "@/lib/item-shop-catalog";
import { NPCS } from "@/lib/npc/roster";
import { SPAWN_PACKS } from "@/lib/npc/spawn-packs";
import { discordGet, discordPost } from "@/lib/staff-embed";

export const SHOP_CHANNEL_ID = process.env.DISCORD_SHOP_CHANNEL_ID || "1476822217810776184";
const HUB = "https://dayzpro.online";
const GOLD = 0xd4a84b;

type EconomyStore = {
  accounts: Record<string, { playerId: string; displayName: string; balance: number; xp: number }>;
  transfers: Array<{ id: string; fromPlayerId: string; toPlayerId: string; amount: number; note?: string; createdAt: string }>;
};

type NpcInv = {
  charges: Record<string, Record<string, number>>;
  owned?: Record<string, string[]>;
};

function accountFor(store: EconomyStore, playerId: string, displayName: string) {
  store.accounts[playerId] ??= { playerId, displayName, balance: 0, xp: 0 };
  store.accounts[playerId].displayName = displayName || store.accounts[playerId].displayName;
  return store.accounts[playerId];
}

export function npcShopPayload() {
  const lines = NPCS.map((n) => `**${n.name}** · ${n.role}\n${n.description}`).join("\n\n");
  const packs = SPAWN_PACKS.map((p) => `${p.label} — **${p.spawns}** spawns · **${p.price.toLocaleString()}** cr`).join("\n");
  return {
    embeds: [
      {
        title: "DAYZ PRO · NPC Shop",
        color: GOLD,
        description: [
          "Same operators as the Hub. Credits come off your Hub wallet (Discord ID).",
          "",
          packs,
          "",
          lines.slice(0, 3500),
        ].join("\n"),
        footer: { text: "Pick an operator, then tap a pack." },
      },
    ],
    components: [
      {
        type: 1,
        components: [
          {
            type: 3,
            custom_id: "shop_npc_pick",
            placeholder: "Choose operator",
            options: NPCS.slice(0, 25).map((n) => ({
              label: n.name.slice(0, 100),
              value: n.id,
              description: n.role.slice(0, 100),
            })),
          },
        ],
      },
      {
        type: 1,
        components: [
          { type: 2, style: 5, label: "Open Hub NPC Shop", url: `${HUB}/tools/npc-shop` },
        ],
      },
    ],
  };
}

export function itemShopPayload() {
  const cats = [...new Set(ITEM_CATALOG.map((i) => i.category))];
  return {
    embeds: [
      {
        title: "DAYZ PRO · Item Shop",
        color: GOLD,
        description: [
          `${ITEM_CATALOG.length} items. Same catalog and prices as the Hub.`,
          "Pick a category, then the item, then Buy.",
          "",
          cats.map((c) => `• **${c}** · ${ITEM_CATALOG.filter((i) => i.category === c).length}`).join("\n"),
        ].join("\n"),
        footer: { text: "Purchases use Hub credits." },
      },
    ],
    components: [
      {
        type: 1,
        components: [
          {
            type: 3,
            custom_id: "shop_icat",
            placeholder: "Item category",
            options: cats.slice(0, 25).map((c) => ({
              label: c,
              value: c,
              description: `${ITEM_CATALOG.filter((i) => i.category === c).length} items`,
            })),
          },
        ],
      },
      {
        type: 1,
        components: [{ type: 2, style: 5, label: "Open Hub Item Shop", url: `${HUB}/tools` }],
      },
    ],
  };
}

export function itemCategoryPayload(category: string) {
  const items = ITEM_CATALOG.filter((i) => i.category === category).slice(0, 25);
  return {
    flags: 64,
    content: `**${category}** — pick an item`,
    components: [
      {
        type: 1,
        components: [
          {
            type: 3,
            custom_id: "shop_item",
            placeholder: category,
            options: items.map((i) => ({
              label: `${i.name}`.slice(0, 100),
              value: i.id,
              description: `${i.price.toLocaleString()} cr`.slice(0, 100),
            })),
          },
        ],
      },
    ],
  };
}

export function npcPickPayload(npcId: string) {
  const npc = NPCS.find((n) => n.id === npcId);
  if (!npc) return { flags: 64, content: "Unknown operator." };
  return {
    flags: 64,
    content: `**${npc.name}** — ${npc.role}\n${npc.description}\nChoose a pack:`,
    components: [
      {
        type: 1,
        components: SPAWN_PACKS.map((p) => ({
          type: 2,
          style: 1,
          label: `${p.label} ${p.spawns} · ${p.price.toLocaleString()} cr`.slice(0, 80),
          custom_id: `shop_nbuy:${npc.id}:${p.spawns}:${p.price}`,
        })),
      },
    ],
  };
}

export function itemPickPayload(itemId: string) {
  const item = ITEM_CATALOG.find((i) => i.id === itemId);
  if (!item) return { flags: 64, content: "Unknown item." };
  return {
    flags: 64,
    content: `**${item.name}** · ${item.category}\n${item.price.toLocaleString()} credits`,
    embeds: item.image ? [{ title: item.name, image: { url: item.image }, color: GOLD }] : [],
    components: [
      {
        type: 1,
        components: [{ type: 2, style: 3, label: `Buy · ${item.price.toLocaleString()} cr`, custom_id: `shop_ibuy:${item.id}` }],
      },
    ],
  };
}

export async function buyNpcPack(userId: string, displayName: string, npcId: string, spawns: number, price: number) {
  const npc = NPCS.find((n) => n.id === npcId);
  if (!npc) return `Unknown operator.`;
  const pack = SPAWN_PACKS.find((p) => p.spawns === spawns && p.price === price) ?? SPAWN_PACKS.find((p) => p.spawns === spawns);
  const charge = pack?.price ?? price;
  const qty = pack?.spawns ?? spawns;
  const store = await readJsonFile<EconomyStore>("economy.json", { accounts: {}, transfers: [] });
  const inv = await readJsonFile<NpcInv>("npc-inventory.json", { charges: {} });
  const account = accountFor(store, userId, displayName);
  if (account.balance < charge) {
    return `Not enough credits. You have **${account.balance.toLocaleString()}** cr — need **${charge.toLocaleString()}**.`;
  }
  account.balance -= charge;
  store.transfers.unshift({
    id: `tx_${Date.now().toString(36)}`,
    fromPlayerId: userId,
    toPlayerId: "system",
    amount: charge,
    note: `Discord NPC pack: ${npc.name} x${qty}`,
    createdAt: new Date().toISOString(),
  });
  inv.charges[userId] ??= {};
  inv.charges[userId][npcId] = (inv.charges[userId][npcId] ?? 0) + qty;
  await writeJsonFile("economy.json", store);
  await writeJsonFile("npc-inventory.json", inv);
  return `Bought **${npc.name}** · +${qty} spawns. Wallet **${account.balance.toLocaleString()}** cr · charges **${inv.charges[userId][npcId]}**. Spawn from the Hub.`;
}

export async function buyShopItem(userId: string, displayName: string, itemId: string) {
  const item: ShopItem | undefined = ITEM_CATALOG.find((i) => i.id === itemId);
  if (!item) return "Unknown item.";
  const store = await readJsonFile<EconomyStore>("economy.json", { accounts: {}, transfers: [] });
  const account = accountFor(store, userId, displayName);
  if (account.balance < item.price) {
    return `Not enough credits. You have **${account.balance.toLocaleString()}** cr — need **${item.price.toLocaleString()}**.`;
  }
  account.balance -= item.price;
  store.transfers.unshift({
    id: `tx_${Date.now().toString(36)}`,
    fromPlayerId: userId,
    toPlayerId: "system",
    amount: item.price,
    note: `Discord item: ${item.name}`,
    createdAt: new Date().toISOString(),
  });
  await writeJsonFile("economy.json", store);
  return `Bought **${item.name}** for **${item.price.toLocaleString()}** cr. Wallet **${account.balance.toLocaleString()}** cr. Claim / spawn it from the Hub item shop.`;
}

export async function publishShopBoard(channelId = SHOP_CHANNEL_ID) {
  if (!channelId) return { ok: false, error: "no shop channel" };
  const recent = (await discordGet(`/channels/${channelId}/messages?limit=40`)) as Array<{
    id: string;
    embeds?: Array<{ title?: string }>;
  }>;
  const titles = new Set(["DAYZ PRO · NPC Shop", "DAYZ PRO · Item Shop"]);
  for (const msg of recent || []) {
    const title = msg.embeds?.[0]?.title || "";
    if (titles.has(title)) {
      await discordPost(`/channels/${channelId}/messages/${msg.id}`, null).catch(() => null);
      await fetchDelete(channelId, msg.id);
    }
  }
  const npc = await discordPost(`/channels/${channelId}/messages`, npcShopPayload());
  const items = await discordPost(`/channels/${channelId}/messages`, itemShopPayload());
  return { ok: true, channelId, npc, items };
}

async function fetchDelete(channelId: string, messageId: string) {
  const token = process.env.DISCORD_TOKEN?.replace(/^Bot\s+/i, "");
  if (!token) return;
  await fetch(`https://discord.com/api/v10/channels/${channelId}/messages/${messageId}`, {
    method: "DELETE",
    headers: { Authorization: `Bot ${token}` },
  }).catch(() => null);
}
