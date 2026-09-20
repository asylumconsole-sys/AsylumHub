import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { getEconomyBalance } from "@/lib/economy.functions";
import { PRO_BUILDER_KIT, PRO_BUILDER_PRICE } from "@/lib/pro-build";

export function ProBuildContent({ hideHeader = false }: { hideHeader?: boolean }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const playerId = user?.id || "";
  const playerName =
    (typeof user?.user_metadata?.name === "string" && user.user_metadata.name) || user?.email || playerId;
  const [mode, setMode] = useState<"base" | "map">("base");
  const [guess] = useState({ x: 6100, z: 5020, label: "Flag ping near Nadbor (unconfirmed)" });
  const [confirmed, setConfirmed] = useState(false);
  const [rejected, setRejected] = useState(false);
  const [y, setY] = useState("");
  const [z, setZ] = useState("");
  const [imgs, setImgs] = useState(["", "", ""]);
  const [askBuy, setAskBuy] = useState(false);

  const balQ = useQuery({
    queryKey: ["economy-balance", playerId],
    queryFn: () => getEconomyBalance({ data: { playerId } }),
    enabled: Boolean(playerId),
  });
  const credits = balQ.data?.balance ?? 0;

  const buy = useMutation({
    mutationFn: async () => {
      const x = mode === "map" ? Number(y) : guess.x;
      const zVal = mode === "map" ? Number(z) : guess.z;
      const res = await fetch("/api/pro-build/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId,
          playerName,
          discordId: playerId,
          mode,
          x,
          z: zVal,
          baseConfirmed: confirmed && !rejected,
          images: imgs,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Order failed");
      return json;
    },
    onSuccess: (json) => {
      toast.success("PRO Builder queued", {
        description: "Drop within 4 hours after coords + 3 photos. Ticket opened for staff.",
      });
      qc.invalidateQueries({ queryKey: ["economy-balance", playerId] });
      setAskBuy(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Order failed"),
  });

  return (
    <div className="space-y-5">
      {!hideHeader && (
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-primary">Server shop</div>
          <h1 className="font-display mt-1 text-4xl text-primary">Pro Build</h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400">
            Staff drop a full builder crate on your confirmed base. You see it as an AI drop within 4 hours.
          </p>
        </div>
      )}
      <div className="rounded-2xl border border-primary/30 bg-black/40 p-5">
        <div className="text-[10px] uppercase tracking-wider text-primary">Kit</div>
        <h2 className="font-display mt-1 text-3xl">{PRO_BUILDER_KIT.name}</h2>
        <p className="mt-2 text-sm text-zinc-400">{PRO_BUILDER_KIT.blurb}</p>
        <p className="mt-3 text-sm leading-relaxed text-zinc-300">{PRO_BUILDER_KIT.waves}</p>
        <div className="mt-4 font-mono text-xl text-primary">{PRO_BUILDER_PRICE.toLocaleString()} cr</div>
        <div className="mt-1 text-xs text-muted-foreground">Your credits: {credits.toLocaleString()}</div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={() => { setMode("base"); setConfirmed(false); setRejected(false); }} className={`rounded-xl border p-4 text-left ${mode === "base" ? "border-primary bg-primary/10" : "border-white/10"}`}>
          <div className="text-sm font-medium">Spawn at my base</div>
          <div className="mt-1 text-xs text-muted-foreground">Uses a flag ping from you or your faction. You must confirm it.</div>
        </button>
        <button type="button" onClick={() => { setMode("map"); setConfirmed(false); }} className={`rounded-xl border p-4 text-left ${mode === "map" ? "border-primary bg-primary/10" : "border-white/10"}`}>
          <div className="text-sm font-medium">Choose on map</div>
          <div className="mt-1 text-xs text-muted-foreground">Only valid if that pin is your base / faction flag.</div>
        </button>
      </div>

      {mode === "base" && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
          <div className="font-medium text-amber-200">Is this your base?</div>
          <p className="mt-1 text-zinc-400">{guess.label} · Y {guess.x} / Z {guess.z}</p>
          <p className="mt-2 text-xs text-zinc-500">Detected from a placed flag. Confirm before we treat it as yours.</p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => { setConfirmed(true); setRejected(false); }} className="rounded-lg bg-primary px-3 py-2 text-xs text-primary-foreground">Yes, that is my base</button>
            <button type="button" onClick={() => { setRejected(true); setConfirmed(false); setMode("map"); }} className="rounded-lg border border-white/15 px-3 py-2 text-xs">Not my base — I’ll pin it</button>
          </div>
        </div>
      )}

      {mode === "map" && (
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-muted-foreground">Y<input value={y} onChange={(e) => setY(e.target.value)} className="mt-1 w-full rounded-lg border border-white/15 bg-black px-3 py-2 font-mono text-sm" /></label>
          <label className="text-xs text-muted-foreground">Z<input value={z} onChange={(e) => setZ(e.target.value)} className="mt-1 w-full rounded-lg border border-white/15 bg-black px-3 py-2 font-mono text-sm" /></label>
          <button type="button" onClick={() => window.open("/tools/base-map-clicker", "_blank")} className="col-span-2 rounded-lg border border-primary/40 py-2 text-xs uppercase tracking-wider text-primary">Open map picker</button>
          <button type="button" onClick={() => setConfirmed(true)} className="col-span-2 rounded-lg border border-white/15 py-2 text-xs">I confirm this pin is my base / faction base</button>
        </div>
      )}

      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">3 base photos (links)</div>
        {imgs.map((v, i) => (
          <input key={i} value={v} onChange={(e) => setImgs((cur) => cur.map((x, idx) => (idx === i ? e.target.value : x)))} placeholder={`Image ${i + 1} URL`} className="mt-2 w-full rounded-lg border border-white/15 bg-black px-3 py-2 text-sm" />
        ))}
      </div>

      <button type="button" disabled={credits < PRO_BUILDER_PRICE} onClick={() => setAskBuy(true)} className="rounded-full bg-primary px-6 py-3 text-sm font-semibold uppercase tracking-wider text-primary-foreground disabled:opacity-40">
        Buy PRO Builder · {PRO_BUILDER_PRICE.toLocaleString()} cr
      </button>

      {askBuy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setAskBuy(false)}>
          <div className="max-w-md rounded-2xl border border-primary/40 bg-[#0a0a0a] p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl text-primary">Confirm 200,000 cr</h3>
            <p className="mt-2 text-sm text-zinc-400">
              After pay, a ticket is opened and you’re pinged. The drop lands within 4 hours once coords + 3 photos are in. Builders vote who places it.
            </p>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setAskBuy(false)} className="flex-1 rounded-lg border border-white/15 py-2 text-sm">Cancel</button>
              <button type="button" disabled={buy.isPending} onClick={() => buy.mutate()} className="flex-1 rounded-lg bg-primary py-2 text-sm text-primary-foreground">{buy.isPending ? "Sending…" : "Confirm buy"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
