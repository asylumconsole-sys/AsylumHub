import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { getEconomyBalance } from "@/lib/economy.functions";
import { PRO_BUILDER_KIT, PRO_BUILDER_PRICE } from "@/lib/pro-build";
import { IconCampaign, IconArrowRight } from "@/components/ui-custom/CustomIcon";
import { BRAND } from "@/lib/brand";

export function ProBuildContent({ hideHeader = false }: { hideHeader?: boolean }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const playerId = user?.id || "";
  const playerName =
    (typeof user?.user_metadata?.name === "string" && user.user_metadata.name) || user?.email || playerId;
  const [entered, setEntered] = useState(hideHeader);
  const [mode, setMode] = useState<"base" | "map">("base");
  const [guess] = useState({ x: 6100, z: 5020, label: "Flag ping near Nadbor (unconfirmed)" });
  const [confirmed, setConfirmed] = useState(false);
  const [rejected, setRejected] = useState(false);
  const [y, setY] = useState("");
  const [z, setZ] = useState("");
  const [photos, setPhotos] = useState<(File | null)[]>([null, null, null]);
  const [previews, setPreviews] = useState<string[]>(["", "", ""]);
  const [askBuy, setAskBuy] = useState(false);

  const balQ = useQuery({
    queryKey: ["economy-balance", playerId],
    queryFn: () => getEconomyBalance({ data: { playerId } }),
    enabled: Boolean(playerId),
  });
  const credits = balQ.data?.balance ?? 0;

  const buy = useMutation({
    mutationFn: async () => {
      const picked = photos.filter((f): f is File => Boolean(f));
      if (picked.length < 3) throw new Error("Select 3 base photos");
      const x = mode === "map" ? Number(y) : guess.x;
      const zVal = mode === "map" ? Number(z) : guess.z;
      const body = new FormData();
      body.set("playerId", playerId);
      body.set("playerName", playerName);
      body.set("discordId", playerId);
      body.set("mode", mode);
      body.set("x", String(x));
      body.set("z", String(zVal));
      body.set("baseConfirmed", String(confirmed && !rejected));
      picked.forEach((f) => body.append("images", f));
      const res = await fetch("/api/pro-build/order", { method: "POST", body });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Order failed");
      return json;
    },
    onSuccess: () => {
      toast.success("PRO Builder queued", {
        description: "Drop within 4 hours after coords + 3 photos. Ticket opened for staff.",
      });
      qc.invalidateQueries({ queryKey: ["economy-balance", playerId] });
      setAskBuy(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Order failed"),
  });

  const pickPhoto = (index: number, file: File | null) => {
    setPhotos((cur) => cur.map((x, idx) => (idx === index ? file : x)));
    setPreviews((cur) => cur.map((x, idx) => (idx === index ? (file ? URL.createObjectURL(file) : "") : x)));
  };

  return (
    <AnimatePresence mode="wait">
      {!entered ? (
        <motion.div key="gate" className="relative flex min-h-[calc(100vh-8rem)] items-center justify-center overflow-hidden bg-black px-4" initial={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.04, transition: { duration: 0.5, ease: [0.4, 0, 1, 1] } }}>
          <style>{`@keyframes warroom-scan { 0% { transform: translateY(-100%); } 100% { transform: translateY(100%); } } @keyframes warroom-flicker { 0%, 100% { opacity: 1; } 43% { opacity: 0.72; } 72% { opacity: 0.8; } } @keyframes warroom-shine { 0% { transform: translateX(-140%) skewX(-20deg); } 100% { transform: translateX(240%) skewX(-20deg); } }`}</style>
          <motion.div className="pointer-events-none absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_50%_20%,color-mix(in_oklab,var(--primary)_25%,transparent),transparent_60%)]" animate={{ opacity: [0.28, 0.5, 0.28] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }} />
          <div className="relative max-w-lg text-center">
            <motion.div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-primary/40 bg-primary/10 text-primary"><IconCampaign size={28} /></motion.div>
            <div className="mt-5 text-[11px] uppercase tracking-[0.3em] text-primary">{BRAND.name} · Server shop</div>
            <h1 className="font-display mt-2 text-5xl text-primary sm:text-6xl">Pro Build</h1>
            <p className="mt-4 text-sm text-zinc-400">Confirm the base, pay 200,000 cr, and the crate drops within 4 hours.</p>
            <motion.button type="button" onClick={() => setEntered(true)} className="relative mt-8 inline-flex items-center gap-2 overflow-hidden rounded-full bg-primary px-7 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-primary-foreground" whileHover={{ scale: 1.05 }}>
              <span className="relative">Enter Pro Build</span>
              <IconArrowRight size={16} />
            </motion.button>
          </div>
        </motion.div>
      ) : (
        <motion.div key="hall" className="relative min-h-[calc(100vh-8rem)] bg-black" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="relative mx-auto max-w-5xl px-4 py-8">
            <div className="rounded-2xl border border-primary/25 bg-white/[0.02] p-5 sm:p-8">
              <div className="text-[11px] uppercase tracking-[0.3em] text-primary">Server shop · Kit</div>
              <h2 className="font-display mt-2 text-4xl text-primary">{PRO_BUILDER_KIT.name}</h2>
              <p className="mt-2 text-sm text-zinc-400">{PRO_BUILDER_KIT.blurb}</p>
              <p className="mt-4 text-sm leading-relaxed text-zinc-300">{PRO_BUILDER_KIT.waves}</p>
              <div className="mt-5 font-mono text-2xl text-primary">{PRO_BUILDER_PRICE.toLocaleString()} cr</div>
              <div className="mt-1 text-xs text-muted-foreground">Balance {credits.toLocaleString()} cr</div>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <button type="button" onClick={() => { setMode("base"); setConfirmed(false); setRejected(false); }} className={`rounded-2xl border p-4 text-left ${mode === "base" ? "border-primary/50 bg-primary/10" : "border-primary/20 bg-white/[0.02]"}`}>
                  <div className="text-sm font-medium">Spawn at my base</div>
                  <div className="mt-1 text-xs text-zinc-500">Flag ping from you or your faction. Confirm it first.</div>
                </button>
                <button type="button" onClick={() => { setMode("map"); setConfirmed(false); }} className={`rounded-2xl border p-4 text-left ${mode === "map" ? "border-primary/50 bg-primary/10" : "border-primary/20 bg-white/[0.02]"}`}>
                  <div className="text-sm font-medium">Choose on map</div>
                  <div className="mt-1 text-xs text-zinc-500">Only if that pin is your base / faction flag.</div>
                </button>
              </div>
              {mode === "base" && (
                <div className="mt-4 rounded-2xl border border-primary/25 bg-white/[0.02] p-4 text-sm">
                  <div className="font-medium text-primary">Is this your base?</div>
                  <p className="mt-1 text-zinc-400">{guess.label} · Y {guess.x} / Z {guess.z}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => { setConfirmed(true); setRejected(false); }} className="rounded-full bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary-foreground">Yes, that is my base</button>
                    <button type="button" onClick={() => { setRejected(true); setConfirmed(false); setMode("map"); }} className="rounded-full border border-primary/30 px-4 py-2 text-xs uppercase tracking-[0.16em]">Not my base</button>
                  </div>
                </div>
              )}
              {mode === "map" && (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Y<input value={y} onChange={(e) => setY(e.target.value)} className="mt-1 w-full rounded-full border border-primary/20 bg-black px-4 py-2 font-mono text-sm" /></label>
                  <label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Z<input value={z} onChange={(e) => setZ(e.target.value)} className="mt-1 w-full rounded-full border border-primary/20 bg-black px-4 py-2 font-mono text-sm" /></label>
                  <button type="button" onClick={() => window.open("/tools/base-map-clicker", "_blank")} className="col-span-2 rounded-full border border-primary/40 py-2 text-[11px] uppercase tracking-[0.18em] text-primary">Open map picker</button>
                  <button type="button" onClick={() => setConfirmed(true)} className="col-span-2 rounded-full border border-primary/25 py-2 text-[11px] uppercase tracking-[0.18em]">I confirm this pin is my base</button>
                </div>
              )}
              <div className="mt-5">
                <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">3 base photos</div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {photos.map((_, i) => (
                    <label key={i} className="flex aspect-square cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border border-primary/25 bg-white/[0.02] text-center text-[11px] uppercase tracking-wider text-zinc-500">
                      {previews[i] ? <img src={previews[i]} alt="" className="h-full w-full object-cover" /> : <span>Photo {i + 1}</span>}
                      <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => pickPhoto(i, e.target.files?.[0] || null)} />
                    </label>
                  ))}
                </div>
              </div>
              <button type="button" disabled={credits < PRO_BUILDER_PRICE} onClick={() => setAskBuy(true)} className="mt-6 rounded-full bg-primary px-7 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-primary-foreground disabled:opacity-40">
                Buy PRO Builder · {PRO_BUILDER_PRICE.toLocaleString()} cr
              </button>
            </div>
          </div>
        </motion.div>
      )}
      {askBuy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setAskBuy(false)}>
          <div className="max-w-md rounded-2xl border border-primary/30 bg-black p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-3xl text-primary">Confirm 200,000 cr</h3>
            <p className="mt-3 text-sm text-zinc-400">Ticket opens with your 3 photos attached. Drop within 4 hours.</p>
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={() => setAskBuy(false)} className="flex-1 rounded-full border border-primary/25 py-2 text-xs uppercase tracking-[0.16em]">Cancel</button>
              <button type="button" disabled={buy.isPending} onClick={() => buy.mutate()} className="flex-1 rounded-full bg-primary py-2 text-xs uppercase tracking-[0.16em] text-primary-foreground">{buy.isPending ? "Sending…" : "Confirm buy"}</button>
            </div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
