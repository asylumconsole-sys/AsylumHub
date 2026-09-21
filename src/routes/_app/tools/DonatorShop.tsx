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
  const [method, setMethod] = useState("auto");
  const [busy, setBusy] = useState<number | null>(null);
  return (
    <section className="shop-directory-wrap px-4 sm:px-6" aria-label="Donator shop">
      <div className="mb-4 flex flex-wrap gap-2">
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
    </section>
  );
}
