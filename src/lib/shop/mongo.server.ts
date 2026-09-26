import { MongoClient, type Db } from "mongodb";

let clientP: Promise<MongoClient> | null = null;
let indexed = false;

export function mongoConfigured() {
  return Boolean(process.env.MONGO_URL || process.env.MONGODB_URI);
}

export async function db(): Promise<Db> {
  const uri = process.env.MONGO_URL || process.env.MONGODB_URI;
  if (!uri) throw new ShopError(503, "wallet_offline", "Wallet database is not configured");
  if (!clientP) {
    clientP = new MongoClient(uri, { serverSelectionTimeoutMS: 8000, maxPoolSize: 10 }).connect();
    clientP.catch(() => (clientP = null));
  }
  const d = (await clientP).db(process.env.MONGODB_DB || "dayzpro");
  if (!indexed) {
    indexed = true;
    await Promise.all([
      d.collection("shop_carts").createIndex({ discordId: 1 }, { unique: true }),
      d.collection("shop_orders").createIndex({ orderId: 1 }, { unique: true }),
      d.collection("shop_orders").createIndex({ idemKey: 1 }, { unique: true, sparse: true }),
      d.collection("shop_orders").createIndex({ discordId: 1, createdAt: -1 }),
      d.collection("shop_orders").createIndex({ state: 1 }),
    ]).catch((e) => {
      indexed = false;
      console.error("[shop] index setup failed", e?.message);
    });
  }
  return d;
}

export class ShopError extends Error {
  constructor(public status: number, public code: string, message: string, public extra?: Record<string, unknown>) {
    super(message);
  }
}

export function json(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}

export async function handle(fn: () => Promise<unknown>) {
  try {
    return json(await fn());
  } catch (e) {
    if (e instanceof ShopError) return json({ ok: false, error: e.code, message: e.message, ...(e.extra || {}) }, e.status);
    console.error("[shop] error", e);
    return json({ ok: false, error: "server_error", message: "Something went wrong" }, 500);
  }
}
