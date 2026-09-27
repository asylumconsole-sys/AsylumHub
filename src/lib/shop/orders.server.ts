import { randomUUID } from "node:crypto";
import { db, ShopError } from "./mongo.server";
import { catalog, findItem } from "./catalog.server";
import { myLastPosition, safeSpots } from "./delivery.server";
import { restartSchedule } from "./status.server";
import { VEHICLE_LIMITS, VEHICLE_SPOTS, releaseVehicle, reserveVehicle } from "./vehicles.server";
import type { ShopUser } from "./auth.server";

export const LIMITS = {
  maxItemsPerOrder: Number(process.env.SHOP_MAX_ITEMS_PER_ORDER || 10),
  maxLinesPerOrder: 10,
  maxItemsPerRestart: Number(process.env.SHOP_MAX_ITEMS_PER_RESTART || 60),
  maxQtyPerLine: 10,
  maxPositionAgeMin: 360,
};
export const DELIVERY_LABEL = "Arrives at next server restart (every 2h)";
export const VEHICLE_NOTE = "Your car spawns with all parts at the chosen vehicle spot when the server restarts (every 2h).";
const OPEN = ["pending_payment", "paid", "queued", "uploaded"];
type Line = { id: string; qty: number };
type Cart = { discordId: string; lines: Line[]; updatedAt: Date; source?: string };

// ---------------------------------------------------------------- wallet (Mongo players.credits = Discord wallet)
export async function wallet(discordId: string) {
  const p = await (await db()).collection("players").findOne({ discordId }, { projection: { credits: 1 } });
  return { discordId, credits: Number(p?.credits ?? 0), exists: !!p, currency: "CR" };
}

// ---------------------------------------------------------------- cart
async function priced(lines: Line[]) {
  const out = [];
  for (const l of lines) {
    const it = await findItem(l.id);
    if (!it) continue;
    const kind = it.kind === "vehicle" ? "vehicle" : "item";
    const qty = kind === "vehicle" ? 1 : l.qty;
    out.push({ id: it.id, classname: it.classname, name: it.name, category: it.category, image: it.image, unitPrice: it.price, qty, lineTotal: it.price * qty, kind });
  }
  return out;
}

export async function cartView(user: ShopUser) {
  const c = (await (await db()).collection<Cart>("shop_carts").findOne({ discordId: user.id })) ?? { lines: [] as Line[], updatedAt: null, source: undefined };
  const lines = await priced(c.lines);
  const total = lines.reduce((s, l) => s + l.lineTotal, 0);
  const itemCount = lines.reduce((s, l) => s + l.qty, 0);
  const w = await wallet(user.id);
  const veh = lines.filter((l) => l.kind === "vehicle");
  const items = lines.filter((l) => l.kind !== "vehicle");
  const vehicleTotal = veh.reduce((s, l) => s + l.lineTotal, 0);
  const itemsTotal = total - vehicleTotal;
  return {
    ok: true, lines, total, itemCount, currency: "CR", wallet: w, canAfford: w.credits >= total, limits: { ...LIMITS, vehiclesPerOrder: VEHICLE_LIMITS.perOrder, vehiclesPerRestart: VEHICLE_LIMITS.perRestart },
    deliveryLabel: DELIVERY_LABEL, updatedAt: c.updatedAt, source: c.source ?? null,
    // vehicles check out on their own (1 per order, vehicle spots only); items check out separately
    groups: {
      vehicle: veh.length ? { total: vehicleTotal, count: veh.length, canAfford: w.credits >= vehicleTotal } : null,
      items: items.length ? { total: itemsTotal, count: items.reduce((s, l) => s + l.qty, 0), canAfford: w.credits >= itemsTotal } : null,
    },
  };
}

function clampQty(q: unknown) {
  const n = Math.floor(Number(q));
  if (!Number.isFinite(n) || n < 0) throw new ShopError(400, "bad_qty", "Quantity must be a whole number");
  return Math.min(n, LIMITS.maxQtyPerLine);
}

