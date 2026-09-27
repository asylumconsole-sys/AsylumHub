import { useEffect, useState } from "react";
import { toast } from "sonner";
import { payPlayer } from "@/lib/economy.functions";
import { redeemZoneVoucher } from "@/lib/zone-pay.functions";

function customPrice(meters: number) {
  const size = Math.min(1000, Math.max(50, Math.round(meters)));
  return Math.round(30000 * Math.pow(size / 500, 2));
}

export function ZonePaySheet() {
  const [spot, setSpot] = useState<{ x: number; z: number } | null>(null);
  const [custom, setCustom] = useState(700);
  const [voucher, setVoucher] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const read = () => {
      const text = document.body.textContent ?? "";
      if (!text.includes("Placed")) return;
      const match = text.match(/X\s+(\d+)\s*·\s*Z\s+(\d+)/);
      if (!match) return;
      const next = { x: Number(match[1]), z: Number(match[2]) };
      setSpot((current) => (current?.x === next.x && current?.z === next.z ? current : next));
    };
    const timer = window.setInterval(read, 400);
    return () => window.clearInterval(timer);
  }, []);

  const pay = async (meters: number, price: number) => {
    if (!spot) return;
    setBusy(true);
    try {
      await payPlayer({ data: { toPlayerId: "zone-radar", amount: price, note: `Zone ${meters}m at ${spot.x},${spot.z}` } });
      window.localStorage.setItem("asylumhub:zone-square", JSON.stringify({ x: spot.x, z: spot.z, meters, price, at: new Date().toISOString() }));
      toast.success(`Zone locked. ${meters}m · ${price.toLocaleString()} cr / month`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not pay");
    } finally {
      setBusy(false);
    }
  };

  const useVoucher = async () => {
    if (!spot) return;
    if (!voucher.trim()) return toast.error("Enter a voucher code");
    setBusy(true);
    try {
      await redeemZoneVoucher({ data: { code: voucher, meters: custom, x: spot.x, z: spot.z, map: "livonia" } });
      window.localStorage.setItem("asylumhub:zone-square", JSON.stringify({ x: spot.x, z: spot.z, meters: custom, voucher: voucher.trim(), at: new Date().toISOString() }));
      toast.success("Voucher accepted. Zone locked.");
      setVoucher("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Voucher not valid");
    } finally {
      setBusy(false);
    }
  };

  if (!spot) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-[90] w-[min(440px,calc(100%-2rem))] -translate-x-1/2 rounded-2xl border border-[#d4a84b]/50 bg-black/92 p-4 text-white shadow-2xl">
      <div className="font-mono text-sm text-[#e8c56a]">X {spot.x} · Z {spot.z}</div>
      <div className="mt-1 text-xs uppercase tracking-[0.16em] text-zinc-400">Choose the zone, then pay</div>
      <div className="mt-3 grid gap-2">
        <button type="button" disabled={busy} onClick={() => pay(150, 7000)} className="flex items-center justify-between rounded-xl border border-white/10 px-3 py-2 text-sm hover:border-[#d4a84b]/50"><span>150m</span><span className="font-mono text-[#e8c56a]">7,000 cr / month</span></button>
        <button type="button" disabled={busy} onClick={() => pay(300, 16000)} className="flex items-center justify-between rounded-xl border border-white/10 px-3 py-2 text-sm hover:border-[#d4a84b]/50"><span>300m</span><span className="font-mono text-[#e8c56a]">16,000 cr / month</span></button>
        <button type="button" disabled={busy} onClick={() => pay(500, 30000)} className="flex items-center justify-between rounded-xl border border-white/10 px-3 py-2 text-sm hover:border-[#d4a84b]/50"><span>500m</span><span className="font-mono text-[#e8c56a]">30,000 cr / month</span></button>
        <label className="rounded-xl border border-white/10 px-3 py-2 text-sm">
          Custom, max 1000m
          <input type="range" min={50} max={1000} value={custom} onChange={(event) => setCustom(Number(event.target.value))} className="mt-2 w-full" />
          <div className="mt-1 flex items-center justify-between font-mono text-[#e8c56a]"><span>{custom}m</span><span>{customPrice(custom).toLocaleString()} cr / month</span></div>
          <button type="button" disabled={busy} onClick={() => pay(custom, customPrice(custom))} className="mt-2 w-full rounded-full bg-[#d4a84b] py-2 text-sm font-semibold text-black">Pay with credits</button>
        </label>
        <div className="flex gap-2">
          <input value={voucher} onChange={(event) => setVoucher(event.target.value)} placeholder="Voucher code" className="h-10 min-w-0 flex-1 rounded-lg border border-white/10 bg-black px-3 text-sm" />
          <button type="button" disabled={busy} onClick={useVoucher} className="rounded-lg border border-[#d4a84b]/40 px-3 text-xs uppercase tracking-[0.14em] text-[#e8c56a]">Use voucher</button>
        </div>
      </div>
    </div>
  );
}
