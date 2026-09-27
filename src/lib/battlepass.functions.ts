import { createServerFn } from "@tanstack/react-start";
import { readJsonFile, writeJsonFile } from "@/lib/dayz/store";
import { db } from "@/lib/shop/mongo.server";
import { optionalUser } from "@/lib/shop/auth.server";

type PassRecord = { xp: number; premium: boolean; claimed: string[]; days: Record<string, number> };
type PassStore = { players: Record<string, PassRecord> };
const EMPTY: PassRecord = { xp: 0, premium: false, claimed: [], days: {} };

async function userFrom(accessToken: string) {
  const request = new Request("https://dayzpro.online/api/shop/wallet", { headers: { authorization: `Bearer ${accessToken}` } });
  const user = await optionalUser(request);
  if (!user?.id) throw new Error("Sign in with Discord first");
  return user;
}

async function load() {
  return readJsonFile<PassStore>("battlepass.json", { players: {} });
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export const getBattlepass = createServerFn({ method: "POST" })
  .inputValidator((data: { accessToken: string }) => data)
  .handler(async ({ data }) => {
    const user = await userFrom(data.accessToken);
    const store = await load();
    return { playerId: user.id, ...(store.players[user.id] ?? EMPTY) };
  });

export const grantBattlepassXp = createServerFn({ method: "POST" })
  .inputValidator((data: { accessToken: string; amount: number; reason: string }) => data)
  .handler(async ({ data }) => {
    const user = await userFrom(data.accessToken);
    const amount = Math.max(0, Math.min(500, Math.floor(data.amount)));
    const store = await load();
    const row = store.players[user.id] ?? { ...EMPTY, claimed: [], days: {} };
    row.xp += amount;
    const day = today();
    row.days[day] = (row.days[day] ?? 0) + amount;
    store.players[user.id] = row;
    await writeJsonFile("battlepass.json", store);
    return row;
  });

export const unlockBattlepass = createServerFn({ method: "POST" })
  .inputValidator((data: { accessToken: string }) => data)
  .handler(async ({ data }) => {
    const user = await userFrom(data.accessToken);
    const price = 25000;
    const players = (await db()).collection("players");
    const after = await players.findOneAndUpdate(
      { discordId: user.id, credits: { $gte: price } },
      { $inc: { credits: -price } },
      { returnDocument: "after" },
    );
    if (!after) throw new Error("Not enough credits for premium. It costs 25,000 cr.");
    const store = await load();
    const row = store.players[user.id] ?? { ...EMPTY, claimed: [], days: {} };
    row.premium = true;
    store.players[user.id] = row;
    await writeJsonFile("battlepass.json", store);
    return { ...row, credits: Number(after.credits) };
  });

export const claimBattlepassReward = createServerFn({ method: "POST" })
  .inputValidator((data: { accessToken: string; id: string; credits: number; premium: boolean }) => data)
  .handler(async ({ data }) => {
    const user = await userFrom(data.accessToken);
    const store = await load();
    const row = store.players[user.id] ?? { ...EMPTY, claimed: [], days: {} };
    if (data.premium && !row.premium) throw new Error("Premium track is locked");
    if (row.claimed.includes(data.id)) return row;
    const credits = Math.max(0, Math.min(20000, Math.floor(data.credits)));
    if (credits > 0) {
      await (await db()).collection("players").updateOne({ discordId: user.id }, { $inc: { credits } });
    }
    row.claimed = [...row.claimed, data.id];
    store.players[user.id] = row;
    await writeJsonFile("battlepass.json", store);
    return row;
  });