export async function cartMutate(user: ShopUser, op: "add" | "set" | "remove" | "clear" | "replace", body: { id?: string; qty?: number; lines?: Array<{ id: string; qty: number }>; source?: string }) {
  const col = (await db()).collection<Cart>("shop_carts");
  const cur = (await col.findOne({ discordId: user.id }))?.lines ?? [];
  let lines = [...cur];
  const kinds = new Map<string, string>();
  const key = async (id?: string) => {
    const it = id ? await findItem(id) : null;
    if (!it) throw new ShopError(404, "unknown_item", `Unknown item: ${id}`);
    kinds.set(it.id, it.kind === "vehicle" ? "vehicle" : "item");
    return it.id;
  };
  if (op === "clear") lines = [];
  else if (op === "replace" || (op === "add" && body.lines)) {
    const next = op === "replace" ? [] : lines;
    for (const l of body.lines || []) {
      const it = await findItem(l.id);
      if (!it) continue;
      kinds.set(it.id, it.kind === "vehicle" ? "vehicle" : "item");
      const q = clampQty(l.qty ?? 1);
      const i = next.findIndex((x) => x.id === it.id);
      if (i >= 0) next[i] = { id: it.id, qty: Math.min(LIMITS.maxQtyPerLine, next[i].qty + q) };
      else if (q > 0) next.push({ id: it.id, qty: q });
    }
    lines = next;
  } else {
    const id = await key(body.id);
    const i = lines.findIndex((x) => x.id === id);
    if (op === "remove") lines = lines.filter((x) => x.id !== id);
    else if (op === "set") {
      const q = clampQty(body.qty);
      if (q === 0) lines = lines.filter((x) => x.id !== id);
      else if (i >= 0) lines[i] = { id, qty: q };
      else lines.push({ id, qty: q });
    } else {
      const q = clampQty(body.qty ?? 1) || 1;
      if (i >= 0) lines[i] = { id, qty: Math.min(LIMITS.maxQtyPerLine, lines[i].qty + q) };
      else lines.push({ id, qty: q });
    }
  }
  if (lines.length > 30) throw new ShopError(400, "cart_full", "Cart is full (30 different items max)");
  // vehicles: qty is always 1 and only one vehicle can sit in the cart (1 vehicle per order)
  for (const l of lines) if (!kinds.has(l.id)) { const it = await findItem(l.id); kinds.set(l.id, it?.kind === "vehicle" ? "vehicle" : "item"); }
  lines = lines.map((l) => (kinds.get(l.id) === "vehicle" ? { ...l, qty: 1 } : l));
  const vehs = lines.filter((l) => kinds.get(l.id) === "vehicle");
  if (vehs.length > VEHICLE_LIMITS.perOrder) {
    const keep = vehs[vehs.length - 1].id;
    lines = lines.filter((l) => kinds.get(l.id) !== "vehicle" || l.id === keep);
  }
  await col.updateOne({ discordId: user.id }, { $set: { lines, updatedAt: new Date(), ...(body.source ? { source: String(body.source).slice(0, 40) } : {}) } }, { upsert: true });
  return cartView(user);
}

// ---------------------------------------------------------------- orders
function publicOrder(o: Record<string, any>) {
  const { _id, idemKey, bridge, ...rest } = o;
  return { ...rest, deliveryLabel: DELIVERY_LABEL, intents: bridge?.intents?.length ?? 0 };
}

async function reconcile(o: Record<string, any>) {
  if (o.state !== "pending_payment" || Date.now() - new Date(o.createdAt).getTime() < 60_000) return o;
  const d = await db();
  const p = await d.collection("players").findOne({ discordId: o.discordId, shopDebits: o.orderId }, { projection: { _id: 1 } });
  const state = p ? "paid" : "rejected";
  await d.collection("shop_orders").updateOne({ orderId: o.orderId, state: "pending_payment" }, { $set: { state, updatedAt: new Date() }, $push: { history: { at: new Date(), state, note: "reconciled" } } as never });
  return { ...o, state };
}

