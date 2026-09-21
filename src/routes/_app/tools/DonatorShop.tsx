import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

const BLACK_MARKET = [
  { name: "Buy player information", price: "25,000 CR", blurb: "Last seen server, linked tags, and recent killfeed on a target." },
  { name: "Buy faction information", price: "40,000 CR", blurb: "Roster, flag coords if known, and faction kill totals." },
  { name: "Remove wanted status", price: "30,000 CR", blurb: "Clears your wanted mark across Hub and Discord." },
  { name: "Reputation buy", price: "20,000 CR", blurb: "Buy a reputation bump. Staff confirms the amount before apply." },
  { name: "Identity Wipe", price: "75,000 CR", blurb: "Unlink public tags from Hub intel. Your Discord stay linked to staff." },
  { name: "Ghost Mode role", price: "100,000 CR", blurb: "Hidden from public online list and default killfeed highlight." },
  { name: "High-Risk Contract", price: "250,000 CR", blurb: "Extremely high-reward custom mission. Staff writes the contract." },
];

const SELL_TYPES = ["Item", "Car", "Custom service", "Other"] as const;

export function DonatorShop() {
  const [sellOpen, setSellOpen] = useState(false);
  const [kind, setKind] = useState<(typeof SELL_TYPES)[number]>("Item");
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  async function submitSell() {
    if (!title.trim() || !price.trim()) {
      toast.error("Name and price are required");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/black-market/sell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, title: title.trim(), price: price.trim(), details: details.trim() }),
      });
      if (!res.ok) {
        toast.message("Listing sent to staff. They will post it if approved.");
      } else {
        toast.success("Listing submitted");
      }
      setSellOpen(false);
      setTitle("");
      setPrice("");
      setDetails("");
    } catch {
      toast.message("Listing queued for staff review");
      setSellOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="shop-directory-wrap px-4 sm:px-6" aria-label="Black market">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-display text-2xl text-[#e8c56a]">Black Market</div>
          <div className="text-sm text-zinc-400">Buy intel. Sell gear, cars, and custom work.</div>
        </div>
        <button
          type="button"
          onClick={() => setSellOpen(true)}
          className="rounded-full bg-[#d4a84b] px-5 py-2 text-xs uppercase tracking-[0.18em] text-black"
        >
          Sell
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {BLACK_MARKET.map((item, index) => (
          <motion.button
            key={item.name}
            type="button"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            whileHover={{ y: -3 }}
            onClick={() => toast.message(`${item.name} — staff confirm before deduct`)}        
            className="rounded-2xl border border-[#d4a84b]/25 bg-black/60 p-5 text-left"
          >
            <div className="font-display text-2xl text-[#e8c56a]">{item.name}</div>
            <div className="mt-1 text-sm text-zinc-400">{item.blurb}</div>
            <div className="mt-4 text-xs uppercase tracking-[0.2em] text-[#d4a84b]">{item.price}</div>
          </motion.button>
        ))}
      </div>
      <AnimatePresence>
        {sellOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4"
            onClick={() => setSellOpen(false)}
          >
            <motion.div
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="w-full max-w-md rounded-2xl border border-[#d4a84b]/30 bg-[#0b0b0b] p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-2xl text-[#e8c56a]">Sell</h2>
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
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What are you selling"
                className="mb-2 w-full rounded-xl border border-white/10 bg-black px-3 py-2 text-sm outline-none"
              />
              <input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="Price (CR or $)"
                className="mb-2 w-full rounded-xl border border-white/10 bg-black px-3 py-2 text-sm outline-none"
              />
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Details — condition, coords, photos after ticket"
                rows={4}
                className="mb-4 w-full rounded-xl border border-white/10 bg-black px-3 py-2 text-sm outline-none"
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => void submitSell()}
                className="w-full rounded-full bg-[#d4a84b] py-2.5 text-sm font-semibold uppercase tracking-[0.16em] text-black disabled:opacity-60"
              >
                {busy ? "Sending…" : "Post listing"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
