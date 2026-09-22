import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FactionHubContent } from "@/components/dayz/FactionHubContent";
import { FactionLeaderboard } from "@/components/dayz/FactionLeaderboard";
import { IconCampaign, IconArrowRight } from "@/components/ui-custom/CustomIcon";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/_app/war-room")({
  component: WarRoomPage,
  head: () => ({
    meta: [
      { title: `War Room — ${BRAND.name}` },
      { name: "description", content: "Create or join a faction, declare wars, and manage your roster." },
    ],
  }),
});

function WarRoomPage() {
  const [entered, setEntered] = useState(false);
  const title = "War Room";

  return (
    <AnimatePresence mode="wait">
      {!entered ? (
        <motion.div
          key="gate"
          className="relative flex min-h-[calc(100vh-3rem)] items-center justify-center overflow-hidden bg-black px-4"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.04, transition: { duration: 0.5, ease: [0.4, 0, 1, 1] } }}
        >
          <style>{`
            @keyframes warroom-scan { 0% { transform: translateY(-100%); } 100% { transform: translateY(100%); } }
            @keyframes warroom-flicker { 0%, 100% { opacity: 1; } 42% { opacity: 1; } 43% { opacity: 0.72; } 44% { opacity: 1; } 71% { opacity: 1; } 72% { opacity: 0.8; } 73% { opacity: 1; } }
            @keyframes warroom-shine { 0% { transform: translateX(-140%) skewX(-20deg); } 100% { transform: translateX(240%) skewX(-20deg); } }
          `}</style>
          <motion.div className="pointer-events-none absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_50%_20%,color-mix(in_oklab,var(--primary)_25%,transparent),transparent_60%)]" animate={{ opacity: [0.28, 0.5, 0.28] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }} />
          <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(135deg,transparent_0%,transparent_48%,color-mix(in_oklab,var(--primary)_18%,transparent)_49%,transparent_50%)] [background-size:46px_46px]" />
          <div className="pointer-events-none absolute inset-x-0 h-40 opacity-[0.06]" style={{ background: "linear-gradient(180deg, transparent, color-mix(in oklab, var(--primary) 90%, white), transparent)", animation: "warroom-scan 6s linear infinite" }} aria-hidden />
          <div className="relative max-w-lg text-center">
            <div className="relative mx-auto flex size-20 items-center justify-center">
              <motion.span className="absolute inset-0 rounded-full border border-primary/30 border-t-primary" animate={{ rotate: 360 }} transition={{ duration: 6, repeat: Infinity, ease: "linear" }} />
              <motion.div className="relative flex size-14 items-center justify-center rounded-2xl border border-primary/40 bg-primary/10 text-primary">
                <IconCampaign size={28} />
              </motion.div>
            </div>
            <div className="mt-5 text-[11px] uppercase tracking-[0.3em] text-primary">{BRAND.name} · Command hall</div>
            <h1 className="font-display mt-2 text-5xl text-primary sm:text-6xl">{title}</h1>
            <p className="mt-4 text-sm text-zinc-400 sm:text-base">Faction rosters, standing wars, and territory contracts. Step inside to manage your crew.</p>
            <motion.button type="button" onClick={() => setEntered(true)} className="relative mt-8 inline-flex items-center gap-2 overflow-hidden rounded-full bg-primary px-7 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-primary-foreground" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.96 }}>
              <span className="relative">Enter War Room</span>
              <IconArrowRight size={16} />
            </motion.button>
          </div>
        </motion.div>
      ) : (
        <motion.div key="hall" className="relative min-h-[calc(100vh-3rem)] bg-black" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
          <div className="relative mx-auto max-w-5xl px-4 py-8">
            <button type="button" onClick={() => setEntered(false)} className="mb-5 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.2em] text-muted-foreground transition hover:text-foreground">
              <span aria-hidden="true">←</span> Leave War Room
            </button>
            <div className="rounded-2xl border border-primary/25 bg-white/[0.02] p-5 sm:p-8">
              <FactionHubContent />
            </div>
            <FactionLeaderboard />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
