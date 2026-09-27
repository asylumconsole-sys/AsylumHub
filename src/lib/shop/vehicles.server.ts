import { db, ShopError } from "./mongo.server";

/**
 * Vehicle shop (server-authoritative). Every classname below was checked against 101's live db/types.xml AND has a
 * full-parts entry in the live cfgspawnabletypes.xml, so a CE vehicle event spawns it drivable (wheels, doors, hood,
 * trunk, battery, plug/glow plug, radiator where the model has one, headlights). Not sold: M3S Blue/Orange (no
 * cfgspawnabletypes entry on 101 -> would spawn without parts), M3S Chassis/Cargo (not in types.xml), boats (land spots only).
 */
export type VehicleVariant = { classname: string; color: string; hex: string };
export type VehicleModel = { id: string; name: string; role: string; price: number; seats: number; parts: string[]; variants: VehicleVariant[] };

const CAR_PARTS = ["4 wheels + spare", "4 doors, hood, trunk", "Car battery", "Spark plug", "Radiator", "2 headlights"];
export const VEHICLE_MODELS: VehicleModel[] = [
  { id: "ada", name: "Ada 4x4", role: "Off-road hatchback", price: 25_000, seats: 4, parts: ["4 wheels + spare", "2 doors, hood, trunk", "Car battery", "Spark plug", "Radiator", "2 headlights", "2 gasoline canisters in cargo"],
    variants: [{ classname: "OffroadHatchback", color: "Green", hex: "#3f6b32" }, { classname: "OffroadHatchback_Blue", color: "Blue", hex: "#1e4d8c" }, { classname: "OffroadHatchback_White", color: "White", hex: "#d6d6d6" }] },
  { id: "gunter", name: "Gunter 2", role: "Compact hatchback", price: 22_000, seats: 4, parts: [...CAR_PARTS, "Gasoline canister in cargo"],
    variants: [{ classname: "Hatchback_02", color: "Red", hex: "#9b1c1c" }, { classname: "Hatchback_02_Black", color: "Black", hex: "#2a2a2a" }, { classname: "Hatchback_02_Blue", color: "Blue", hex: "#2459b8" }] },
  { id: "olga", name: "Olga 24", role: "Civilian sedan", price: 28_000, seats: 4, parts: ["4 wheels (no spare)", "4 doors, hood, trunk", "Car battery", "Spark plug", "Radiator", "2 headlights", "Gasoline canister in cargo"],
    variants: [{ classname: "CivilianSedan", color: "White", hex: "#e8e8e8" }, { classname: "CivilianSedan_Black", color: "Black", hex: "#1c1c1c" }, { classname: "CivilianSedan_Wine", color: "Wine", hex: "#5a1420" }] },
  { id: "sarka", name: "Sarka 120", role: "City sedan", price: 20_000, seats: 4, parts: ["4 wheels (no spare)", "4 doors, hood, trunk", "Car battery", "Spark plug", "Radiator", "2 headlights", "Gasoline canister in cargo"],
    variants: [{ classname: "Sedan_02", color: "Yellow", hex: "#c9a227" }, { classname: "Sedan_02_Grey", color: "Grey", hex: "#7a7a7a" }, { classname: "Sedan_02_Red", color: "Red", hex: "#b42318" }] },
  { id: "m3s", name: "M3S Truck", role: "Covered heavy truck", price: 45_000, seats: 2, parts: ["All wheels + spares", "2 doors, hood", "Truck battery", "2 headlights", "Gasoline canister in cargo"],
    variants: [{ classname: "Truck_01_Covered", color: "Green", hex: "#35582b" }] },
  { id: "humvee", name: "M1025 Humvee", role: "Armored recon", price: 80_000, seats: 4, parts: ["4 wheels + spare", "4 doors, hood, trunk", "Car battery", "Glow plug", "2 headlights", "Gasoline canister in cargo"],
    variants: [{ classname: "Offroad_02", color: "Military", hex: "#4b5320" }] },
];

/** Every whole-vehicle classname (sold or not): never sold as an "item". Parts stay in the item shop. */
export const VEHICLE_HULLS = new Set([
  "OffroadHatchback", "OffroadHatchback_Blue", "OffroadHatchback_White", "Hatchback_02", "Hatchback_02_Black", "Hatchback_02_Blue",
  "CivilianSedan", "CivilianSedan_Black", "CivilianSedan_Wine", "Sedan_02", "Sedan_02_Grey", "Sedan_02_Red",
  "Truck_01_Covered", "Truck_01_Covered_Blue", "Truck_01_Covered_Orange", "Truck_01_Chassis", "Truck_01_Cargo", "Truck_02", "Van_01",
  "Offroad_02", "Boat_01_Blue", "Boat_01_Orange", "Boat_01_Black", "Boat_01_Camo",
]);

export type VehicleSpot = { id: string; label: string; x: number; z: number; a: number };
/**
 * Preset vehicle delivery spots: Bohemia's own vanilla Livonia (DZ_129) VehicleCivilianSedan spawn points that 101 does
 * NOT use (live cfgeventspawns keeps only 1 of 40), so no other CE car competes for them. Each is on a road, >=50 m
 * from every live vehicle spawn, and far from player bases (ADM build logs + custom Object Spawner bases).
 * Vehicles are NEVER delivered to a player's position.
 */
