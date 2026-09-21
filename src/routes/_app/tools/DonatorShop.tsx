import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { DONATION_TIERS, hexColor } from "@/lib/donation-tiers";

const PAY_METHODS = [
  { id: "auto", label: "Card / Apple / Google" },
  { id: "paypal", label: "PayPal" },
  { id: "cashapp", label: "Cash App" },
  { id: "venmo", label: "Venmo" },
] as const;

const BLACK_MARKET = [
  { name: "Ghost Drop", price: "$25", blurb: "Off-grid crate. No killfeed tag on the drop." },
  { name: "Night Courier", price: "$50", blurb: "Vehicle + sealed crate at your coords after restart." },
  { name: "Black Card", price: "$100", blurb: "Priority queue + one custom loadout review." },
  { name: "Silent Base", price: "$250", blurb: "Staff-built stash kit. Ticket opens on buy." },
];

async function startDonate(usd: number, method: string) {
  const res = await fetch("/api/stripe/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usd, method }),
  });
  const data = (await res.json()) as { url?: string; error?: string };
  if (!res.ok || !data.url) {
    toast.error(data.error || "Stripe is not configured yet");
    return;
  }
  window.location.href = data.url;
}

export function DonatorShop() {
  const [page, setPage] = useState<"tiers" | "black">("tiers");
  const [method, setMethod] = useState("auto");
  const [busy, setBusy] = useState<number | null>(null);
  return (
    <section className="shop-directory-wrap px-4 sm:px-6" aria-label="Donator shop">
      <div className="mb-5 flex justify-center">
        <div className="inline-flex rounded-full border border-[#d4a84b]/30 p-1">
          {(
            [
              ["tiers", "Donations"],
              ["black", "Black Market"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setPage(id)}
              className={`rounded-full px-5 py-2 text-xs uppercase tracking-[0.18em] ${page === id ? "bg-[#d4a84b] text-black" : "text-[#e8c56a]"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {page === "tiers" ? (
        <>
          <div className="mb-4 flex flex-wrap justify-center gap-2">
            {PAY_METHODS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMethod(m.id)}
                className={`rounded-full px-3 py-1.5 text-[11px] uppercase tracking-[0.16em] ${method === m.id ? "bg-[#d4a84b] text-black" : "border border-[#d4a84b]/30 text-[#e8c56a]"}`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {DONATION_TIERS.map((tier, index) => (
              <motion.button
                key={tier.name}
                type="button"
                disabled={busy === tier.usd}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.02 }}
                whileHover={{ y: -3 }}
                onClick={async () => {
                  setBusy(tier.usd);
                  await startDonate(tier.usd, method);
                  setBusy(null);
                }}
                className="rounded-2xl border bg-black/50 px-3 py-5 text-left disabled:opacity-60"
                style={{ borderColor: `${hexColor(tier.color)}55` }}
              >
                <div className="font-display text-3xl" style={{ color: hexColor(tier.color) }}>
                  {tier.name}
                </div>
                <div className="mt-2 text-[11px] uppercase tracking-[0.18em] text-zinc-400">Role {tier.name}</div>
                <div className="mt-1 text-sm text-[#e8c56a]">{tier.creditsMark} mark</div>
              </motion.button>
            ))}
          </div>
        </>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {BLACK_MARKET.map((item, index) => (
            <motion.button
              key={item.name}
              type="button"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ y: -3 }}
              onClick={() => toast.message(`${item.name} — staff drop after payment`)}
              className="rounded-2xl border border-[#d4a84b]/25 bg-black/60 p-5 text-left"
            >
              <div className="font-display text-2xl text-[#e8c56a]">{item.name}</div>
              <div className="mt-1 text-sm text-zinc-400">{item.blurb}</div>
              <div className="mt-4 text-xs uppercase tracking-[0.2em] text-[#d4a84b]">{item.price}</div>
            </motion.button>
          ))}
        </div>
      )}
    </section>
  );
}
