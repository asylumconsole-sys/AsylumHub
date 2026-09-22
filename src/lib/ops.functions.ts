import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { readJsonFile, writeJsonFile } from "@/lib/dayz/store";
import { getKillfeed } from "@/lib/killfeed.functions";

const ACCEPT_COST = 500;
const REWARDS = [2500, 5000] as const;
const DURATION_MS = 6 * 60 * 60 * 1000;

export type AssassinContract = {
  id: string;
  hunterId: string;
  hunterTag: string;
  targetTag: string;
  reward: number;
  cost: number;
  startedAt: string;
  endsAt: string;
  status: "active" | "completed" | "expired";
};

type OpsStore = { contracts: AssassinContract[] };
type EconomyStore = { accounts: Record<string, { playerId: string; displayName: string; balance: number; xp: number }>; transfers: unknown[] };
type LinkStore = { byDiscordId: Record<string, { discordId: string; username?: string; links?: Array<{ username: string }> }> };

function norm(s: string) {
  return s.trim().toLowerCase();
}

async function loadOps() {
  return readJsonFile<OpsStore>("operations.json", { contracts: [] });
}

async function tagsFor(discordId: string) {
  const links = await readJsonFile<LinkStore>("bot-account-links.json", { byDiscordId: {} });
  const rec = links.byDiscordId[discordId] ?? Object.values(links.byDiscordId).find((r) => r.discordId === discordId);
  const names = new Set<string>();
  if (rec?.username) names.add(rec.username);
  for (const l of rec?.links ?? []) if (l.username) names.add(l.username);
  return [...names];
}

async function allLinkedTags() {
  const links = await readJsonFile<LinkStore>("bot-account-links.json", { byDiscordId: {} });
  const out: string[] = [];
  for (const rec of Object.values(links.byDiscordId)) {
    if (rec.username) out.push(rec.username);
    for (const l of rec.links ?? []) if (l.username) out.push(l.username);
  }
  return [...new Set(out)];
}

async function debit(playerId: string, amount: number) {
  const store = await readJsonFile<EconomyStore>("economy.json", { accounts: {}, transfers: [] });
  const acc = store.accounts[playerId] ?? { playerId, displayName: playerId, balance: 0, xp: 0 };
  if (acc.balance < amount) throw new Error("Need 500 CR to accept this operation");
  acc.balance -= amount;
  store.accounts[playerId] = acc;
  await writeJsonFile("economy.json", store);
  return acc.balance;
}

async function credit(playerId: string, amount: number) {
  const store = await readJsonFile<EconomyStore>("economy.json", { accounts: {}, transfers: [] });
  const acc = store.accounts[playerId] ?? { playerId, displayName: playerId, balance: 0, xp: 0 };
  acc.balance += amount;
  store.accounts[playerId] = acc;
  await writeJsonFile("economy.json", store);
  return acc.balance;
}

async function settle(store: OpsStore) {
  const now = Date.now();
  let feed: Array<{ killer: string; victim: string; at: string }> = [];
  try {
    const kf = await getKillfeed({ data: { server: "all", limit: 400 } });
    feed = kf.events;
  } catch {
    feed = [];
  }
  let dirty = false;
  for (const c of store.contracts) {
    if (c.status !== "active") continue;
    if (now > new Date(c.endsAt).getTime()) {
      c.status = "expired";
      dirty = true;
      continue;
    }
    const start = new Date(c.startedAt).getTime();
    const hit = feed.find(
      (e) =>
        norm(e.killer) === norm(c.hunterTag) &&
        norm(e.victim) === norm(c.targetTag) &&
        new Date(e.at).getTime() >= start,
    );
    if (hit) {
      c.status = "completed";
      await credit(c.hunterId, c.reward);
      dirty = true;
    }
  }
  if (dirty) await writeJsonFile("operations.json", store);
  return store;
}

export const listMyOperations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const hunterId = context.userId || "";
    const store = await settle(await loadOps());
    return {
      offer: {
        title: "Assassin a target",
        cost: ACCEPT_COST,
        durationHours: 6,
        rewards: [...REWARDS],
      },
      mine: store.contracts.filter((c) => c.hunterId === hunterId),
    };
  });

export const acceptAssassin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const hunterId = context.userId || "";
    if (!hunterId) throw new Error("Sign in first");
    const store = await settle(await loadOps());
    if (store.contracts.some((c) => c.hunterId === hunterId && c.status === "active")) {
      throw new Error("You already have an active assassination");
    }
    const mine = await tagsFor(hunterId);
    const hunterTag = mine[0];
    if (!hunterTag) throw new Error("Link a PSN / Xbox tag first");
    const pool = (await allLinkedTags()).filter((t) => !mine.some((m) => norm(m) === norm(t)));
    if (!pool.length) throw new Error("No other linked players to mark");
    const targetTag = pool[Math.floor(Math.random() * pool.length)];
    const reward = REWARDS[Math.floor(Math.random() * REWARDS.length)];
    await debit(hunterId, ACCEPT_COST);
    const now = Date.now();
    const contract: AssassinContract = {
      id: `hit_${now}`,
      hunterId,
      hunterTag,
      targetTag,
      reward,
      cost: ACCEPT_COST,
      startedAt: new Date(now).toISOString(),
      endsAt: new Date(now + DURATION_MS).toISOString(),
      status: "active",
    };
    store.contracts.unshift(contract);
    await writeJsonFile("operations.json", store);
    return contract;
  });
