import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

type Item = { id: string; classname: string; name: string; price: number; category: string; image: string; hasImage: boolean; featured: boolean };
type Line = { id: string; classname: string; name: string; image: string; unitPrice: number; qty: number; lineTotal: number };
type Cart = { lines: Line[]; total: number; itemCount: number; wallet: { credits: number; exists: boolean }; canAfford: boolean; limits: { maxItemsPerOrder: number; maxItemsPerRestart: number }; deliveryLabel: string };
type Order = { orderId: string; state: string; total: number; itemCount: number; createdAt: string; targetRestartAt: string; lines: Array<{ name: string; classname: string; qty: number; lineTotal: number }>; delivery: { label: string; x: number; z: number }; receipt?: { receiptNo: string; balanceAfter: number }; refund?: { amount: number; reason: string }; failReason?: string; history: Array<{ at: string; state: string; note?: string }> };
type Spot = { id: string; label: string; x: number; z: number };
type Delivery = { lastPosition: { psn: string | null; position: { x: number; z: number; ageMinutes: number | null } | null; reason: string | null }; safeSpots: Spot[] };
type Status = { players: { online: number | null; max: number | null }; restart: { nextRestartAt: string; nextDeliveryRestartAt: string; bridgeOnline: boolean; label: string } };

const LABEL = "Arrives at next server restart (every 2h)";
const PENDING_KEY = "asylum-pending-cart";
const PAGE = 48;
const fmt = (n: number) => `${Math.round(n).toLocaleString()} CR`;
const STATE: Record<string, [string, string]> = {
  pending_payment: ["Processing payment", "bg-zinc-700"],
  paid: ["Paid · waiting for queue", "bg-sky-700"],
  queued: ["Queued for next restart", "bg-amber-700"],
  uploaded: ["Uploaded · waiting for restart", "bg-orange-700"],
  verified_live: ["Live · spawned at restart", "bg-emerald-700"],
  delivered: ["Delivered", "bg-emerald-900"],
  failed: ["Failed · refunded", "bg-red-800"],
};

function useCountdown(iso?: string) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  if (!iso) return "";
  const s = Math.max(0, Math.round((Date.parse(iso) - now) / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `${h ? `${h}h ` : ""}${m}m ${String(sec).padStart(2, "0")}s`;
}
const hhmm = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "");

