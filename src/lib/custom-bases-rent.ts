import { readJsonFile, writeJsonFile } from "@/lib/dayz/store";
import { firstOfNextMonth, loadBases, mapLink, saveBases, type CustomBase } from "@/lib/custom-bases";
import { dmOwner } from "@/lib/custom-bases-discord";

type EconomyStore = {
  accounts: Record<string, { playerId: string; displayName: string; balance: number; xp: number }>;
  transfers: Array<{ id: string; fromPlayerId: string; toPlayerId: string; amount: number; note?: string; createdAt: string }>;
};

function account(store: EconomyStore, id: string) {
  if (!store.accounts[id]) store.accounts[id] = { playerId: id, displayName: id, balance: 0, xp: 0 };
  return store.accounts[id];
}

export async function runMonthlyRent(force = false) {
  const now = new Date();
  const isFirst = now.getUTCDate() === 1;
  const store = await loadBases();
  const key = now.toISOString().slice(0, 7);
  if (!force && store.lastRentRun === key && isFirst) return { skipped: true, billed: 0 };
  if (!force && !isFirst) {
    const overdue = await markDespawns(store.bases);
    if (overdue) await saveBases(store);
    return { skipped: true, billed: 0, despawned: overdue };
  }

  const economy = await readJsonFile<EconomyStore>("economy.json", { accounts: {}, transfers: [] });
  let billed = 0;
  for (const base of store.bases) {
    if (base.status === "despawned") continue;
    const acc = account(economy, base.ownerDiscordId);
    if (acc.balance >= base.monthlyCost) {
      acc.balance -= base.monthlyCost;
      base.amountPaid += base.monthlyCost;
      base.status = "active";
      base.despawnAt = undefined;
      base.nextDueAt = firstOfNextMonth(now);
      billed += 1;
      await dmOwner(
        base.ownerDiscordId,
        [
          `DAYZ PRO base rent`,
          `Base: ${base.name} (${base.code})`,
          `Coords: Y ${base.x ?? "?"} / Z ${base.z ?? "?"}`,
          `Map: ${mapLink(base)}`,
          `${base.monthlyCost.toLocaleString()} cr was taken from your hub account.`,
          `Next due: ${base.nextDueAt.slice(0, 10)}`,
        ].join("\n"),
      );
    } else {
      base.status = "despawn_warned";
      base.despawnAt = new Date(Date.now() + 48 * 3600_000).toISOString();
      await dmOwner(
        base.ownerDiscordId,
        [
          `DAYZ PRO — not enough credits for base rent.`,
          `Base: ${base.name} (${base.code})`,
          `Due: ${base.monthlyCost.toLocaleString()} cr · you have ${acc.balance.toLocaleString()} cr`,
          `Coords: Y ${base.x ?? "?"} / Z ${base.z ?? "?"}`,
          `Map: ${mapLink(base)}`,
          `The base will auto-despawn in 48 hours unless you add credits.`,
        ].join("\n"),
      );
    }
  }
  await markDespawns(store.bases);
  store.lastRentRun = key;
  await writeJsonFile("economy.json", economy);
  await saveBases(store);
  return { skipped: false, billed };
}

async function markDespawns(bases: CustomBase[]) {
  let n = 0;
  const now = Date.now();
  for (const base of bases) {
    if (base.status === "despawn_warned" && base.despawnAt && Date.parse(base.despawnAt) <= now) {
      base.status = "despawned";
      n += 1;
      await dmOwner(base.ownerDiscordId, `Base ${base.name} (${base.code}) was despawned — rent unpaid.`);
    }
  }
  return n;
}
