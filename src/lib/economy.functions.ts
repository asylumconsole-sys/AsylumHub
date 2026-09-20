import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { readJsonFile, writeJsonFile } from "@/lib/dayz/store";
import { emitHubEvent } from "@/lib/hub-events";
import { applyEconomyGrants } from "@/lib/economy-apply";

export type EconomyAccount = {
		playerId: string;
		displayName: string;
		balance: number;
		xp: number;
};

export type EconomyTransfer = {
		id: string;
		fromPlayerId: string;
		toPlayerId: string;
		amount: number;
		note?: string;
		createdAt: string;
};

type EconomyStore = {
		accounts: Record<string, EconomyAccount>;
		transfers: EconomyTransfer[];
		appliedGrants?: string[];
};

const DEFAULT_STORE: EconomyStore = { accounts: {}, transfers: [] };

async function loadStore() {
		const store = await readJsonFile<EconomyStore>("economy.json", DEFAULT_STORE);
		if (applyEconomyGrants(store)) await writeJsonFile("economy.json", store);
		return store;
}

function accountFor(store: EconomyStore, playerId: string): EconomyAccount {
		const existing = store.accounts[playerId];
		if (existing) return existing;
		const account = { playerId, displayName: playerId === "demo-user" ? "Asylum Demo" : playerId, balance: 0, xp: 0 };
		store.accounts[playerId] = account;
		return account;
}

export const getEconomyBalance = createServerFn({ method: "GET" })
	.middleware([requireSupabaseAuth])
	.inputValidator((data: { playerId?: string }) => data)
	.handler(async ({ data, context }) => {
				const store = await loadStore();
				return accountFor(store, data.playerId ?? context.userId ?? "demo-user");
	});

export const listEconomyLeaderboard = createServerFn({ method: "GET" })
	.middleware([requireSupabaseAuth])
	.handler(async () => {
				const store = await loadStore();
				return Object.values(store.accounts).sort((a, b) => b.balance - a.balance || b.xp - a.xp);
	});

export const listRecentTransfers = createServerFn({ method: "GET" })
	.middleware([requireSupabaseAuth])
	.handler(async () => (await loadStore()).transfers.slice(0, 50));

export const creditPlayer = createServerFn({ method: "POST" })
	.middleware([requireSupabaseAuth])
	.inputValidator((data: { playerId: string; amount: number; note?: string }) => data)
	.handler(async ({ data }) => {
				const store = await loadStore();
				const account = accountFor(store, data.playerId);
				account.balance += Math.floor(data.amount);
				account.xp += Math.max(0, Math.floor(data.amount / 10));
				await writeJsonFile("economy.json", store);
				return account;
	});

export const payPlayer = createServerFn({ method: "POST" })
	.middleware([requireSupabaseAuth])
	.inputValidator((data: { toPlayerId: string; amount: number; note?: string }) => data)
	.handler(async ({ data, context }) => {
				const store = await loadStore();
				const fromPlayerId = context.userId ?? "demo-user";
				const from = accountFor(store, fromPlayerId);
				const amount = Math.floor(Number(data.amount));
				if (!Number.isFinite(amount) || amount <= 0) throw new Error("Amount must be positive");
				if (from.balance < amount) throw new Error("Insufficient credits");
				from.balance -= amount;
				const to = accountFor(store, data.toPlayerId.trim());
				to.balance += amount;
				const transfer: EconomyTransfer = {
								id: `tx_${Date.now().toString(36)}`,
								fromPlayerId,
								toPlayerId: to.playerId,
								amount,
								note: data.note,
								createdAt: new Date().toISOString(),
				};
				store.transfers.unshift(transfer);
				await writeJsonFile("economy.json", store);
				return { transfer, balance: from };
	});

type NpcInventoryStore = {
	owned?: Record<string, string[]>;
	charges: Record<string, Record<string, number>>;
};

const DEFAULT_NPC_INV: NpcInventoryStore = { charges: {} };

async function loadNpcInv() {
	const inv = await readJsonFile<NpcInventoryStore>("npc-inventory.json", DEFAULT_NPC_INV);
	if (!inv.charges) inv.charges = {};
	return inv;
}

function playerCharges(inv: NpcInventoryStore, playerId: string): Record<string, number> {
	const charges = { ...(inv.charges[playerId] ?? {}) };
	for (const npcId of inv.owned?.[playerId] ?? []) {
		if ((charges[npcId] ?? 0) <= 0) charges[npcId] = 25;
	}
	return charges;
}

export const getNpcInventory = createServerFn({ method: "GET" })
	.middleware([requireSupabaseAuth])
	.inputValidator((data: { playerId?: string }) => data)
	.handler(async ({ data, context }) => {
		const playerId = data.playerId ?? context.userId ?? "demo-user";
		const inv = await loadNpcInv();
		const charges = playerCharges(inv, playerId);
		const owned = Object.entries(charges).filter(([, n]) => n > 0).map(([id]) => id);
		return { playerId, charges, owned };
	});