export async function listOrders(user: ShopUser, limit = 25) {
  const rows = await (await db()).collection("shop_orders").find({ discordId: user.id, state: { $ne: "rejected" } }).sort({ createdAt: -1 }).limit(Math.min(50, limit)).toArray();
  const sched = await restartSchedule();
  return { ok: true, orders: await Promise.all(rows.map(async (o) => publicOrder(await reconcile(o)))), restart: sched };
}

export async function getOrder(user: ShopUser, orderId: string) {
  const o = await (await db()).collection("shop_orders").findOne({ orderId, discordId: user.id });
  if (!o) throw new ShopError(404, "not_found", "Order not found");
  return { ok: true, order: publicOrder(await reconcile(o)), restart: await restartSchedule() };
}

type CheckoutBody = { delivery?: { mode?: string; spotId?: string }; idempotencyKey?: string; lines?: unknown; scope?: string };
/**
 * One checkout at a time per account (unique _id lock), so parallel requests with different idempotency keys can never
 * charge the same cart twice. A replay with the same key returns the original order.
 */
export async function checkout(user: ShopUser, body: CheckoutBody, idemHeader?: string | null) {
  const d = await db();
  const idemKey = String(idemHeader || body.idempotencyKey || "").slice(0, 80) || null;
  if (idemKey) {
    const prev = await d.collection("shop_orders").findOne({ idemKey: `${user.id}:${idemKey}` });
    if (prev) return { ok: true, duplicate: true, order: publicOrder(await reconcile(prev)), wallet: await wallet(user.id) };
  }
  const locks = d.collection("shop_checkout_locks");
  const at = new Date();
  try {
    await locks.insertOne({ _id: user.id as never, at });
  } catch (e: any) {
    if (e?.code !== 11000) throw e;
    const stale = await locks.findOneAndUpdate({ _id: user.id as never, at: { $lt: new Date(Date.now() - 60_000) } }, { $set: { at } });
    if (!stale) throw new ShopError(409, "checkout_in_progress", "A checkout is already running for your account. Check My orders in a moment.");
  }
  try {
    return await checkoutLocked(user, body, idemHeader);
  } finally {
    await locks.deleteOne({ _id: user.id as never, at }).catch(() => null);
  }
}

