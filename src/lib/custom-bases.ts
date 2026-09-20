import { readJsonFile, writeJsonFile } from "@/lib/dayz/store";

export const BASE_ADMIN_CHANNEL = "1538876416236462080";
export const DEFAULT_MONTHLY_RENT = 55_000;

export type CustomBase = {
  code: string;
  name: string;
  ownerDiscordId: string;
  ownerName: string;
  faction?: string;
  x?: number;
  z?: number;
  map?: "livonia" | "chernarus";
  monthlyCost: number;
  amountPaid: number;
  createdAt: string;
  nextDueAt: string;
  status: "active" | "overdue" | "despawn_warned" | "despawned";
  despawnAt?: string;
};

type Store = {
  bases: CustomBase[];
  lastRentRun?: string;
  adminMessageId?: string;
};

const EMPTY: Store = { bases: [] };

export async function loadBases() {
  return readJsonFile<Store>("custom-bases.json", EMPTY);
}

export async function saveBases(store: Store) {
  await writeJsonFile("custom-bases.json", store);
}

export function makeBaseCode(discordName: string) {
  const letters = (discordName || "xx").replace(/[^a-zA-Z]/g, "").toLowerCase();
  const prefix = (letters.slice(0, 2) || "xx").padEnd(2, "x");
  const nums = String(Math.floor(1000000 + Math.random() * 9000000));
  return `${prefix}${nums}`;
}

export function firstOfNextMonth(from = new Date()) {
  return new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1, 8, 0, 0)).toISOString();
}

export function mapLink(base: CustomBase) {
  const y = base.x ?? 0;
  const z = base.z ?? 0;
  return `https://dayzpro.online/tools/base-map-clicker?y=${y}&z=${z}`;
}

export function daysUntil(iso: string) {
  const ms = Date.parse(iso) - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}
