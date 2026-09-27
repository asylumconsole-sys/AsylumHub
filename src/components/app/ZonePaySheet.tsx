import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { payZoneWithCredits, redeemZoneVoucher } from "@/lib/zone-pay.functions";

function zonePrice(meters: number) {
  const size = Math.min(1000, Math.max(50, Math.round(meters)));
  const stops: Array<[number, number]> = [[150, 7000], [300, 16000], [500, 30000], [1000, 120000]];
  if (size <= 150) return Math.round(7000 * (size / 150));
  for (let i = 1; i < stops.length; i += 1) {
    const [a, priceA] = stops[i - 1];
    const [b, priceB] = stops[i];
    if (size <= b) return Math.round(priceA + ((size - a) / (b - a)) * (priceB - priceA));
  }
  return 120000;
}

function money(amount: number) {
  return `${amount.toLocaleString("en-US")} cr / month`;
}

export function ZonePaySheet() {
  const { session } = useAuth();
  const [spot, setSpot] = useState<{ x: number; z: number } | null>(null);
  const [custom, setCustom] = useState(300);
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

  const pay = async (meters: number) => {
    if (!spot) return;
    const token = session?.access_token;
    if (!token) return toast.error("Sign in with Discord first");
    const price = zonePrice(meters);
    setBusy(true);
    try {
      const result = await payZoneWithCredits({ data: { accessToken: token, meters, price, x: spot.x, z: spot.z } });
      window.localStorage.setItem("asylumhub:zone-square", JSON.stringify({ x: spot.x, z: spot.z, meters, price, at: new Date().toISOString() }));
      toast.success(`Zone locked. ${meters}m · ${money(price)}. Balance ${result.credits.toLocaleString("en-US")} cr`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not pay");
    } finally {
      setBusy(false);
    }
  };

  const useVoucher = async () => {
    if (!spot) return;
    const token = session?.access_token;
    if (!token) return toast.error("Sign in with Discord first");
    if (!voucher.trim()) return toast.error("Enter a voucher code");
    setBusy(true);
    try {
      await redeemZoneVoucher({ data: { accessToken: token, code: voucher, meters: custom, x: spot.x, z: spot.z, map: "livonia" } });
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
        <button type="button" disabled={busy} onClick={() => pay(150)} className="flex items-center justify-between rounded-xl border border-white/10 px-3 py-2 text-sm hover:border-[#d4a84b]/50"><span>150m</span><span className="font-mono text-[#e8c56a]">{money(zonePrice(150))}</span></button>
        <button type="button" disabled={busy} onClick={() => pay(300)} className="flex items-center justify-between rounded-xl border border-white/10 px-3 py-2 text-sm hover:border-[#d4a84b]/50"><span>300m</span><span className="font-mono text-[#e8c56a]">{money(zonePrice(300))}</span></button>
        <button type="button" disabled={busy} onClick={() => pay(500)} className="flex items-center justify-between rounded-xl border border-white/10 px-3 py-2 text-sm hover:border-[#d4a84b]/50"><span>500m</span><span className="font-mono text-[#e8c56a]">{money(zonePrice(500))}</span></button>
        <label className="rounded-xl border border-white/10 px-3 py-2 text-sm">
          Custom, max 1000m
          <input type="range" min={150} max={1000} value={custom} onChange={(event) => setCustom(Number(event.target.value))} className="mt-2 w-full" />
          <div className="mt-1 flex items-center justify-between font-mono text-[#e8c56a]"><span>{custom}m</span><span>{money(zonePrice(custom))}</span></div>
          <button type="button" disabled={busy} onClick={() => pay(custom)} className="mt-2 w-full rounded-full bg-[#d4a84b] py-2 text-sm font-semibold text-black">Pay with credits</button>
        </label>
        <div className="flex gap-2">
          <input value={voucher} onChange={(event) => setVoucher(event.target.value)} placeholder="Voucher code" className="h-10 min-w-0 flex-1 rounded-lg border border-white/10 bg-black px-3 text-sm" />
          <button type="button" disabled={busy} onClick={useVoucher} className="rounded-lg border border-[#d4a84b]/40 px-3 text-xs uppercase tracking-[0.14em] text-[#e8c56a]">Use voucher</button>
        </div>
      </div>
    </div>
  );
}
