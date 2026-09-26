import { createHash, timingSafeEqual } from "node:crypto";
import { ShopError } from "./mongo.server";

export type ShopUser = { id: string; username: string; name: string; test?: boolean; live?: boolean };
const cache = new Map<string, { user: ShopUser | null; exp: number }>();

function eq(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Signed-in Discord user from `Authorization: Bearer <discord access token>` (website session or Discord Activity). */
export async function optionalUser(request: Request): Promise<ShopUser | null> {
  // Flow tests only: active while SHOP_TEST_AUTH_SECRET is set (unset in normal operation), and only for synthetic
  // "shoptest-*" wallets, so it can never act as a real Discord user. "x-shop-test-auth: <secret>:shoptest-1[:live]".
  // Test orders are dry-run (the box bridge never uploads them) unless ":live" is given.
  const test = process.env.SHOP_TEST_AUTH_SECRET;
  const th = request.headers.get("x-shop-test-auth");
  if (test && test.length >= 24 && th) {
    const [s, id, mode] = th.split(":");
    if (s && id && /^shoptest-[a-z0-9-]{1,40}$/.test(id) && eq(s, test)) return { id, username: id, name: `Flow test ${id}`, test: true, live: mode === "live" };
    return null;
  }
  const m = (request.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i);
  const token = m?.[1]?.trim();
  if (token?.startsWith("shoptest:")) { // same flow-test gate, for UI screenshots (browser session token)
    const [, s, id] = token.split(":");
    return test && test.length >= 24 && s && id && /^shoptest-[a-z0-9-]{1,40}$/.test(id) && eq(s, test) ? { id, username: id, name: `Flow test ${id}`, test: true, live: false } : null;
  }
  if (!token || token.length < 20 || /^(demo|discord)-access-token$/.test(token)) return null;
  const key = createHash("sha256").update(token).digest("hex");
  const hit = cache.get(key);
  if (hit && hit.exp > Date.now()) return hit.user;
  const res = await fetch("https://discord.com/api/v10/users/@me", {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(6000),
  }).catch(() => null);
  if (!res) throw new ShopError(503, "discord_unreachable", "Could not verify your Discord login, try again");
  let user: ShopUser | null = null;
  if (res.ok) {
    const u = (await res.json()) as { id: string; username: string; global_name?: string | null };
    user = { id: u.id, username: u.username, name: u.global_name || u.username };
  }
  cache.set(key, { user, exp: Date.now() + (user ? 10 * 60_000 : 60_000) });
  if (cache.size > 5000) cache.clear();
  return user;
}

export async function requireUser(request: Request): Promise<ShopUser> {
  const u = await optionalUser(request);
  if (!u) throw new ShopError(401, "unauthorized", "Sign in with Discord to use the shop");
  return u;
}

/** Server-to-server auth for the box bridge (Heartbeat scheduler). */
export function requireBridge(request: Request) {
  const secret = process.env.HUB_BRIDGE_SECRET || "";
  const m = (request.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i);
  if (!secret || secret.length < 24 || !m || !eq(m[1].trim(), secret)) throw new ShopError(401, "unauthorized", "bridge auth required");
}
