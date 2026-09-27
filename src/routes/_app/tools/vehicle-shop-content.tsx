import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { getEconomyBalance, purchaseShopItem } from "@/lib/economy.functions";
import { formatRestartLeft, nextRestartAt } from "@/lib/next-restart";
import { VEHICLES, type ShopVehicle, type VehicleVariant } from "@/lib/vehicle-catalog";

function wiki(file: string) {
  return `/api/wiki-image?file=${encodeURIComponent(file)}`;
}

function vehicleSrcs(veh: ShopVehicle, variant: VehicleVariant) {
  return [
    wiki(`${veh.name}.png`),
    wiki(`${veh.name.replace(/ /g, "_")}.png`),
    wiki(`${variant.classname}.png`),
    wiki(`${variant.classname.replace(/_/g, " ")}.png`),
    variant.image,
  ];
}

function VehicleImg({ srcs, alt, className }: { srcs: string[]; alt: string; className?: string }) {
  const [i, setI] = useState(0);
  const src = srcs[Math.min(i, srcs.length - 1)];
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setI((n) => Math.min(n + 1, srcs.length - 1))}
    />
  );
}

export function VehicleShopContent() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const playerId = user?.id || "demo-user";
  const displayName =
    (typeof user?.user_metadata?.name === "string" && user.user_metadata.name) ||
    user?.email ||
    playerId;
  const [selectedId, setSelectedId] = useState(VEHICLES[0].id);
  const selected = VEHICLES.find((v) => v.id === selectedId) ?? VEHICLES[0];
  const [colorId, setColorId] = useState(selected.variants[0].classname);
  const [askColor, setAskColor] = useState(false);
  const [now, setNow] = useState(Date.now());
  const variant =
    selected.variants.find((v) => v.classname === colorId) ?? selected.variants[0];

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const pickVehicle = (v: ShopVehicle) => {
    setSelectedId(v.id);
    setColorId(v.variants[0].classname);
    setAskColor(v.variants.length > 1);
  };

  const balanceQ = useQuery({
    queryKey: ["economy-balance", playerId],
    queryFn: () => getEconomyBalance({ data: { playerId } }),
  });
  const credits = balanceQ.data?.balance ?? 0;
  const restartLeft = formatRestartLeft(nextRestartAt(now) - now);

  const buyMut = useMutation({
    mutationFn: (choice: VehicleVariant) =>
      purchaseShopItem({
        data: {
          playerId,
          displayName,
          itemId: choice.classname,
          itemName: `${selected.name} (${choice.color})`,
          price: selected.price,
          category: "item",
          allowRepeat: true,
        },
      }),
    onSuccess: (_res, choice) => {
      toast.success(`${selected.name} · ${choice.color} queued for next restart (${restartLeft})`);
      qc.invalidateQueries({ queryKey: ["economy-balance", playerId] });
      setAskColor(false);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Purchase failed"),
  });

  const buy = () => {
    if (selected.variants.length > 1 && !askColor) {
      setAskColor(true);
      toast.message("Pick a color first");
      return;
    }
    buyMut.mutate(variant);
  };

  return (
    <div className="relative min-h-[calc(100vh-3rem)] overflow-hidden bg-[#050505] px-3 py-6 text-zinc-100 sm:px-5">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[#d4a84b]/30 pb-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.28em] text-[#d4a84b]">DAYZ PRO · Motor pool</div>
            <h1 className="font-display mt-1 text-4xl text-[#e8c56a] sm:text-5xl">Vehicle Shop</h1>
            <p className="mt-2 max-w-2xl text-sm text-zinc-400">
              Official vehicles and colors. Wiki images. Vehicle drops after the next restart.
            </p>
          </div>
          <div className="flex gap-2">
            <div className="rounded-xl border border-[#d4a84b]/40 bg-[#d4a84b]/10 px-4 py-3 text-right">
              <div className="text-[10px] uppercase tracking-[0.2em] text-[#d4a84b]/80">Next restart</div>
              <div className="mt-1 font-mono text-xl text-[#f5e6c0]">{restartLeft}</div>
            </div>
            <div className="rounded-xl border border-[#d4a84b]/40 bg-[#d4a84b]/10 px-4 py-3 text-right">
              <div className="text-[10px] uppercase tracking-[0.2em] text-[#d4a84b]/80">Credits</div>
              <div className="mt-1 font-mono text-2xl text-[#f5e6c0]">{credits.toLocaleString()}</div>
            </div>
          </div>
        </header>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {VEHICLES.map((veh) => {
            const thumb = veh.variants[0];
            const active = veh.id === selected.id;
            return (
              <button
                key={veh.id}
                type="button"
                onClick={() => pickVehicle(veh)}
                className={`overflow-hidden rounded-2xl border text-left transition ${active ? "border-[#e8c56a] bg-[#d4a84b]/15" : "border-[#d4a84b]/20 bg-black/40 hover:border-[#d4a84b]/45"}`}
              >
                <div className="flex h-36 items-center justify-center bg-[#0b0b0b]">
                  <VehicleImg srcs={vehicleSrcs(veh, thumb)} alt={veh.name} className="max-h-32 max-w-full object-contain" />
                </div>
                <div className="p-3">
                  <div className="text-sm font-medium text-[#f5e6c0]">{veh.name}</div>
                  <div className="text-[10px] uppercase tracking-wide text-zinc-500">{veh.role}</div>
                  <div className="mt-1 font-mono text-[12px] text-[#e8c56a]">{veh.price.toLocaleString()} cr · {veh.variants.length} color{veh.variants.length === 1 ? "" : "s"}</div>
                </div>
              </button>
            );
          })}
        </div>
        {selected ? (
          <div className="rounded-2xl border border-[#d4a84b]/30 bg-black/50 p-4 sm:p-5">
            <div className="flex flex-wrap gap-5">
              <div className="flex h-48 w-full items-center justify-center rounded-xl border border-[#d4a84b]/20 bg-[#0b0b0b] sm:w-72">
                <VehicleImg srcs={vehicleSrcs(selected, variant)} alt={`${selected.name} ${variant.color}`} className="max-h-44 max-w-full object-contain" />
              </div>
              <div className="min-w-[220px] flex-1">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#d4a84b]">Selected</div>
                <h2 className="font-display mt-1 text-3xl text-[#e8c56a]">{selected.name}</h2>
                <p className="mt-1 text-sm text-zinc-400">{selected.role} · {variant.classname}</p>
                <p className="mt-1 text-xs text-[#d4a84b]">Spawns after restart · {restartLeft}</p>
                <a href={selected.wiki} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-[#d4a84b] underline">DayZ wiki</a>
                <div className="mt-4 text-[10px] uppercase tracking-wide text-[#e8c56a]">Color</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {selected.variants.map((opt) => (
                    <button
                      key={opt.classname}
                      type="button"
                      onClick={() => { setColorId(opt.classname); setAskColor(true); }}
                      className={`rounded-full border px-3 py-1.5 text-xs uppercase tracking-wide ${colorId === opt.classname ? "border-[#e8c56a] bg-[#d4a84b]/20 text-[#f5e6c0]" : "border-[#d4a84b]/25 text-zinc-400"}`}
                    >
                      {opt.color}
                    </button>
                  ))}
                </div>
                {askColor && selected.variants.length > 1 ? (
                  <div className="mt-3 rounded-lg border border-[#d4a84b]/30 bg-[#d4a84b]/10 px-3 py-2 text-sm text-[#f5e6c0]">
                    Buy the {variant.color} {selected.name}? Lands after restart.
                  </div>
                ) : null}
                <button
                  type="button"
                  disabled={buyMut.isPending || credits < selected.price}
                  onClick={buy}
                  className="mt-4 w-full rounded-full bg-[#d4a84b] px-5 py-3 text-sm font-semibold uppercase tracking-[0.16em] text-[#1a1205] disabled:bg-zinc-700 disabled:text-zinc-400"
                >
                  {buyMut.isPending ? "Buying…" : `Buy ${variant.color} · ${selected.price.toLocaleString()} cr`}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
