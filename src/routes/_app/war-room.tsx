import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FactionHubContent } from "@/components/dayz/FactionHubContent";
import { FactionHQ } from "@/components/dayz/FactionHQ";
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
  const [desk, setDesk] = useState<"hall" | "hq">("hall");
  const title = "War Room";

  return (
    <AnimatePresence mode="wait">
      {!entered ? (
        <motion.div key="gate" className="relative flex min-h-[calc(100vh-3rem)] items-center justify-center overflow-hidden bg-black px-4" initial={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.04, transition: { duration: 0.5, ease: [0.4, 0, 1, 1] } }}>
          <div className="relative max-w-lg text-center">
            <div className="relative mx-auto flex size-20 items-center justify-center">
              <motion.span className="absolute inset-0 rounded-full border border-primary/30 border-t-primary" animate={{ rotate: 360 }} transition={{ duration: 6, repeat: Infinity, ease: "linear" }} />
              <motion.div className="relative flex size-14 items-center justify-center rounded-2xl border border-primary/40 bg-primary/10 text-primary">
                <IconCampaign size={28} />
              </motion.div>
            </div>
            <div className="mt-5 text-[11px] uppercase tracking-[0.3em] text-primary">{BRAND.name} · Command hall</div>
            <h1 className="font-display mt-2 text-5xl text-primary sm:text-6xl">{title}</h1>
            <motion.button type="button" onClick={() => setEntered(true)} className="relative mt-8 inline-flex items-center gap-2 overflow-hidden rounded-full bg-primary px-7 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-primary-foreground" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.96 }}>
              <span className="relative">Enter War Room</span>
              <IconArrowRight size={16} />
            </motion.button>
          </div>
        </motion.div>
      ) : (
        <motion.div key="hall" className="relative min-h-[calc(100vh-3rem)] bg-black" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="relative mx-auto max-w-5xl px-4 py-8">
            <button type="button" onClick={() => setEntered(false)} className="mb-5 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Leave War Room</button>
            <div className="mb-4 flex gap-2">
              <button type="button" onClick={() => setDesk("hall")} className={`rounded-full border px-4 py-1.5 text-[10px] uppercase tracking-[0.16em] ${desk === "hall" ? "border-[#d4a84b] text-[#e8c56a]" : "border-white/10 text-zinc-500"}`}>Hall</button>
              <button type="button" onClick={() => setDesk("hq")} className={`rounded-full border px-4 py-1.5 text-[10px] uppercase tracking-[0.16em] ${desk === "hq" ? "border-[#d4a84b] text-[#e8c56a]" : "border-white/10 text-zinc-500"}`}>Faction HQ</button>
            </div>
            <div className="rounded-2xl border border-primary/25 bg-white/[0.02] p-5 sm:p-8">
              {desk === "hall" ? <FactionHubContent /> : <FactionHQ />}
            </div>
            {desk === "hall" ? <FactionLeaderboard /> : null}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
