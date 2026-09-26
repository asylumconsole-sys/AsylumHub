import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { ITEM_CATALOG as CE } from "@/lib/dayz/item-catalog";
import { ITEM_CATALOG as FEATURED_LIST } from "@/lib/item-shop-catalog";

export const IMAGE_DIR = path.join(process.env.DAYZ_DATA_DIR?.trim() || path.join(process.cwd(), ".data", "dayz"), "item-images");

/** Curated Item Shop ids (also used by the Discord Activity cart links) -> DayZ classname. */
export const FEATURED_CLASS: Record<string, string> = {
  glock19: "Glock19", deagle: "Deagle", fnx45: "FNX45", "mk-ii": "MKII", m4a1: "M4A1", akm: "AKM", ak74: "AK74", aug: "Aug",
  lar: "FAL", mosin: "Mosin9130", svd: "SVD", vss: "VSS", win70: "Winchester70", mp5: "UMP45", scorpion: "CZ61",
  mp133: "Mp133Shotgun", doublebarrel: "Izh43Shotgun", ij70: "MakarovIJ70", "ammo-556": "AmmoBox_556x45_20Rnd",
  "ammo-762": "AmmoBox_762x39_20Rnd", "ammo-308": "AmmoBox_308Win_20Rnd", "ammo-9mm": "AmmoBox_9x19_25rnd",
  bandage: "BandageDressing", saline: "SalineBagIV", morphine: "Morphine", charcoal: "CharcoalTablets",
  canned: "TacticalBaconCan", water: "Canteen", rice: "Rice", plate: "PlateCarrierVest", ghillie: "GhillieSuit_Mossy",
  helmet: "Mich2001Helmet", knife: "CombatKnife", hatchet: "Hatchet", lockpick: "Lockpick", repair: "WeaponCleaningKit",
  tent: "MediumTent", cooking: "Pot", radio: "PersonalRadio", m79: "M79", bizon: "PP19", repeater: "Repeater",
  cr527: "CZ527", sks: "SKS", saiga: "Saiga", pioneer: "Scout", bk18: "Izh18", nvgoggles: "NVGoggles",
  binoculars: "Binoculars", rangefinder: "Rangefinder",
};

export type ShopItem = {
  id: string; classname: string; name: string; price: number; category: string;
  image: string; hasImage: boolean; featured: boolean;
};
type ShopData = { images: Record<string, string>; sellable?: string[]; fallback?: string[] };

let data: { at: number; mtime: number; d: ShopData } | null = null;
export async function shopData(): Promise<ShopData> {
  if (data && Date.now() - data.at < 60_000) return data.d;
  const file = path.join(IMAGE_DIR, "shop-data.json");
  try {
    const s = await stat(file);
    if (!data || s.mtimeMs !== data.mtime) data = { at: Date.now(), mtime: s.mtimeMs, d: JSON.parse(await readFile(file, "utf8")) };
    else data.at = Date.now();
  } catch {
    data = { at: Date.now(), mtime: 0, d: { images: {} } };
  }
  return data.d;
}

let built: { key: ShopData; items: ShopItem[]; byKey: Map<string, ShopItem> } | null = null;
export async function catalog() {
  const d = await shopData();
  if (built && built.key === d) return built;
  const sellable = d.sellable?.length ? new Set(d.sellable) : null;
  const items: ShopItem[] = [];
  const seen = new Set<string>();
  const featuredBy = new Map(Object.entries(FEATURED_CLASS).map(([id, c]) => [c, id]));
  for (const f of FEATURED_LIST) {
    const cls = FEATURED_CLASS[f.id];
    if (!cls || (sellable && !sellable.has(cls))) continue;
    seen.add(cls);
    items.push({ id: f.id, classname: cls, name: f.name, price: f.price, category: f.category, image: `/api/item-image/${cls}`, hasImage: !!d.images[cls], featured: true });
  }
  for (const c of CE) {
    if (seen.has(c.classname) || (sellable && !sellable.has(c.classname)) || featuredBy.has(c.classname)) continue;
    seen.add(c.classname);
    items.push({ id: c.classname, classname: c.classname, name: c.name, price: c.price, category: c.category, image: `/api/item-image/${c.classname}`, hasImage: !!d.images[c.classname], featured: false });
  }
  const byKey = new Map<string, ShopItem>();
  for (const it of items) {
    byKey.set(it.id.toLowerCase(), it);
    byKey.set(it.classname.toLowerCase(), it);
  }
  built = { key: d, items, byKey };
  return built;
}

export async function findItem(idOrClass: string) {
  return (await catalog()).byKey.get(String(idOrClass || "").trim().toLowerCase()) || null;
}

export function publicOrigin(request: Request) {
  if (process.env.SHOP_PUBLIC_ORIGIN) return process.env.SHOP_PUBLIC_ORIGIN.replace(/\/$/, "");
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  if (host && !/^(localhost|127\.|0\.0\.0\.0)/.test(host)) return `https://${host}`;
  return new URL(request.url).origin;
}

export function withAbsImage(it: ShopItem, origin: string) {
  return { ...it, image: origin + it.image };
}