export function ShopStore({ initialTab = "shop" }: { initialTab?: "shop" | "orders" }) {
  const { session } = useAuth();
  const token = session?.access_token && !/^(demo|discord)-access-token$/.test(session.access_token) ? session.access_token : null;
  const qc = useQueryClient();
  const api = useCallback(
    async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
      const res = await fetch(path, { ...init, headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}), ...(init.headers || {}) } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw Object.assign(new Error(data?.message || res.statusText), { code: data?.error, data });
      return data as T;
    },
    [token],
  );
  const [tab, setTab] = useState<"shop" | "orders">(initialTab);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("Featured");
  const [page, setPage] = useState(0);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const itemsQ = useQuery({ queryKey: ["shop-items"], queryFn: () => api<{ items: Item[]; categories: string[] }>("/api/shop/items"), staleTime: 300_000 });
  const statusQ = useQuery({ queryKey: ["server-status"], queryFn: () => api<Status>("/api/server/status"), refetchInterval: 60_000 });
  const cartQ = useQuery({ queryKey: ["shop-cart", token], queryFn: () => api<Cart>("/api/cart"), enabled: !!token });
  const ordersQ = useQuery({ queryKey: ["shop-orders", token], queryFn: () => api<{ orders: Order[] }>("/api/orders"), enabled: !!token, refetchInterval: 30_000 });
  const setCart = (c: Cart) => qc.setQueryData(["shop-cart", token], c);

  // ?cart=akm:2,bandage:3&source=discord-activity prefill (kept until sign-in)
  const prefilled = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined" || prefilled.current) return;
    const url = new URL(window.location.href);
    const raw = url.searchParams.get("cart");
    const source = url.searchParams.get("source") || "link";
    if (raw) {
      window.localStorage.setItem(PENDING_KEY, JSON.stringify({ cart: raw, source }));
      url.searchParams.delete("cart");
      url.searchParams.delete("source");
      window.history.replaceState(null, "", url.toString());
    }
    if (url.searchParams.get("tab") === "orders") setTab("orders");
    const pending = window.localStorage.getItem(PENDING_KEY);
    if (!pending) return;
    if (!token) {
      toast.message("Sign in with Discord to load your cart");
      return;
    }
    prefilled.current = true;
    const p = JSON.parse(pending) as { cart: string; source: string };
    api<Cart>("/api/cart", { method: "POST", body: JSON.stringify({ cart: p.cart, source: p.source }) })
      .then((c) => {
        setCart(c);
        setCartOpen(true);
        window.localStorage.removeItem(PENDING_KEY);
        toast.success(`Cart loaded${p.source === "discord-activity" ? " from the Discord Activity" : ""}`);
      })
      .catch((e) => toast.error(e.message));
  }, [token, api]);

  const mutate = async (method: string, body: object) => {
    if (!token) return toast.error("Sign in with Discord to use the cart");
    try {
      setCart(await api<Cart>("/api/cart", { method, body: JSON.stringify(body) }));
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const items = itemsQ.data?.items ?? [];
  const cats = useMemo(() => ["Featured", "All", ...(itemsQ.data?.categories ?? []).filter((c) => c)], [itemsQ.data]);
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return items.filter((i) => (cat === "All" || (cat === "Featured" ? i.featured : i.category === cat)) && (!s || i.name.toLowerCase().includes(s) || i.classname.toLowerCase().includes(s)));
  }, [items, q, cat]);
  const pageItems = filtered.slice(page * PAGE, page * PAGE + PAGE);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const cart = cartQ.data;
  const countdown = useCountdown(statusQ.data?.restart.nextRestartAt);

  return (
    <section className="shop-directory-wrap" aria-label="DAYZ PRO item shop">
      <div className="shop-directory-shell space-y-4">
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-primary/20 bg-black/50 px-4 py-3 text-xs">
          <span className="font-semibold uppercase tracking-wider text-primary">101x Livonia</span>
          <span>{statusQ.data?.players.online ?? "–"}/{statusQ.data?.players.max ?? "–"} online</span>
          <span className="text-muted-foreground">Next restart {hhmm(statusQ.data?.restart.nextRestartAt)} · in {countdown}</span>
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-300">{LABEL}</span>
          {token && <span className="rounded-full border border-primary/30 px-2 py-0.5">Wallet <span className="font-mono text-primary">{cart ? fmt(cart.wallet.credits) : "…"}</span></span>}
          <div className="ml-auto flex gap-2">
            {(["shop", "orders"] as const).map((t) => (
              <button key={t} type="button" onClick={() => setTab(t)} className={`rounded-full px-3 py-1.5 uppercase tracking-wider ${tab === t ? "bg-primary text-primary-foreground" : "border border-primary/30"}`}>{t === "shop" ? "Shop" : "My orders"}</button>
            ))}
            <button type="button" onClick={() => setCartOpen(true)} className="rounded-full border border-primary/40 px-3 py-1.5 uppercase tracking-wider" data-testid="open-cart">
              Cart {cart?.itemCount ? `(${cart.itemCount})` : ""}
            </button>
          </div>
        </div>
        {!token && <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-200">Sign in with Discord to add items to your cart and pay with your Discord wallet.</div>}

        {tab === "shop" ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <input value={q} onChange={(e) => (setQ(e.target.value), setPage(0))} placeholder="Search items or classnames" className="min-w-[220px] flex-1 rounded-full border border-primary/20 bg-black px-4 py-2 text-sm outline-none" />
              <select value={cat} onChange={(e) => (setCat(e.target.value), setPage(0))} className="rounded-full border border-primary/20 bg-black px-3 py-2 text-xs uppercase tracking-wider">
                {cats.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <span className="text-xs text-muted-foreground">{filtered.length} items</span>
            </div>
            {itemsQ.isLoading && <div className="text-sm text-muted-foreground">Loading catalog…</div>}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6" data-testid="shop-grid">
              {pageItems.map((i) => (
                <article key={i.id} className="flex flex-col overflow-hidden rounded-2xl border border-primary/15 bg-black/60">
                  <div className="flex h-32 items-center justify-center bg-gradient-to-b from-zinc-900 to-black p-2">
                    <img src={i.image} alt={i.name} loading="lazy" className="max-h-full max-w-full object-contain" />
                  </div>
                  <div className="flex flex-1 flex-col gap-1 p-3">
                    <div className="line-clamp-2 text-sm font-semibold">{i.name}</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{i.category}</div>
                    <div className="mt-auto flex items-center justify-between pt-2">
                      <span className="font-mono text-sm text-primary">{fmt(i.price)}</span>
                      <button type="button" onClick={() => mutate("POST", { id: i.id, qty: 1 }).then(() => token && toast.success(`${i.name} added`))} className="rounded-full bg-primary px-3 py-1 text-[11px] uppercase tracking-wider text-primary-foreground">Add</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            {pages > 1 && (
              <div className="flex items-center justify-center gap-3 text-xs">
                <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)} className="rounded-full border px-3 py-1 disabled:opacity-40">Prev</button>
                <span>{page + 1} / {pages}</span>
                <button type="button" disabled={page >= pages - 1} onClick={() => setPage(page + 1)} className="rounded-full border px-3 py-1 disabled:opacity-40">Next</button>
              </div>
            )}
          </>
        ) : (
          <Orders orders={ordersQ.data?.orders ?? []} loading={ordersQ.isLoading} signedIn={!!token} />
        )}
      </div>

      {cartOpen && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onClick={() => setCartOpen(false)}>
          <aside className="flex h-full w-full max-w-md flex-col gap-3 overflow-y-auto border-l border-primary/30 bg-zinc-950 p-5" onClick={(e) => e.stopPropagation()} data-testid="cart-panel">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl text-primary">Your cart</h2>
              <button type="button" onClick={() => setCartOpen(false)} className="text-sm text-muted-foreground">Close</button>
            </div>
            <div className="rounded-xl border border-primary/20 bg-black/50 p-3 text-sm">
              Wallet (Discord): <span className="font-mono text-primary">{cart ? fmt(cart.wallet.credits) : token ? "…" : "sign in"}</span>
            </div>
            {!cart?.lines.length && <div className="text-sm text-muted-foreground">Cart is empty.</div>}
            {cart?.lines.map((l) => (
              <div key={l.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/40 p-2">
                <img src={l.image} alt="" className="h-12 w-12 object-contain" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{l.name}</div>
                  <div className="text-xs text-muted-foreground">{fmt(l.unitPrice)} each</div>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => mutate("PATCH", { id: l.id, qty: l.qty - 1 })} className="h-7 w-7 rounded-full border">−</button>
                  <span className="w-6 text-center text-sm">{l.qty}</span>
                  <button type="button" onClick={() => mutate("PATCH", { id: l.id, qty: l.qty + 1 })} className="h-7 w-7 rounded-full border">+</button>
                </div>
                <button type="button" onClick={() => mutate("DELETE", { id: l.id })} className="text-xs text-red-400">Remove</button>
              </div>
            ))}
            {cart && cart.lines.length > 0 && (
              <div className="mt-auto space-y-2 border-t border-white/10 pt-3 text-sm">
                <div className="flex justify-between"><span>{cart.itemCount} items</span><span className="font-mono text-lg text-primary">{fmt(cart.total)}</span></div>
                <div className="text-xs text-amber-300">{LABEL}. Max {cart.limits.maxItemsPerOrder} items per order.</div>
                {!cart.canAfford && <div className="text-xs text-red-400">Not enough credits in your Discord wallet.</div>}
                <button type="button" disabled={!cart.canAfford || cart.itemCount > cart.limits.maxItemsPerOrder} onClick={() => setCheckoutOpen(true)} className="w-full rounded-full bg-primary py-2.5 text-sm font-semibold uppercase tracking-wider text-primary-foreground disabled:opacity-40" data-testid="checkout-btn">Checkout</button>
              </div>
            )}
          </aside>
        </div>,
        document.body,
      )}
      {checkoutOpen && cart && typeof document !== "undefined" && createPortal(
        <Checkout cart={cart} api={api} onClose={() => setCheckoutOpen(false)} onDone={() => {
          setCheckoutOpen(false);
          setCartOpen(false);
          setTab("orders");
          qc.invalidateQueries({ queryKey: ["shop-cart"] });
          qc.invalidateQueries({ queryKey: ["shop-orders"] });
        }} />,
        document.body,
      )}
    </section>
  );
}