async function checkoutLocked(user: ShopUser, body: CheckoutBody, idemHeader?: string | null) {
  const d = await db();
  const orders = d.collection("shop_orders");
  const idemKey = String(idemHeader || body.idempotencyKey || "").slice(0, 80) || null;
  if (idemKey) {
    const prev = await orders.findOne({ idemKey: `${user.id}:${idemKey}` });
    if (prev) return { ok: true, duplicate: true, order: publicOrder(await reconcile(prev)), wallet: await wallet(user.id) };
  }
  // Prices always come from the server catalog; any client-sent prices/lines are ignored.
  const cart = await d.collection<Cart>("shop_carts").findOne({ discordId: user.id });
  const all = await priced(cart?.lines ?? []);
  if (!all.length) throw new ShopError(400, "cart_empty", "Your cart is empty");
  const hasVeh = all.some((l) => l.kind === "vehicle"), hasItems = all.some((l) => l.kind !== "vehicle");
  const scope = body.scope === "vehicle" || body.scope === "items" ? body.scope : hasVeh && !hasItems ? "vehicle" : !hasVeh ? "items" : null;
  if (!scope) throw new ShopError(400, "choose_scope", "Your cart has a vehicle and items. Vehicles check out on their own: pick which to pay for first.");
  const isVehicle = scope === "vehicle";
  const lines = all.filter((l) => (l.kind === "vehicle") === isVehicle);
  if (!lines.length) throw new ShopError(400, "cart_empty", isVehicle ? "No vehicle in your cart" : "No items in your cart");
  if (isVehicle && (lines.length !== 1 || lines[0].qty !== 1)) throw new ShopError(400, "one_vehicle", "One vehicle per order");
  const itemCount = lines.reduce((s, l) => s + l.qty, 0);
  if (itemCount > LIMITS.maxItemsPerOrder) throw new ShopError(400, "too_many_items", `Max ${LIMITS.maxItemsPerOrder} items per order`);
  if (lines.length > LIMITS.maxLinesPerOrder) throw new ShopError(400, "too_many_lines", `Max ${LIMITS.maxLinesPerOrder} different items per order`);
  const total = lines.reduce((s, l) => s + l.lineTotal, 0);

  // Delivery spot. Vehicles: preset vehicle spots only (never a player's position).
  const mode = isVehicle ? "vehicle_spot" : body.delivery?.mode === "last_position" ? "last_position" : "safe_spot";
  let spot: { mode: string; label: string; x: number; y: number; z: number; a?: number; spotId?: string; psn?: string; seenAt?: string | null };
  if (isVehicle) {
    const s = VEHICLE_SPOTS.find((x) => x.id === body.delivery?.spotId) ?? null;
    if (!s) throw new ShopError(400, "bad_spot", "Pick a vehicle spot");
    spot = { mode, label: s.label, x: s.x, y: 0, z: s.z, a: s.a, spotId: s.id };
  } else if (mode === "last_position") {
    const me = await myLastPosition(user.id);
    if (!me.position) throw new ShopError(409, "no_position", me.reason || "No recent position");
    if (me.position.ageMinutes != null && me.position.ageMinutes > LIMITS.maxPositionAgeMin) throw new ShopError(409, "position_stale", "Your last known position is too old; pick a safe spot");
    spot = { mode, label: `My last position (${me.psn})`, x: me.position.x, y: me.position.y, z: me.position.z, psn: me.psn!, seenAt: me.position.seenAt };
  } else {
    const s = safeSpots().find((x) => x.id === body.delivery?.spotId) ?? null;
    if (!s) throw new ShopError(400, "bad_spot", "Pick a safe spot");
    spot = { mode, label: s.label, x: s.x, y: s.y, z: s.z, spotId: s.id };
  }

  // Per-restart capacity
  const sched = await restartSchedule();
  const target = sched.nextDeliveryRestartAt;
  const agg = isVehicle ? [] : await orders.aggregate([{ $match: { state: { $in: ["paid", "queued"] }, targetRestartAt: target, kind: { $ne: "vehicle" } } }, { $group: { _id: null, n: { $sum: "$itemCount" } } }]).toArray();
  const used = Number(agg[0]?.n ?? 0);
  if (!isVehicle && used + itemCount > LIMITS.maxItemsPerRestart) {
    throw new ShopError(409, "restart_full", `The next restart is full (${used}/${LIMITS.maxItemsPerRestart} items). Try again after it.`, { restart: sched });
  }

  const orderId = `ord_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
  const now = new Date();
  const order = {
    orderId, discordId: user.id, username: user.name, source: cart?.source ?? "website", kind: isVehicle ? "vehicle" : "items",
    lines: lines.map(({ image, ...l }) => l), itemCount, total, currency: "CR",
    delivery: spot, server: "101x", targetRestartAt: target,
    state: "pending_payment", history: [{ at: now, state: "pending_payment" }],
    ...(user.test ? { test: true, dryRun: !user.live } : {}),
    createdAt: now, updatedAt: now, ...(idemKey ? { idemKey: `${user.id}:${idemKey}` } : {}),
  };
  try {
    await orders.insertOne(order);
  } catch (e: any) {
    if (e?.code === 11000 && idemKey) {
      const prev = await orders.findOne({ idemKey: `${user.id}:${idemKey}` });
      if (prev) return { ok: true, duplicate: true, order: publicOrder(prev), wallet: await wallet(user.id) };
    }
    throw e;
  }
  if (isVehicle) {
    try {
      await reserveVehicle(orderId, target, spot.spotId!, sched.cadenceHours, !!(user.test && !user.live));
    } catch (e) {
      await orders.updateOne({ orderId }, { $set: { state: "rejected", updatedAt: new Date() }, $unset: { idemKey: "" }, $push: { history: { at: new Date(), state: "rejected", note: e instanceof ShopError ? e.code : "reserve failed" } } as never });
      throw e;
    }
  }

  // Atomic conditional debit: only succeeds if balance >= total and this order was never charged (no double spend).
  const players = d.collection("players");
  const after = await players.findOneAndUpdate(
    { discordId: user.id, credits: { $gte: total }, shopDebits: { $ne: orderId } },
    { $inc: { credits: -total }, $push: { shopDebits: { $each: [orderId], $slice: -300 } } as never },
    { returnDocument: "after" },
  );
  if (!after) {
    if (isVehicle) await releaseVehicle(orderId).catch(() => null);
    await orders.updateOne({ orderId }, { $set: { state: "rejected", updatedAt: new Date() }, $unset: { idemKey: "" }, $push: { history: { at: new Date(), state: "rejected", note: "insufficient credits" } } as never });
    const w = await wallet(user.id);
    throw new ShopError(402, "insufficient_credits", `Not enough credits: need ${total.toLocaleString()} CR, you have ${w.credits.toLocaleString()} CR`, { wallet: w, total });
  }
  const balanceAfter = Number(after.credits);
  await d.collection("transactions").insertOne({
    playerId: after._id, discordId: user.id, kind: "purchase", amount: total,
    creditsBefore: balanceAfter + total, creditsAfter: balanceAfter, reference: orderId,
    details: { source: "dayzpro.online shop", items: order.lines.map((l) => `${l.classname} x${l.qty}`) }, createdAt: new Date(), updatedAt: new Date(),
  }).catch(() => null);
  const receipt = {
    receiptNo: orderId.toUpperCase(), paidAt: new Date(), total, currency: "CR", balanceBefore: balanceAfter + total, balanceAfter,
    lines: order.lines.map((l) => ({ name: l.name, classname: l.classname, qty: l.qty, unitPrice: l.unitPrice, lineTotal: l.lineTotal })),
    delivery: isVehicle ? `Vehicle spot: ${spot.label} (x ${spot.x.toFixed(0)}, z ${spot.z.toFixed(0)}) — ${DELIVERY_LABEL}` : `${spot.label} — ${DELIVERY_LABEL}`,
    ...(isVehicle ? { note: VEHICLE_NOTE } : {}),
  };
  await orders.updateOne({ orderId }, { $set: { state: "paid", paidAt: new Date(), receipt, updatedAt: new Date() }, $push: { history: { at: new Date(), state: "paid", note: `charged ${total} CR` } } as never });
  // remove only what was paid for (a vehicle checkout leaves the items in the cart and vice versa)
  const paidIds = new Set(lines.map((l) => l.id));
  await d.collection<Cart>("shop_carts").updateOne({ discordId: user.id }, { $set: { lines: (cart?.lines ?? []).filter((l) => !paidIds.has(l.id)), updatedAt: new Date() } });
  const saved = await orders.findOne({ orderId });
  return { ok: true, order: publicOrder(saved!), receipt, wallet: { discordId: user.id, credits: balanceAfter, exists: true, currency: "CR" }, restart: sched };
}

// ---------------------------------------------------------------- refunds (idempotent)
export async function refundOrder(orderId: string, reason: string) {
  const d = await db();
  const o = await d.collection("shop_orders").findOne({ orderId });
  if (!o || o.refund?.at) return o;
  if (!["paid", "queued", "uploaded", "failed"].includes(o.state)) return o;
  const after = await d.collection("players").findOneAndUpdate(
    { discordId: o.discordId, shopDebits: orderId, shopRefunds: { $ne: orderId } },
    { $inc: { credits: o.total }, $push: { shopRefunds: { $each: [orderId], $slice: -300 } } as never },
    { returnDocument: "after" },
  );
  const refund = { at: new Date(), amount: o.total, reason, applied: !!after };
  if (after) {
    await d.collection("transactions").insertOne({ playerId: after._id, discordId: o.discordId, kind: "credit", amount: o.total, creditsBefore: Number(after.credits) - o.total, creditsAfter: Number(after.credits), reference: `refund:${orderId}`, details: { reason }, createdAt: new Date(), updatedAt: new Date() }).catch(() => null);
  }
  if (o.kind === "vehicle") await releaseVehicle(orderId).catch(() => null);
  await d.collection("shop_orders").updateOne({ orderId, "refund.at": { $exists: false } }, { $set: { refund, state: "failed", failReason: reason, updatedAt: new Date() }, $push: { history: { at: new Date(), state: "failed", note: `refunded ${o.total} CR: ${reason}` } } as never });
  return d.collection("shop_orders").findOne({ orderId });
}

// ---------------------------------------------------------------- bridge (box scheduler pull)
export async function bridgePending(limit = 20) {
  const d = await db();
  const rows = await d.collection("shop_orders").find({ state: { $in: ["paid", "queued", "uploaded", "verified_live"] } }).sort({ createdAt: 1 }).limit(limit * 4).toArray();
  return {
    ok: true,
    orders: rows.map((o) => ({
      orderId: o.orderId, state: o.state, createdAt: o.createdAt, targetRestartAt: o.targetRestartAt, server: o.server,
      kind: o.kind === "vehicle" ? "vehicle" : "items",
      delivery: { x: o.delivery.x, y: o.delivery.y, z: o.delivery.z, a: o.delivery.a ?? 0 }, lines: o.lines.map((l: any) => ({ classname: l.classname, qty: l.qty })),
      itemCount: o.itemCount, intents: o.bridge?.intents ?? [], dryRun: !!o.dryRun, test: !!o.test,
    })),
    limits: LIMITS,
  };
}

const ORDER_RANK: Record<string, number> = { paid: 1, queued: 2, uploaded: 3, verified_live: 4, delivered: 5, failed: 9 };
export async function bridgeReport(body: { orderId: string; state: string; intents?: string[]; scheduledFor?: string; note?: string; error?: string; dryRun?: boolean }) {
  const d = await db();
  const col = d.collection("shop_orders");
  const o = await col.findOne({ orderId: body.orderId });
  if (!o) throw new ShopError(404, "not_found", "order not found");
  if (!(body.state in ORDER_RANK)) throw new ShopError(400, "bad_state", "unknown state");
  if (o.state === "failed" || o.state === "delivered") return { ok: true, order: publicOrder(o), unchanged: true };
  if (body.state === "failed") {
    const r = await refundOrder(o.orderId, body.error || body.note || "spawn failed");
    return { ok: true, order: publicOrder(r!), refunded: true };
  }
  if (ORDER_RANK[body.state] < (ORDER_RANK[o.state] ?? 0)) return { ok: true, order: publicOrder(o), unchanged: true };
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (body.intents?.length) set["bridge.intents"] = body.intents.slice(0, 50);
  if (body.dryRun != null) set["bridge.dryRun"] = !!body.dryRun;
  if (body.scheduledFor) set.targetRestartAt = new Date(Math.floor(Date.parse(body.scheduledFor) / 60_000) * 60_000).toISOString();
  const changed = body.state !== o.state;
  if (changed) {
    set.state = body.state;
    set[`${body.state}At`] = new Date();
  }
  await col.updateOne({ orderId: o.orderId }, { $set: set, ...(changed || body.note ? { $push: { history: { at: new Date(), state: body.state, note: body.note || "" } } as never } : {}) });
  return { ok: true, order: publicOrder((await col.findOne({ orderId: o.orderId }))!) };
}

export async function bridgeHeartbeat(body: Record<string, unknown>) {
  const d = await db();
  await d.collection("shop_meta").updateOne({ _id: "bridge" as never }, { $set: { at: new Date(), eta: body.eta ?? null, armed: !!body.armed, version: String(body.version || "") } }, { upsert: true });
  return { ok: true, restart: await restartSchedule() };
}

export async function catalogCount() {
  return (await catalog()).items.length;
}
