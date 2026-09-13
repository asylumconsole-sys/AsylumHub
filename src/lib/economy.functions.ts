import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { readJsonFile, writeJsonFile } from "@/lib/dayz/store";
import { emitHubEvent } from "@/lib/hub-events";

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
};

const DEFAULT_STORE: EconomyStore = { accounts: {}, transfers: [] };

async function loadStore() {
		return readJsonFile<EconomyStore>("economy.json", DEFAULT_STORE);
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
		owned: Record<string, string[]>;
};

const DEFAULT_NPC_INV: NpcInventoryStore = { owned: {} };

async function loadNpcInv() {
		return readJsonFile<NpcInventoryStore>("npc-inventory.json", DEFAULT_NPC_INV);
}

export const getNpcInventory = createServerFn({ method: "GET" })
	.middleware([requireSupabaseAuth])
	.inputValidator((data: { playerId?: string }) => data)
	.handler(async ({ data, context }) => {
				const playerId = data.playerId ?? context.userId ?? "demo-user";
				const inv = await loadNpcInv();
				return { playerId, owned: inv.owned[playerId] ?? [] };
	});

export const purchaseNpc = createServerFn({ method: "POST" })
	.middleware([requireSupabaseAuth])
	.inputValidator((data: {
				playerId?: string;
				displayName?: string;
				npcId: string;
				npcName?: string;
				price: number;
				serverId?: "101" | "102" | null;
	}) => data)
	.handler(async ({ data, context }) => {
				const playerId = data.playerId ?? context.userId ?? "demo-user";
				const displayName = data.displayName ?? playerId;
				const npcId = data.npcId?.trim();
				const price = Math.floor(Number(data.price));
				if (!npcId) throw new Error("NPC id required");
				if (!Number.isFinite(price) || price < 0) throw new Error("Invalid price");

			 		const inv = await loadNpcInv();
				const owned = new Set(inv.owned[playerId] ?? []);
				const store = await loadStore();
				const account = accountFor(store, playerId);
				account.displayName = displayName;

			 		if (owned.has(npcId)) {
									return { alreadyOwned: true as const, account, owned: [...owned] };
					}
				if (account.balance < price) throw new Error("Insufficient credits");

			 		account.balance -= price;
				const transfer: EconomyTransfer = {
								id: `tx_${Date.now().toString(36)}`,
								fromPlayerId: playerId,
								toPlayerId: "system",
								amount: price,
								note: `NPC purchase: ${npcId}`,
								createdAt: new Date().toISOString(),
				};
				store.transfers.unshift(transfer);
				owned.add(npcId);
				inv.owned[playerId] = [...owned];
				await writeJsonFile("economy.json", store);
				await writeJsonFile("npc-inventory.json", inv);

			 		emitHubEvent({
									type: "shop.purchase",
									playerId,
									playerName: displayName,
									serverId: data.serverId ?? null,
									ts: Date.now(),
									meta: {
														category: "npc",
														itemId: npcId,
														itemName: data.npcName ?? npcId,
														price,
														currency: "credits",
									},
					});

			 		return { alreadyOwned: false as const, account, owned: inv.owned[playerId] };
	});
