import { readJsonFile, writeJsonFile } from "@/lib/dayz/store";

export type BanRecord = {
  id: string;
  name: string;
  kind: "id" | "gamertag";
  reason: string;
  bannedAt: string;
  duration: string;
  bail: string;
  servers: string[];
  active: boolean;
};

type BanStore = { bans: BanRecord[] };

export async function listBans() {
  const store = await readJsonFile<BanStore>("bans.json", { bans: [] });
  return (store.bans ?? []).filter((b) => b.active !== false);
}

export async function getBan(id: string) {
  return (await listBans()).find((b) => b.id === id || b.name.toLowerCase() === id.toLowerCase()) ?? null;
}

export async function upsertBan(ban: BanRecord) {
  const store = await readJsonFile<BanStore>("bans.json", { bans: [] });
  const next = [...(store.bans ?? []).filter((b) => b.id !== ban.id), ban];
  await writeJsonFile("bans.json", { bans: next });
  return ban;
}
