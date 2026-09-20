import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { getEconomyBalance } from "@/lib/economy.functions";
import { PRO_BUILDER_KIT, PRO_BUILDER_PRICE } from "@/lib/pro-build";
import { IconCampaign, IconArrowRight } from "@/components/ui-custom/CustomIcon";
import { BRAND } from "@/lib/brand";

const tap = { whileHover: { scale: 1.04, y: -2 }, whileTap: { scale: 0.96 } };

export function ProBuildContent(_props: { hideHeader?: boolean; hideSummary?: boolean }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const playerId = user?.id || "";
  const playerName =
    (typeof user?.user_metadata?.name === "string" && user.user_metadata.name) || user?.email || playerId;
  const [entered, setEntered] = useState(false);
  const [mode, setMode] = useState<"base" | "map">("base");
  const [guess] = useState({ x: 6100, z: 5020, label: "Flag ping near Nadbor (unconfirmed)" });
  const [confirmed, setConfirmed] = useState(false);
  const [y, setY] = useState("");
  const [z, setZ] = useState("");
  const [photos, setPhotos] = useState<(File | null)[]>([null, null, null]);
  const [previews, setPreviews] = useState<string[]>(["", "", ""]);
  const [askBuy, setAskBuy] = useState(false);

  const credits =
    useQuery({
      queryKey: ["economy-balance", playerId],
      queryFn: () => getEconomyBalance({ data: { playerId } }),
      enabled: Boolean(playerId),
    }).data?.balance ?? 0;

  const buy = useMutation({
    mutationFn: async () => {
      const picked = photos.filter((f): f is File => Boolean(f));
      if (picked.length < 3) throw new Error("Select 3 base photos");
      if (!confirmed) throw new Error("Confirm the base first");
      if (credits < PRO_BUILDER_PRICE) throw new Error("Need 200,000 credits");
      const body = new FormData();
      body.set("playerId", playerId);
      body.set("playerName", playerName);
      body.set("discordId", playerId);
      body.set("mode", mode);
      body.set("x", String(mode === "map" ? Number(y) : guess.x));
      body.set("z", String(mode === "map" ? Number(z) : guess.z));
      body.set("baseConfirmed", "true");
      picked.forEach((f) => body.append("images", f));
      const res = await fetch("/api/pro-build/order", { method: "POST", body });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Order failed");
      return json;
    },
    onSuccess: () => {
      toast.success("PRO Builder queued");
      qc.invalidateQueries({ queryKey: ["economy-balance", playerId] });
      setAskBuy(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Order failed"),
  });

  const tryBuy = () => {
    if (photos.filter(Boolean).length < 3) {
      toast.error("Select 3 base photos");
      return;
    }
    if (!confirmed) {
      toast.error("Confirm the base first");
      return;
    }
    if (credits < PRO_BUILDER_PRICE) {
      toast.error("Need 200,000 credits");
      return;
    }
    setAskBuy(true);
  };

  return (
    <AnimatePresence mode="wait">
      {!entered ? (
        <motion.div key="gate" className="relative flex min-h-[calc(100vh-8rem)] items-center justify-center overflow-hidden bg-black px-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.04 }}>
          <motion.div className="pointer-events-none absolute inset-0" animate={{ opacity: [0.28, 0.5, 0.28] }} transition={{ duration: 4, repeat: Infinity }} style={{ background: "radial-gradient(circle at 50% 20%, color-mix(in oklab, var(--primary) 25%, transparent), transparent 60%)" }} />
          <div className="relative max-w-lg text-center">
            <motion.div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-primary/40 bg-primary/10 text-primary" animate={{ scale: [1, 1.06, 1] }} transition={{ duration: 2.2, repeat: Infinity }}>
              <IconCampaign size={28} />
            </motion.div>
            <div className="mt-5 text-[11px] uppercase tracking-[0.3em] text-primary">{BRAND.name} · Server shop</div>
            <h1 className="font-display mt-2 text-5xl text-primary sm:text-6xl">Pro Build</h1>
            <p className="mt-4 text-sm text-zinc-400">Confirm the base, pick 3 photos, pay 200,000 cr.</p>
            <motion.button type="button" onClick={() => setEntered(true)} className="relative mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-primary-foreground" {...tap}>
              Enter Pro Build <IconArrowRight size={16} />
            </motion.button>
          </div>
        </motion.div>
      ) : (
        <motion.div key="hall" className="relative min-h-[calc(100vh-8rem)] bg-black" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <div className="relative mx-auto max-w-5xl px-4 py-8">
            <motion.button type="button" onClick={() => setEntered(false)} className="mb-5 text-[11px] uppercase tracking-[0.2em] text-muted-foreground" {...tap}>
              ← Leave Pro Build
            </motion.button>
            <div className="rounded-2xl border border-primary/25 bg-white/[0.02] p-5 sm:p-8">
              <div className="text-[11px] uppercase tracking-[0.3em] text-primary">Server shop · Kit</div>
              <h2 className="font-display mt-2 text-4xl text-primary">{PRO_BUILDER_KIT.name}</h2>
              <p className="mt-2 text-sm text-zinc-400">{PRO_BUILDER_KIT.blurb}</p>
              <p className="mt-4 text-sm leading-relaxed text-zinc-300">{PRO_BUILDER_KIT.waves}</p>
              <div className="mt-5 font-mono text-2xl text-primary">{PRO_BUILDER_PRICE.toLocaleString()} cr</div>
              <div className="mt-1 text-xs text-muted-foreground">Balance {credits.toLocaleString()} cr</div>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <motion.button type="button" onClick={() => { setMode("base"); setConfirmed(false); }} className={`rounded-2xl border p-4 text-left ${mode === "base" ? "border-primary/50 bg-primary/10" : "border-primary/20 bg-white/[0.02]"}`} {...tap}>
                  <div className="text-sm font-medium">Spawn at my base</div>
                  <div className="mt-1 text-xs text-zinc-500">Flag ping — confirm it first.</div>
                </motion.button>
                <motion.button type="button" onClick={() => { setMode("map"); setConfirmed(false); }} className={`rounded-2xl border p-4 text-left ${mode === "map" ? "border-primary/50 bg-primary/10" : "border-primary/20 bg-white/[0.02]"}`} {...tap}>
                  <div className="text-sm font-medium">Choose on map</div>
                  <div className="mt-1 text-xs text-zinc-500">Only if that pin is your base.</div>
                </motion.button>
              </div>
              {mode === "base" && (
                <div className="mt-4 rounded-2xl border border-primary/25 bg-white/[0.02] p-4 text-sm">
                  <div className="font-medium text-primary">Is this your base?</div>
                  <p className="mt-1 text-zinc-400">{guess.label} · Y {guess.x} / Z {guess.z}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <motion.button type="button" onClick={() => setConfirmed(true)} className="rounded-full bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary-foreground" {...tap}>Yes, that is my base</motion.button>
                    <motion.button type="button" onClick={() => { setConfirmed(false); setMode("map"); }} className="rounded-full border border-primary/30 px-4 py-2 text-xs uppercase tracking-[0.16em]" {...tap}>Not my base</motion.button>
                  </div>
                  {confirmed && <p className="mt-2 text-xs text-emerald-400">Base confirmed</p>}
                </div>
              )}
              {mode === "map" && (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Y<input value={y} onChange={(e) => setY(e.target.value)} className="mt-1 w-full rounded-full border border-primary/20 bg-black px-4 py-2 font-mono text-sm" /></label>
                  <label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Z<input value={z} onChange={(e) => setZ(e.target.value)} className="mt-1 w-full rounded-full border border-primary/20 bg-black px-4 py-2 font-mono text-sm" /></label>
                  <motion.button type="button" onClick={() => window.open("/tools/base-map-clicker", "_blank")} className="col-span-2 rounded-full border border-primary/40 py-2 text-[11px] uppercase tracking-[0.18em] text-primary" {...tap}>Open map picker</motion.button>
                  <motion.button type="button" onClick={() => setConfirmed(true)} className="col-span-2 rounded-full border border-primary/25 py-2 text-[11px] uppercase tracking-[0.18em]" {...tap}>I confirm this pin is my base</motion.button>
                  {confirmed && <p className="col-span-2 text-xs text-emerald-400">Pin confirmed</p>}
                </div>
              )}
              <div className="mt-5">
                <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">3 base photos — tap to pick from camera or gallery</div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {photos.map((_, i) => (
                    <motion.label key={i} className="flex aspect-square cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-primary/25 bg-white/[0.02] text-[11px] uppercase tracking-wider text-zinc-500" {...tap}>
                      {previews[i] ? <img src={previews[i]} alt="" className="h-full w-full object-cover" /> : <span>Photo {i + 1}</span>}
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setPhotos((cur) => cur.map((x, idx) => (idx === i ? file : x)));
                        setPreviews((cur) => cur.map((x, idx) => (idx === i ? (file ? URL.createObjectURL(file) : "") : x)));
                      }} />
                    </motion.label>
                  ))}
                </div>
              </div>
              <motion.button type="button" onClick={tryBuy} className="mt-6 rounded-full bg-primary px-7 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-primary-foreground" {...tap}>
                Buy PRO Builder · {PRO_BUILDER_PRICE.toLocaleString()} cr
              </motion.button>
            </div>
          </div>
        </motion.div>
      )}
      {askBuy && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={() => setAskBuy(false)}>
          <motion.div className="max-w-md rounded-2xl border border-primary/30 bg-black p-6" initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-3xl text-primary">Confirm 200,000 cr</h3>
            <p className="mt-3 text-sm text-zinc-400">Ticket opens with your 3 photos attached.</p>
            <div className="mt-5 flex gap-2">
              <motion.button type="button" onClick={() => setAskBuy(false)} className="flex-1 rounded-full border border-primary/25 py-2 text-xs uppercase tracking-[0.16em]" {...tap}>Cancel</motion.button>
              <motion.button type="button" onClick={() => buy.mutate()} className="flex-1 rounded-full bg-primary py-2 text-xs uppercase tracking-[0.16em] text-primary-foreground" {...tap}>{buy.isPending ? "Sending…" : "Confirm buy"}</motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
