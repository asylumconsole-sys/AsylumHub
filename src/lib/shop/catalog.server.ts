import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { ITEM_CATALOG as CE } from "@/lib/dayz/item-catalog";
import { ITEM_CATALOG as FEATURED_LIST } from "@/lib/item-shop-catalog";
import { VEHICLE_HULLS, findVehicle } from "./vehicles.server";

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
  image: string; hasImage: boolean; featured: boolean; kind?: "item" | "vehicle";
};
const PART_MODEL: Record<string, [string, string]> = {
  Hatchback_02: ["Gunter 2", "Red"], Sedan_02: ["Sarka 120", "Yellow"], Offroad_02: ["M1025 Humvee", ""], Truck_01: ["M3S Truck", "Green"],
  HatchbackDoors: ["Ada 4x4", "Green"], HatchbackHood: ["Ada 4x4", "Green"], HatchbackTrunk: ["Ada 4x4", "Green"],
  CivSedanDoors: ["Olga 24", "White"], CivSedanHood: ["Olga 24", "White"], CivSedanTrunk: ["Olga 24", "White"],
};
const DOOR_POS: Record<string, string> = { "1_1": "front left", "2_1": "front right", "1_2": "rear left", "2_2": "rear right", Driver: "front left", CoDriver: "front right", BackLeft: "rear left", BackRight: "rear right" };
const PART_CLASSES = /^(CarBattery|TruckBattery|SparkPlug|GlowPlug|CarRadiator|HeadlightH7(_Box)?|HatchbackWheel|CivSedanWheel|Truck_01_WheelDouble)$/;
/** Vehicle parts: readable names ("Sarka 120 door · front left · Grey") and their own category (display only; prices unchanged). */
function vehiclePart(cls: string): { name?: string; category: string } | null {
  let m = cls.match(/^(Hatchback_02|Sedan_02|Offroad_02|Truck_01)_(?:Door_(\d_\d)|(Hood|Trunk|Wheel|WheelDouble))(?:_(\w+))?$/);
  if (m) {
    const [model, dflt] = PART_MODEL[m[1]];
    const part = m[2] ? `door · ${DOOR_POS[m[2]]}` : m[3] === "WheelDouble" ? "double wheel" : m[3].toLowerCase();
    const colour = m[4] ? m[4].replace("Rust", "rusty") : m[3] === "Wheel" || m[3] === "WheelDouble" ? "" : dflt;
    return { name: `${model} ${part}${colour ? ` · ${colour}` : ""}`, category: "Vehicle Parts" };
  }
  m = cls.match(/^(HatchbackDoors|CivSedanDoors)_(Driver|CoDriver|BackLeft|BackRight)(?:_(\w+))?$/) || cls.match(/^(HatchbackHood|HatchbackTrunk|CivSedanHood|CivSedanTrunk)()(?:_(\w+))?$/);
  if (m) {
    const [model, dflt] = PART_MODEL[m[1]];
    const part = m[2] ? `door · ${DOOR_POS[m[2]]}` : m[1].replace(/^(Hatchback|CivSedan)/, "").toLowerCase();
    return { name: `${model} ${part} · ${m[3] || dflt}`, category: "Vehicle Parts" };
  }
  if (cls === "HatchbackWheel") return { name: "Ada 4x4 wheel", category: "Vehicle Parts" };
  if (cls === "CivSedanWheel") return { name: "Olga 24 wheel", category: "Vehicle Parts" };
  return PART_CLASSES.test(cls) ? { category: "Vehicle Parts" } : null;
}

/** Never sold in the item shop: whole vehicles (vehicle shop only; parts stay) and seasonal/joke items. */
export const NOT_ITEMS = new Set<string>([...VEHICLE_HULLS, "EasterEgg"]);
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
    if (!cls || NOT_ITEMS.has(cls) || (sellable && !sellable.has(cls))) continue;
    seen.add(cls);
    const vp = vehiclePart(cls);
    items.push({ id: f.id, classname: cls, name: vp?.name ?? f.name, price: f.price, category: vp?.category ?? f.category, image: `/api/item-image/${cls}`, hasImage: !!d.images[cls], featured: true });
  }
  for (const c of CE) {
    if (seen.has(c.classname) || NOT_ITEMS.has(c.classname) || (sellable && !sellable.has(c.classname)) || featuredBy.has(c.classname)) continue;
    seen.add(c.classname);
    const vp = vehiclePart(c.classname);
    items.push({ id: c.classname, classname: c.classname, name: vp?.name ?? c.name, price: c.price, category: vp?.category ?? c.category, image: `/api/item-image/${c.classname}`, hasImage: !!d.images[c.classname], featured: false });
  }
  const byKey = new Map<string, ShopItem>();
  for (const it of items) {
    byKey.set(it.id.toLowerCase(), it);
    byKey.set(it.classname.toLowerCase(), it);
  }
  built = { key: d, items, byKey };
  return built;
}

/** Item-shop item OR vehicle (cart/checkout accept both; vehicles are listed only in the vehicle shop). */
export async function findItem(idOrClass: string): Promise<(ShopItem & { kind?: "item" | "vehicle" }) | null> {
  const v = findVehicle(idOrClass);
  if (v) return v;
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
