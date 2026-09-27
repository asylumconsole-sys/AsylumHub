import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CircleMarker, MapContainer, Tooltip, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { payPlayer } from "@/lib/economy.functions";
import "leaflet/dist/leaflet.css";

export const Route = createFileRoute("/_app/tools/zone-pick")({
  component: ZonePickPage,
});

const TILE = 256;
const MAPS = {
  livonia: { label: "Livonia", world: 12800, tiles: "https://static.xam.nu/dayz/maps/livonia/1.27/satellite/{z}/{x}/{y}.webp", poi: "https://static.xam.nu/dayz/json/livonia/1.29-7.json" },
  chernarus: { label: "Chernarus", world: 15360, tiles: "https://static.xam.nu/dayz/maps/chernarusplus/1.27/satellite/{z}/{x}/{y}.webp", poi: "https://static.xam.nu/dayz/json/chernarusplus/1.29-7.json" },
} as const;
const PLANS = [
  { meters: 150, price: 7000 },
  { meters: 300, price: 16000 },
  { meters: 500, price: 30000 },
] as const;

function customPrice(meters: number) {
  const size = Math.min(1000, Math.max(50, Math.round(meters)));
  return Math.round(30000 * Math.pow(size / 500, 2));
}

type Town = { id: string; name: string; position: [number, number] };

function Focus({ target }: { target: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (!target) return;
    map.flyTo(target, Math.max(map.getZoom(), 5), { duration: 0.6 });
  }, [map, target]);
  return null;
}

function Clicks({ world, onPick }: { world: number; onPick: (x: number, z: number) => void }) {
  useMapEvents({
    click(event) {
      const x = Math.min(world, Math.max(0, Math.round((event.latlng.lng / TILE) * world)));
      const z = Math.min(world, Math.max(0, Math.round(((event.latlng.lat + TILE) / TILE) * world)));
      onPick(x, z);
    },
  });
  return null;
}

function ZonePickPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mapId, setMapId] = useState<keyof typeof MAPS>("livonia");
  const [search, setSearch] = useState("");
  const [focus, setFocus] = useState<[number, number] | null>(null);
  const [spot, setSpot] = useState<{ x: number; z: number } | null>(null);
  const [step, setStep] = useState<"confirm" | "size" | null>(null);
  const [custom, setCustom] = useState(700);
  const [busy, setBusy] = useState(false);
  const spec = MAPS[mapId];
  const poiQ = useQuery({
    queryKey: ["zone-pick-towns", mapId],
    queryFn: async () => {
      const response = await fetch(spec.poi);
      if (!response.ok) throw new Error("Town list unavailable");
      return response.json() as Promise<{ markers?: { locations?: Array<{ w?: string; p?: [number, number]; s?: string[] }> } }>;
    },
    staleTime: 24 * 60 * 60 * 1000,
  });
  const towns = useMemo<Town[]>(() => (poiQ.data?.markers?.locations ?? [])
    .filter((location) => (location.w === "city" || location.w === "village") && Array.isArray(location.p) && location.s?.[0])
    .map((location, index) => ({ id: `${location.s?.[0]}-${index}`, name: location.s?.[0] ?? "Town", position: location.p as [number, number] })), [poiQ.data]);
  const results = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return [];
    return towns.filter((town) => town.name.toLowerCase().includes(term)).slice(0, 6);
  }, [search, towns]);

  const lock = async (meters: number, price: number) => {
    if (!spot) return;
    setBusy(true);
    try {
      await payPlayer({ data: { toPlayerId: "zone-radar", amount: price, note: `Zone ${meters}m at ${spot.x},${spot.z}` } });
      window.localStorage.setItem("asylumhub:zone-square", JSON.stringify({ map: mapId, x: spot.x, z: spot.z, meters, price, ownerId: user?.id || "", at: new Date().toISOString() }));
      toast.success("Zone locked. The blue square is on the map page.");
      navigate({ to: "/tools/base-map-clicker" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not lock the zone");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black">
      <MapContainer key={mapId} crs={L.CRS.Simple} center={[-TILE / 2, TILE / 2]} zoom={2} minZoom={0} maxZoom={8} maxBounds={L.latLngBounds([[-TILE, 0], [0, TILE]])} className="h-screen w-screen bg-[#11150f]" scrollWheelZoom>
        <TileLayer url={spec.tiles} bounds={L.latLngBounds([[-TILE, 0], [0, TILE]])} minZoom={0} maxNativeZoom={7} maxZoom={8} noWrap />
        <Clicks world={spec.world} onPick={(x, z) => { setSpot({ x, z }); setStep("confirm"); }} />
        <Focus target={focus} />
        {towns.map((town) => (
          <CircleMarker key={town.id} center={town.position} radius={2} pathOptions={{ color: "#f5e6bd", fillColor: "#11130f", fillOpacity: 0.9, weight: 1 }}>
            <Tooltip permanent direction="top" offset={[0, -2]}>{town.name}</Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>
      <div className="absolute left-4 right-4 top-4 z-[1000] mx-auto max-w-md">
        <div className="mb-2 flex gap-2">
          <button type="button" onClick={() => setMapId("livonia")} className={`rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.16em] ${mapId === "livonia" ? "bg-[#d4a84b] text-black" : "bg-black/70 text-white"}`}>Livonia</button>
          <button type="button" onClick={() => setMapId("chernarus")} className={`rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.16em] ${mapId === "chernarus" ? "bg-[#d4a84b] text-black" : "bg-black/70 text-white"}`}>Chernarus</button>
        </div>
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${spec.label} towns`} className="h-12 w-full rounded-xl border border-white/15 bg-black/80 px-4 text-sm text-white outline-none" />
        {results.length > 0 && (
          <div className="mt-2 overflow-hidden rounded-xl border border-white/15 bg-black/90">
            {results.map((town) => (
              <button key={town.id} type="button" onClick={() => { setFocus(town.position); setSearch(town.name); }} className="block w-full px-4 py-2 text-left text-sm hover:bg-white/10">{town.name}</button>
            ))}
          </div>
        )}
      </div>
      {step === "confirm" && spot && (
        <div className="absolute inset-0 z-[1100] grid place-items-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#d4a84b]/40 bg-black p-5">
            <div className="font-display text-2xl text-[#e8c56a]">Confirm this spot?</div>
            <div className="mt-2 font-mono text-sm">X {spot.x} · Z {spot.z} · {spec.label}</div>
            <p className="mt-3 text-sm text-zinc-400">After you pick the size, this pin shows as a blue square on the map page, with search, towns, cars, and the rest of the map tools.</p>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setStep("size")} className="rounded-full bg-[#d4a84b] px-4 py-2 text-sm font-semibold text-black">Yes, this spot</button>
              <button type="button" onClick={() => setStep(null)} className="rounded-full border border-white/15 px-4 py-2 text-sm">No</button>
            </div>
          </div>
        </div>
      )}
      {step === "size" && spot && (
        <div className="absolute inset-0 z-[1100] grid place-items-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#d4a84b]/40 bg-black p-5">
            <div className="font-display text-2xl">Zone size</div>
            <p className="mt-2 text-sm text-zinc-400">Monthly. The blue square is drawn on the map page.</p>
            <div className="mt-4 grid gap-2">
              {PLANS.map((plan) => (
                <button key={plan.meters} type="button" disabled={busy} onClick={() => lock(plan.meters, plan.price)} className="flex items-center justify-between rounded-xl border border-white/10 px-4 py-3 text-left hover:border-[#d4a84b]/50">
                  <span>{plan.meters}m</span><span className="font-mono text-[#e8c56a]">{plan.price.toLocaleString()} cr / month</span>
                </button>
              ))}
              <label className="rounded-xl border border-white/10 px-4 py-3 text-sm">
                Custom, max 1000m
                <input type="range" min={50} max={1000} value={custom} onChange={(event) => setCustom(Number(event.target.value))} className="mt-2 w-full" />
                <div className="mt-1 flex items-center justify-between font-mono text-[#e8c56a]"><span>{custom}m</span><span>{customPrice(custom).toLocaleString()} cr / month</span></div>
                <button type="button" disabled={busy} onClick={() => lock(custom, customPrice(custom))} className="mt-3 w-full rounded-full bg-[#d4a84b] py-2 text-sm font-semibold text-black">Lock custom zone</button>
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
