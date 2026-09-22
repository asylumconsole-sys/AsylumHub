import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

const STAFF = [
  { name: "Buy player information", price: "25,000 CR", blurb: "Last seen server, linked tags, and recent killfeed on a target." },
  { name: "Buy faction information", price: "40,000 CR", blurb: "Roster, flag coords if known, and faction kill totals." },
  { name: "Remove wanted status", price: "30,000 CR", blurb: "Clears your wanted mark across Hub and Discord." },
  { name: "Reputation buy", price: "20,000 CR", blurb: "Buy a reputation bump. Staff confirms the amount before apply." },
  { name: "Identity Wipe", price: "75,000 CR", blurb: "Unlink public tags from Hub intel. Your Discord stay linked to staff." },
  { name: "Ghost Mode role", price: "100,000 CR", blurb: "Hidden from public online list and default killfeed highlight." },
  { name: "High-Risk Contract", price: "250,000 CR", blurb: "Extremely high-reward custom mission. Staff writes the contract." },
];

const SELL_TYPES = ["Item", "Car", "Custom service", "Other"] as const;

type Listing = {
  id: string;
  kind: string;
  title: string;
  price: string;
  details: string;
  sellerName: string;
  createdAt: string;
};

export function DonatorShop() {
  const { user } = useAuth();
  const userId = user?.id || "";
  const sellerName =
    (typeof user?.user_metadata?.name === "string" && user.user_metadata.name) || "Trader";
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [page, setPage] = useState<"desk" | "board">("desk");
  const [listings, setListings] = useState<Listing[]>([]);
  const [sellOpen, setSellOpen] = useState(false);
  const [kind, setKind] = useState<(typeof SELL_TYPES)[number]>("Item");
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    void fetch(`/api/black-market/access?userId=${encodeURIComponent(userId)}`)
      .then((r) => r.json())
      .then((d: { ok?: boolean }) => {
        if (live) setAllowed(Boolean(d.ok));
      })
      .catch(() => {
        if (live) setAllowed(false);
      });
    return () => {
      live = false;
    };
  }, [userId]);

  useEffect(() => {
    if (!allowed) return;
    void fetch(`/api/black-market/listings?userId=${encodeURIComponent(userId)}`)
      .then((r) => r.json())
      .then((d: { listings?: Listing[] }) => setListings(d.listings ?? []))
      .catch(() => setListings([]));
  }, [allowed, userId]);

  async function submitSell() {
    if (!title.trim() || !price.trim()) {
      toast.error("Name and price are required");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/black-market/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, sellerName, kind, title: title.trim(), price: price.trim(), details: details.trim() }),
      });
      const data = (await res.json()) as { listing?: Listing; error?: string };
      if (!res.ok) {
        toast.error(data.error === "locked" ? "Only available for $30+ donators!" : "Could not post");
        return;
      }
      if (data.listing) setListings((prev) => [data.listing as Listing, ...prev]);
      toast.success("Listing is live");
      setSellOpen(false);
      setTitle("");
      setPrice("");
      setDetails("");
    } finally {
      setBusy(false);
    }
  }

  if (allowed === false) {
    return (
      <section className="relative mx-4 overflow-hidden rounded-[28px] border border-red-900/40 bg-[#070303] px-6 py-16 text-center sm:mx-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(180,20,20,0.25),transparent_55%)]" />
        <motion.button
          type="button"
          onClick={() => toast.error("Only available for $30+ donators!")}
          className="relative mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-red-500/40 bg-black text-4xl text-red-400"
          animate={{ boxShadow: ["0 0 0 0 rgba(220,38,38,0.0)", "0 0 40px 6px rgba(220,38,38,0.35)", "0 0 0 0 rgba(220,38,38,0.0)"] }}
          transition={{ duration: 2.2, repeat: Infinity }}
        >
          🔒
        </motion.button>
        <h2 className="relative mt-6 font-display text-4xl text-red-200">BLACK MARKET</h2>
        <p className="relative mt-2 text-sm uppercase tracking-[0.28em] text-red-400/80">Sealed</p>
        <button
          type="button"
          onClick={() => toast.error("Only available for $30+ donators!")}
          className="relative mt-6 rounded-full border border-red-500/40 px-5 py-2 text-xs uppercase tracking-[0.2em] text-red-300"
        >
          Unlock with $30+ role
        </button>
      </section>
    );
  }

  if (allowed === null) {
    return <div className="px-6 py-16 text-center text-sm uppercase tracking-[0.2em] text-zinc-500">Checking clearance…</div>;
  }

  return (
    <section className="relative overflow-hidden px-4 pb-10 sm:px-6" aria-label="Black market">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(212,168,75,0.12),transparent_40%),radial-gradient(circle_at_80%_100%,rgba(120,0,0,0.2),transparent_45%)]" />
      <div className="relative mb-6 flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.32em] text-red-400/80">After hours</div>
          <h2 className="font-display text-4xl text-[#e8c56a]">Black Market</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-full border border-[#d4a84b]/30 bg-black/50 p-1">
            {(
              [
                ["desk", "Desk"],
                ["board", "Listings"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setPage(id)}
                className={`rounded-full px-4 py-2 text-[11px] uppercase tracking-[0.18em] ${page === id ? "bg-[#d4a84b] text-black" : "text-[#e8c56a]"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <motion.button
            type="button"
            onClick={() => setSellOpen(true)}
            whileTap={{ scale: 0.96 }}
            className="rounded-full bg-[#d4a84b] px-5 py-2 text-[11px] uppercase tracking-[0.18em] text-black"
          >
            Sell
          </motion.button>
        </div>
      </div>

      {page === "desk" ? (
        <div className="relative grid gap-3 sm:grid-cols-2">
          {STAFF.map((item, index) => (
            <motion.button
              key={item.name}
              type="button"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ y: -4, boxShadow: "0 0 24px rgba(212,168,75,0.18)" }}
              onClick={() => toast.message(`${item.name} — staff confirm before deduct`)}
              className="rounded-2xl border border-[#d4a84b]/20 bg-black/70 p-5 text-left backdrop-blur"
            >
              <div className="font-display text-2xl text-[#e8c56a]">{item.name}</div>
              <div className="mt-1 text-sm text-zinc-400">{item.blurb}</div>
              <div className="mt-4 text-xs uppercase tracking-[0.2em] text-red-300">{item.price}</div>
            </motion.button>
          ))}
        </div>
      ) : (
        <div className="relative space-y-3">
          {listings.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#d4a84b]/20 px-5 py-12 text-center text-sm text-zinc-500">
              No player listings yet. Hit Sell.
            </div>
          ) : (
            listings.map((row, index) => (
              <motion.article
                key={row.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.04 }}
                className="rounded-2xl border border-[#d4a84b]/20 bg-black/70 p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.2em] text-red-400">{row.kind}</div>
                    <div className="font-display text-2xl text-[#e8c56a]">{row.title}</div>
                  </div>
                  <div className="text-sm text-[#d4a84b]">{row.price}</div>
                </div>
                {row.details ? <p className="mt-2 text-sm text-zinc-400">{row.details}</p> : null}
                <div className="mt-3 text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                  {row.sellerName} · {new Date(row.createdAt).toLocaleString()}
                </div>
              </motion.article>
            ))
          )}
        </div>
      )}

      <AnimatePresence>
        {sellOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 p-4"
            onClick={() => setSellOpen(false)}
          >
            <motion.div
              initial={{ y: 18, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="w-full max-w-md rounded-2xl border border-[#d4a84b]/30 bg-[#0b0705] p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-display text-2xl text-[#e8c56a]">Sell</h3>
                <button type="button" className="text-sm text-zinc-400" onClick={() => setSellOpen(false)}>
                  Close
                </button>
              </div>
              <div className="mb-3 flex flex-wrap gap-2">
                {SELL_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setKind(t)}
                    className={`rounded-full px-3 py-1.5 text-[11px] uppercase tracking-[0.16em] ${kind === t ? "bg-[#d4a84b] text-black" : "border border-[#d4a84b]/30 text-[#e8c56a]"}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What are you selling" className="mb-2 w-full rounded-xl border border-white/10 bg-black px-3 py-2 text-sm outline-none" />
              <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Price (CR or $)" className="mb-2 w-full rounded-xl border border-white/10 bg-black px-3 py-2 text-sm outline-none" />
              <textarea value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Details" rows={4} className="mb-4 w-full rounded-xl border border-white/10 bg-black px-3 py-2 text-sm outline-none" />
              <button type="button" disabled={busy} onClick={() => void submitSell()} className="w-full rounded-full bg-[#d4a84b] py-2.5 text-sm font-semibold uppercase tracking-[0.16em] text-black disabled:opacity-60">
                {busy ? "Posting…" : "Post listing"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