export const VEHICLE_SPOTS: VehicleSpot[] = [
  { id: "veh-se-108-009", label: "South-east farm road · grid 108/009", x: 10872.59, z: 940.38, a: 112.7 },
  { id: "veh-s-061-040", label: "South village road · grid 061/040", x: 6101.03, z: 4090.22, a: 314.3 },
  { id: "veh-e-110-043", label: "East village road · grid 110/043", x: 11050.73, z: 4385.64, a: 328.8 },
  { id: "veh-ne-106-112", label: "North-east village road · grid 106/112", x: 10657.11, z: 11214.11, a: 144.4 },
  { id: "veh-nw-031-120", label: "North-west village road · grid 031/120", x: 3177.36, z: 12065.05, a: 291.8 },
  { id: "veh-w-020-073", label: "West village road · grid 020/073", x: 2026.58, z: 7376.6, a: 280.8 },
];

export const VEHICLE_LIMITS = {
  perOrder: 1,
  perRestart: Number(process.env.SHOP_MAX_VEHICLES_PER_RESTART || 5),
  /** a spot is not reused for 2 restarts, so an uncollected car is never spawned on top of */
  spotCooldownRestarts: 2,
};

const byClass = new Map<string, { model: VehicleModel; variant: VehicleVariant }>();
for (const m of VEHICLE_MODELS) for (const v of m.variants) byClass.set(v.classname.toLowerCase(), { model: m, variant: v });

export function findVehicle(idOrClass: string) {
  const k = String(idOrClass || "").trim().toLowerCase().replace(/^veh:/, "");
  const hit = byClass.get(k);
  if (!hit) return null;
  const { model, variant } = hit;
  return {
    id: variant.classname, classname: variant.classname, name: `${model.name} · ${variant.color}`, price: model.price,
    category: "Vehicles", image: `/api/item-image/${variant.classname}`, hasImage: true, featured: false, kind: "vehicle" as const,
    modelId: model.id,
  };
}

// ---------------------------------------------------------------- atomic reservations (unique index)
const H = 3600_000;
export async function vehicleCapacity(targetIso: string, cadenceHours = 2, dry = false) {
  const d = await db();
  const col = d.collection("shop_vehicle_slots");
  const rows = await col.find({ target: { $in: [targetIso, ...prevTargets(targetIso, cadenceHours)] } }).toArray();
  const ns = dry ? "dry" : "";
  const used = rows.filter((r) => r.target === targetIso && r.kind === `${ns}cap`).length;
  const taken = new Set(rows.filter((r) => r.kind === `${ns}spot`).map((r) => r.spotId as string));
  return { used, max: VEHICLE_LIMITS.perRestart, spots: VEHICLE_SPOTS.map((s) => ({ ...s, available: !taken.has(s.id) })) };
}

function prevTargets(targetIso: string, cadenceHours: number) {
  const t = Date.parse(targetIso);
  return Array.from({ length: VEHICLE_LIMITS.spotCooldownRestarts }, (_, i) => new Date(t - (i + 1) * cadenceHours * H).toISOString());
}

/** Reserve one of the per-restart vehicle slots + the spot (spot also blocked if used in the previous 2 restarts). */
/** dry = flow-test (dry-run) orders: they contend only with each other, never with real customers' spots/slots. */
export async function reserveVehicle(orderId: string, targetIso: string, spotId: string, cadenceHours = 2, dry = false) {
  const d = await db();
  const col = d.collection("shop_vehicle_slots");
  await col.createIndex({ key: 1 }, { unique: true }).catch(() => null);
  const ns = dry ? "dry" : "";
  const K = { spot: `${ns}spot`, cap: `${ns}cap` };
  const recent = await col.findOne({ kind: K.spot, spotId, target: { $in: prevTargets(targetIso, cadenceHours) } });
  if (recent) throw new ShopError(409, "spot_cooldown", "A car was delivered to that spot recently. Pick another spot.");
  try {
    await col.insertOne({ key: `${targetIso}|${K.spot}|${spotId}`, kind: K.spot, spotId, target: targetIso, orderId, at: new Date() });
  } catch (e: any) {
    if (e?.code === 11000) throw new ShopError(409, "spot_taken", "That spot already has a car coming at the next restart. Pick another spot.");
    throw e;
  }
  for (let n = 0; n < VEHICLE_LIMITS.perRestart; n++) {
    try {
      await col.insertOne({ key: `${targetIso}|${K.cap}|${n}`, kind: K.cap, target: targetIso, orderId, at: new Date() });
      return;
    } catch (e: any) {
      if (e?.code !== 11000) throw e;
    }
  }
  await col.deleteMany({ orderId });
  throw new ShopError(409, "restart_full_vehicles", `The next restart already has ${VEHICLE_LIMITS.perRestart} vehicles. Try again after it.`);
}

export async function releaseVehicle(orderId: string) {
  await (await db()).collection("shop_vehicle_slots").deleteMany({ orderId });
}
