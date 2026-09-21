import { useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
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

export function DonateDock({ collapsed }: { collapsed?: boolean }) {
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState("auto");
  const [busy, setBusy] = useState<number | null>(null);
  const modal =
    typeof document === "undefined"
      ? null
      : createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4"
                onClick={() => setOpen(false)}
              >
                <motion.section
                  initial={{ y: 16, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="max-h-[88vh] w-full max-w-3xl overflow-auto rounded-2xl border border-emerald-400/30 bg-[#0b0b0b] p-5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="font-display text-2xl">Donate</h2>
                    <button type="button" className="text-sm text-zinc-400" onClick={() => setOpen(false)}>
                      Close
                    </button>
                  </div>
                  <div className="mb-4 flex flex-wrap gap-2">
                    {PAY_METHODS.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setMethod(m.id)}
                        className={`rounded-full px-3 py-1.5 text-[11px] uppercase ${method === m.id ? "bg-emerald-400 text-black" : "border border-white/15 text-zinc-300"}`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {DONATION_TIERS.map((tier) => (
                      <button
                        key={tier.name}
                        type="button"
                        disabled={busy === tier.usd}
                        onClick={async () => {
                          setBusy(tier.usd);
                          await startDonate(tier.usd, method);
                          setBusy(null);
                        }}
                        className="rounded-2xl border px-3 py-4 text-center disabled:opacity-60"
                        style={{ borderColor: `${hexColor(tier.color)}66` }}
                      >
                        <div className="font-display text-3xl" style={{ color: hexColor(tier.color) }}>
                          {tier.name}
                        </div>
                        <div className="mt-2 text-[11px] uppercase tracking-[0.16em] text-zinc-400">Pay</div>
                      </button>
                    ))}
                  </div>
                </motion.section>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        );
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          void fetch("/api/discord/donation-roles", { method: "POST" });
        }}
        className={`mt-1 flex w-full items-center ${collapsed ? "justify-center px-0" : "gap-3 px-3"} rounded-xl py-2.5 text-sm text-emerald-300 hover:bg-emerald-400/10`}
      >
        <motion.span
          className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400 text-[10px] font-black text-black"
          animate={{ scale: [1, 1.12, 1] }}
          transition={{ duration: 1.4, repeat: Infinity }}
        >
          $
        </motion.span>
        {!collapsed && <span className="uppercase tracking-[0.16em]">Donate</span>}
      </button>
      {modal}
    </>
  );
}
