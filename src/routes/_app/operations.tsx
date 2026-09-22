import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { acceptAssassin, listMyOperations, type AssassinContract } from "@/lib/ops.functions";

export const Route = createFileRoute("/_app/operations")({
  component: OperationsPage,
});

function left(endsAt: string) {
  const ms = Math.max(0, new Date(endsAt).getTime() - Date.now());
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

function OperationsPage() {
  const [mine, setMine] = useState<AssassinContract[]>([]);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const data = await listMyOperations();
    setMine(data.mine);
  }

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const active = mine.find((c) => c.status === "active");

  async function take() {
    setBusy(true);
    try {
      const c = await acceptAssassin();
      setMine((prev) => [c, ...prev.filter((x) => x.id !== c.id)]);
      toast.success(`Target marked: ${c.targetTag} · ${c.reward.toLocaleString()} CR if you get the kill`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not accept");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="text-[10px] uppercase tracking-[0.28em] text-[#d4a84b]/80">Operations</div>
      <h1 className="mt-1 font-display text-4xl text-[#e8c56a]">Assassin a target</h1>
      <p className="mt-2 text-sm text-zinc-400">
        Pay 500 CR to accept. A random linked player is marked. Kill them within 6 hours and the contract pays 2,500 or 5,000 CR.
      </p>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative mt-6 overflow-hidden rounded-3xl border border-[#d4a84b]/30 bg-black p-6"
      >
        <div className="pointer-events-none absolute inset-0 opacity-20" style={{ backgroundImage: "linear-gradient(135deg, transparent 48%, rgba(212,168,75,0.2) 49%, transparent 50%)", backgroundSize: "40px 40px" }} />
        <div className="relative">
          <div className="text-[10px] uppercase tracking-[0.2em] text-red-400">Active contract type</div>
          <div className="mt-1 font-display text-3xl text-[#e8c56a]">Assassin a target</div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs uppercase tracking-[0.16em] text-zinc-500">
            <div className="rounded-xl border border-[#d4a84b]/20 p-3"><div className="text-[#e8c56a]">500</div>accept</div>
            <div className="rounded-xl border border-[#d4a84b]/20 p-3"><div className="text-[#e8c56a]">6h</div>window</div>
            <div className="rounded-xl border border-[#d4a84b]/20 p-3"><div className="text-[#e8c56a]">2.5k / 5k</div>payout</div>
          </div>
          {active ? (
            <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
              <div className="text-[10px] uppercase tracking-[0.2em] text-red-300">Live hit</div>
              <div className="mt-1 font-display text-2xl text-white">{active.targetTag}</div>
              <div className="mt-1 text-sm text-zinc-400">
                Reward {active.reward.toLocaleString()} CR · {left(active.endsAt)} left
              </div>
            </div>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => void take()}
              className="mt-5 w-full rounded-full bg-[#d4a84b] py-3 text-sm font-semibold uppercase tracking-[0.18em] text-black disabled:opacity-60"
            >
              {busy ? "Marking target…" : "Accept — 500 CR"}
            </button>
          )}
        </div>
      </motion.section>

      {mine.length > 0 ? (
        <div className="mt-6 space-y-2">
          <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">History</div>
          {mine.map((c) => (
            <div key={c.id} className="rounded-2xl border border-white/10 px-4 py-3 text-sm">
              <span className="text-[#e8c56a]">{c.targetTag}</span>
              <span className="text-zinc-500"> · {c.status} · {c.reward.toLocaleString()} CR</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