function Checkout({ cart, api, onClose, onDone }: { cart: Cart; api: <T>(p: string, i?: RequestInit) => Promise<T>; onClose: () => void; onDone: () => void }) {
  const dq = useQuery({ queryKey: ["delivery-options"], queryFn: () => api<Delivery>("/api/shop/delivery-options") });
  const [mode, setMode] = useState<"last_position" | "safe_spot">("safe_spot");
  const [spot, setSpot] = useState("");
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<null | { receiptNo: string; total: number; balanceAfter: number; delivery: string }>(null);
  const idem = useRef(typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now()));
  const pos = dq.data?.lastPosition.position;
  useEffect(() => {
    if (pos) setMode("last_position");
    if (!spot && dq.data?.safeSpots[0]) setSpot(dq.data.safeSpots[0].id);
  }, [dq.data]);
  const pay = async () => {
    setBusy(true);
    try {
      const r = await api<{ receipt: { receiptNo: string; total: number; balanceAfter: number; delivery: string } }>("/api/checkout", {
        method: "POST",
        headers: { "idempotency-key": idem.current },
        body: JSON.stringify({ delivery: { mode, spotId: spot } }),
      });
      setReceipt(r.receipt);
      toast.success("Paid. Your order rides the next restart.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/70 p-4" data-testid="checkout-modal">
      <div className="w-full max-w-lg space-y-4 rounded-2xl border border-primary/30 bg-zinc-950 p-6">
        {receipt ? (
          <>
            <h2 className="font-display text-2xl text-primary">Receipt</h2>
            <div className="space-y-1 text-sm">
              <div>No. <span className="font-mono">{receipt.receiptNo}</span></div>
              <div>Charged <span className="font-mono text-primary">{fmt(receipt.total)}</span> · wallet now {fmt(receipt.balanceAfter)}</div>
              <div className="text-muted-foreground">{receipt.delivery}</div>
            </div>
            <div className="rounded-xl bg-amber-500/10 p-3 text-xs text-amber-200">Not instant: items are placed on the ground at your spot when the server restarts (every 2h). If the upload fails you are refunded automatically.</div>
            <button type="button" onClick={onDone} className="w-full rounded-full bg-primary py-2.5 text-sm font-semibold uppercase text-primary-foreground">Track my order</button>
          </>
        ) : (
          <>
            <h2 className="font-display text-2xl text-primary">Checkout</h2>
            <div className="text-sm">{cart.itemCount} items · <span className="font-mono text-primary">{fmt(cart.total)}</span> from your Discord wallet ({fmt(cart.wallet.credits)})</div>
            <div className="space-y-2 text-sm">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Delivery spot</div>
              <label className={`flex items-start gap-2 rounded-xl border p-3 ${pos ? "border-primary/30" : "border-white/10 opacity-60"}`}>
                <input type="radio" disabled={!pos} checked={mode === "last_position"} onChange={() => setMode("last_position")} />
                <span>
                  My last position{dq.data?.lastPosition.psn ? ` (${dq.data.lastPosition.psn})` : ""}
                  <span className="block text-xs text-muted-foreground">
                    {dq.isLoading ? "Checking server logs…" : pos ? `x ${pos.x.toFixed(0)} · z ${pos.z.toFixed(0)}${pos.ageMinutes != null ? ` · seen ${pos.ageMinutes} min ago` : ""}` : dq.data?.lastPosition.reason}
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 rounded-xl border border-primary/30 p-3">
                <input type="radio" checked={mode === "safe_spot"} onChange={() => setMode("safe_spot")} />
                <span className="flex-1">
                  Safe spot
                  <select value={spot} onChange={(e) => (setSpot(e.target.value), setMode("safe_spot"))} className="mt-1 block w-full rounded-lg border border-white/10 bg-black px-2 py-1 text-xs">
                    {dq.data?.safeSpots.map((s) => <option key={s.id} value={s.id}>{s.label} (x {s.x.toFixed(0)}, z {s.z.toFixed(0)})</option>)}
                  </select>
                </span>
              </label>
            </div>
            <div className="rounded-xl bg-amber-500/10 p-3 text-xs text-amber-200">{LABEL}. Console has no live spawning, so nothing appears before the restart.</div>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="flex-1 rounded-full border py-2.5 text-sm">Back</button>
              <button type="button" disabled={busy || (mode === "safe_spot" && !spot)} onClick={pay} className="flex-1 rounded-full bg-primary py-2.5 text-sm font-semibold uppercase text-primary-foreground disabled:opacity-40" data-testid="pay-btn">{busy ? "Paying…" : `Pay ${fmt(cart.total)}`}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function OrderCard({ o }: { o: Order }) {
  const cd = useCountdown(o.targetRestartAt);
  const [label, cls] = STATE[o.state] ?? [o.state, "bg-zinc-700"];
  const waiting = ["paid", "queued", "uploaded"].includes(o.state);
  return (
    <div className="space-y-2 rounded-2xl border border-white/10 bg-black/50 p-4 text-sm" data-testid="order-card">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-muted-foreground">{o.orderId}</span>
        <span className={`rounded-full px-2 py-0.5 text-[11px] uppercase tracking-wider text-white ${cls}`}>{label}</span>
        <span className="ml-auto font-mono text-primary">{fmt(o.total)}</span>
      </div>
      <div className="text-xs">{o.lines.map((l) => `${l.name} ×${l.qty}`).join(" · ")}</div>
      <div className="text-xs text-muted-foreground">Deliver to: {o.delivery.label} (x {o.delivery.x.toFixed(0)}, z {o.delivery.z.toFixed(0)})</div>
      {waiting && <div className="text-xs text-amber-300">{LABEL} — target {hhmm(o.targetRestartAt)}, in {cd}</div>}
      {o.state === "verified_live" && <div className="text-xs text-emerald-300">Config was live at the restart. Pick your items up before the following restart.</div>}
      {o.refund && <div className="text-xs text-red-300">Refunded {fmt(o.refund.amount)}: {o.refund.reason}</div>}
      <details className="text-xs text-muted-foreground">
        <summary>History</summary>
        {o.history.map((h, i) => <div key={i}>{new Date(h.at).toLocaleString()} · {h.state}{h.note ? ` · ${h.note}` : ""}</div>)}
      </details>
    </div>
  );
}

function Orders({ orders, loading, signedIn }: { orders: Order[]; loading: boolean; signedIn: boolean }) {
  if (!signedIn) return <div className="text-sm text-muted-foreground">Sign in with Discord to see your orders.</div>;
  if (loading) return <div className="text-sm text-muted-foreground">Loading orders…</div>;
  if (!orders.length) return <div className="text-sm text-muted-foreground">No orders yet.</div>;
  return <div className="grid gap-3 md:grid-cols-2">{orders.map((o) => <OrderCard key={o.orderId} o={o} />)}</div>;
}
