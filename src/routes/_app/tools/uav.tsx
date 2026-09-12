import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { GlassPanel } from "@/components/ui-custom/GlassPanel";
import { IconUtm } from "@/components/ui-custom/CustomIcon";
import { ToolHeader } from "@/components/tools/ToolHeader";

export const Route = createFileRoute("/_app/tools/uav")({
  component: UavRoute,
});

function UavRoute() {
  return <UavBuyContent />;
}

export function UavBuyContent({ hideHeader = false }: { hideHeader?: boolean } = {}) {
  const [packagesOpen, setPackagesOpen] = useState(false);

  return (
    <div className="space-y-8">
      {hideHeader ? null : (
        <ToolHeader
          eyebrow="Combat & Intel \u00b7 purchase"
          title="UAV"
          hue={275}
          icon={<IconUtm size={24} />}
          ariaLabel="UAV buy page"
          description="Buy a reconnaissance UAV for the combat console."
        />
      )}

      <GlassPanel tier="strong" glow className="overflow-hidden border border-glass-border/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(0,0,0,0.18))] p-0">
        <div className="grid gap-0 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="relative overflow-hidden border-b border-glass-border/70 px-6 py-6 md:px-8 lg:border-b-0 lg:border-r">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.14),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(251,191,36,0.1),transparent_28%)]" />
            <div className="relative z-10 flex h-full flex-col justify-between gap-8">
              <div className="space-y-5">
                <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-amber-100/80">
                  Combat & Intel
                  <span className="h-1 w-1 rounded-full bg-amber-200/80" />
                  UAV Launch
                </div>
                <div className="max-w-xl space-y-4">
                  <div className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground">Recon / Suppression / Counter-play</div>
                  <h1 className="font-display text-5xl leading-[0.92] tracking-tight text-foreground md:text-6xl">UAV System</h1>
                  <p className="max-w-lg text-sm leading-relaxed text-muted-foreground md:text-base">
                    Buy UAV, Advanced UAV, and Counter UAV packages from one console.
                  </p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {[["Lock-on", "Fast deployment"], ["Sweep", "Extended range"], ["Suppress", "Block tracking"]].map(([label, detail]) => (
                  <div key={label} className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
                    <div className="text-[10px] uppercase tracking-[0.22em] text-amber-100/70">{label}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{detail}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-0 px-6 py-6 md:px-8">
            <div className="flex items-center justify-between gap-3 border-b border-glass-border/70 pb-4">
              <div>
                <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Status</div>
                <div className="mt-1 text-sm text-foreground/85">{packagesOpen ? "Console open" : "Ready to deploy"}</div>
              </div>
              <motion.button
                type="button"
                onClick={() => setPackagesOpen((open) => !open)}
                whileHover={{ y: -2, scale: 1.01 }}
                whileTap={{ scale: 0.985 }}
                className="rounded-full border border-amber-300/30 bg-amber-400/10 px-5 py-2.5 text-sm font-semibold text-amber-50"
              >
                {packagesOpen ? "Close UAV Console" : "Open UAV Console"}
              </motion.button>
            </div>

            <AnimatePresence initial={false} mode="wait">
              {packagesOpen ? (
                <motion.div
                  key="console-open"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 16 }}
                  className="space-y-5 pt-5"
                >
                  <div className="grid gap-3 sm:grid-cols-3">
                    {[
                      { name: "UAV", note: "Fast scan", price: "12,500" },
                      { name: "Advanced UAV", note: "Longer range", price: "18,000" },
                      { name: "Counter UAV", note: "Suppress hostile tracking", price: "16,000" },
                    ].map((item) => (
                      <motion.button
                        key={item.name}
                        type="button"
                        whileHover={{ y: -3, scale: 1.02 }}
                        className="rounded-2xl border border-amber-400/15 bg-black/20 p-4 text-left"
                      >
                        <div className="font-display text-xl text-foreground">{item.name}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{item.note}</div>
                        <div className="mt-4 text-sm font-semibold text-amber-100">{item.price} cr</div>
                      </motion.button>
                    ))}
                  </div>
                  <button type="button" className="w-full rounded-2xl border border-amber-300/40 bg-amber-400/10 px-4 py-3 text-sm font-semibold text-amber-50">
                    Buy UAV
                  </button>
                </motion.div>
              ) : (
                <motion.div key="console-closed" className="grid min-h-[280px] place-items-center py-10 text-center">
                  <div>
                    <div className="text-xs uppercase tracking-[0.28em] text-muted-foreground">Console closed</div>
                    <div className="mt-3 font-display text-2xl text-foreground">Open the UAV system to begin</div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </GlassPanel>
    </div>
  );
}