export const purchaseNpc = createServerFn({ method: "POST" })
	.middleware([requireSupabaseAuth])
	.inputValidator((data: {
		playerId?: string;
		displayName?: string;
		npcId: string;
		npcName?: string;
		price: number;
		spawns: number;
		serverId?: "101" | "102" | null;
	}) => data)
	.handler(async ({ data, context }) => {
		const playerId = data.playerId ?? context.userId ?? "demo-user";
		const displayName = data.displayName ?? playerId;
		const npcId = data.npcId?.trim();
		const price = Math.floor(Number(data.price));
		const spawns = Math.floor(Number(data.spawns));
		if (!npcId) throw new Error("NPC id required");
		if (!Number.isFinite(price) || price < 0) throw new Error("Invalid price");
		if (!Number.isFinite(spawns) || spawns <= 0) throw new Error("Invalid spawn pack size");
		const inv = await loadNpcInv();
		const charges = playerCharges(inv, playerId);
		const store = await loadStore();
		const account = accountFor(store, playerId);
		account.displayName = displayName;
		if (account.balance < price) throw new Error("Insufficient credits");
		account.balance -= price;
		store.transfers.unshift({ id: `tx_${Date.now().toString(36)}`, fromPlayerId: playerId, toPlayerId: "system", amount: price, note: `NPC pack: ${npcId} x${spawns}`, createdAt: new Date().toISOString() });
		charges[npcId] = (charges[npcId] ?? 0) + spawns;
		inv.charges[playerId] = charges;
		if (inv.owned?.[playerId]) inv.owned[playerId] = (inv.owned[playerId] ?? []).filter((id) => id !== npcId);
		await writeJsonFile("economy.json", store);
		await writeJsonFile("npc-inventory.json", inv);
		const owned = Object.entries(charges).filter(([, n]) => n > 0).map(([id]) => id);
		return { alreadyOwned: false as const, account, owned, charges, spawnsAdded: spawns };
	});

export const consumeNpcSpawn = createServerFn({ method: "POST" })
	.middleware([requireSupabaseAuth])
	.inputValidator((data: { playerId?: string; npcId: string }) => data)
	.handler(async ({ data, context }) => {
		const playerId = data.playerId ?? context.userId ?? "demo-user";
		const npcId = data.npcId?.trim();
		if (!npcId) throw new Error("NPC id required");
		const inv = await loadNpcInv();
		const charges = playerCharges(inv, playerId);
		const left = charges[npcId] ?? 0;
		if (left <= 0) throw new Error("No spawn charges left — buy a pack first");
		charges[npcId] = left - 1;
		inv.charges[playerId] = charges;
		if (inv.owned?.[playerId]) inv.owned[playerId] = (inv.owned[playerId] ?? []).filter((id) => id !== npcId);
		await writeJsonFile("npc-inventory.json", inv);
		return { playerId, npcId, remaining: charges[npcId] };
	});

type ShopInventoryStore = { owned: Record<string, string[]> };
const DEFAULT_SHOP_INV: ShopInventoryStore = { owned: {} };
async function loadShopInv() {
	return readJsonFile<ShopInventoryStore>("shop-inventory.json", DEFAULT_SHOP_INV);
}

export const getShopInventory = createServerFn({ method: "GET" })
	.middleware([requireSupabaseAuth])
	.inputValidator((data: { playerId?: string }) => data)
	.handler(async ({ data, context }) => {
		const playerId = data.playerId ?? context.userId ?? "demo-user";
		const inv = await loadShopInv();
		return { playerId, owned: inv.owned[playerId] ?? [] };
	});

export const purchaseShopItem = createServerFn({ method: "POST" })
	.middleware([requireSupabaseAuth])
	.inputValidator((data: {
		playerId?: string; displayName?: string; itemId: string; itemName?: string; price: number;
		category: "item" | "uav"; serverId?: "101" | "102" | null; allowRepeat?: boolean;
	}) => data)
	.handler(async ({ data, context }) => {
		const playerId = data.playerId ?? context.userId ?? "demo-user";
		const displayName = data.displayName ?? playerId;
		const itemId = data.itemId?.trim();
		const category = data.category;
		const price = Math.floor(Number(data.price));
		const allowRepeat = Boolean(data.allowRepeat);
		if (!itemId) throw new Error("Item id required");
		if (category !== "item" && category !== "uav") throw new Error("Invalid category");
		if (!Number.isFinite(price) || price < 0) throw new Error("Invalid price");
		const inv = await loadShopInv();
		const owned = new Set(inv.owned[playerId] ?? []);
		const store = await loadStore();
		const account = accountFor(store, playerId);
		account.displayName = displayName;
		if (!allowRepeat && owned.has(itemId)) return { alreadyOwned: true as const, account, owned: [...owned] };
		if (account.balance < price) throw new Error("Insufficient credits");
		account.balance -= price;
		store.transfers.unshift({ id: `tx_${Date.now().toString(36)}`, fromPlayerId: playerId, toPlayerId: "system", amount: price, note: `${category} purchase: ${itemId}`, createdAt: new Date().toISOString() });
		if (!allowRepeat) {
			owned.add(itemId);
			inv.owned[playerId] = [...owned];
			await writeJsonFile("shop-inventory.json", inv);
		}
		await writeJsonFile("economy.json", store);
		return { alreadyOwned: false as const, account, owned: inv.owned[playerId] ?? [...owned] };
	});
