import { ECONOMY_GRANTS } from "@/lib/economy-grants";

export type GrantAccount = { playerId: string; displayName: string; balance: number; xp: number };
export type GrantStore = {
  accounts: Record<string, GrantAccount>;
  transfers: Array<{ id: string; fromPlayerId: string; toPlayerId: string; amount: number; note?: string; createdAt: string }>;
  appliedGrants?: string[];
};

export function applyEconomyGrants(store: GrantStore): boolean {
  store.appliedGrants ??= [];
  let dirty = false;
  for (const grant of ECONOMY_GRANTS) {
    if (store.appliedGrants.includes(grant.id)) continue;
    const account = store.accounts[grant.playerId] ?? {
      playerId: grant.playerId,
      displayName: grant.playerId,
      balance: 0,
      xp: 0,
    };
    account.balance += grant.amount;
    store.accounts[grant.playerId] = account;
    store.transfers.unshift({
      id: grant.id,
      fromPlayerId: "system",
      toPlayerId: grant.playerId,
      amount: grant.amount,
      note: grant.note,
      createdAt: new Date().toISOString(),
    });
    store.appliedGrants.push(grant.id);
    dirty = true;
  }
  return dirty;
}
