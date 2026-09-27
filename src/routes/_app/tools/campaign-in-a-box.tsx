import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { MapContainer, Marker, Rectangle, TileLayer, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { toast } from "sonner";
import { GlassPanel } from "@/components/ui-custom/GlassPanel";
import { IconCampaign, IconChevronLeft } from "@/components/ui-custom/CustomIcon";
import { PageHexBadge } from "@/components/app/PageHexBadge";
import { BRAND } from "@/lib/brand";
import { useAuth } from "@/contexts/AuthContext";
import { claimZoneRadar } from "@/lib/zone-radar.functions";
import "leaflet/dist/leaflet.css";

export const Route = createFileRoute("/_app/tools/campaign-in-a-box")({
  component: () => <CampaignInABoxContent />,
  head: () => ({ meta: [{ title: `Base Ops — ${BRAND.name}` }] }),
});

const TILE = 256;
const MAPS = {
  livonia: { world: 12800, tiles: "https://static.xam.nu/dayz/maps/livonia/1.27/satellite/{z}/{x}/{y}.webp" },
  chernarus: { world: 15360, tiles: "https://static.xam.nu/dayz/maps/chernarusplus/1.27/satellite/{z}/{x}/{y}.webp" },
} as const;
const markerIcon = L.divIcon({
  className: "",
  html: '<div style="width:14px;height:14px;border-radius:9999px;background:#f59e0b;border:2px solid white;box-shadow:0 0 10px #f59e0b"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

function toMap(x: number, z: number, world: number): [number, number] {
  return [(z / world) * TILE - TILE, (x / world) * TILE];
}

function Clicks({ world, onPick }: { world: number; onPick: (x: number, z: number, lat: number, lng: number) => void }) {
  useMapEvents({
    click(event) {
      const x = Math.min(world, Math.max(0, Math.round((event.latlng.lng / TILE) * world)));
      const z = Math.min(world, Math.max(0, Math.round(((event.latlng.lat + TILE) / TILE) * world)));
      onPick(x, z, event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

export function CampaignInABoxContent({ hideHeader = false }: { hideHeader?: boolean } = {}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const playerId = user?.id || "";
  const [activePanel, setActivePanel] = useState<"base" | "radar" | null>(null);
  const [radarRange, setRadarRange] = useState("500m");
  const [manualMap, setManualMap] = useState<keyof typeof MAPS>("livonia");
  const [picked, setPicked] = useState<{ x: number; z: number; lat: number; lng: number } | null>(null);
  const spec = MAPS[manualMap];
  const meters = Number(radarRange.replace(/\D/g, "")) || 500;
  const claimMut = useMutation({
    mutationFn: () => {
      if (!picked) throw new Error("Click the map first");
      return claimZoneRadar({ data: { playerId, baseCode: `pin-${picked.x}-${picked.z}`, range: radarRange, confirmed: true, x: picked.x, z: picked.z, map: manualMap } });
    },
    onSuccess: () => toast.success(`Zone locked at ${picked?.x}, ${picked?.z}`),
    onError: (err) => toast.error(err instanceof Error ? err.message : "Claim failed"),
  });

  useEffect(() => {
    setPicked(null);
  }, [manualMap]);

  return (
    <div className="space-y-8">
      {!hideHeader && (
        <Link to="/tools" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <IconChevronLeft size={14} /> Back to tools
        </Link>
      )}
      {!hideHeader && (
        <header className="flex items-start gap-4">
          <PageHexBadge hue={150} icon={<IconCampaign size={26} />} aria-label="Base Ops" />
          <div><h1 className="font-display text-3xl md:text-4xl">Base Ops</h1></div>
        </header>
      )}
      {!activePanel && (
        <div className="grid gap-4 md:grid-cols-2">
          <button type="button" onClick={() => navigate({ to: "/tools", search: { focus: "pro-build" } })} className="rounded-2xl border border-primary/40 bg-primary/10 p-6 text-left"><h2 className="font-display text-2xl">Pro Build</h2></button>
          <button type="button" onClick={() => navigate({ to: "/tools", search: { focus: "sleeping-bags" } })} className="rounded-2xl border border-glass-border bg-glass/25 p-6 text-left"><h2 className="font-display text-2xl">Sleeping Bags</h2></button>
          <button type="button" onClick={() => setActivePanel("base")} className="rounded-2xl border border-glass-border bg-glass/25 p-6 text-left"><h2 className="font-display text-2xl">Request custom base</h2></button>
          <button type="button" onClick={() => setActivePanel("radar")} className="rounded-2xl border border-cyan-400/30 bg-cyan-400/5 p-6 text-left">
            <div className="text-xs uppercase tracking-[0.18em] text-cyan-200/70">Base Radar · 5,000 cr</div>
            <h2 className="mt-2 font-display text-2xl">Track your zone</h2>
          </button>
        </div>
      )}
      {activePanel === "radar" && (
        <GlassPanel className="space-y-4 border-cyan-400/30 p-4">
          <button type="button" onClick={() => setActivePanel(null)} className="text-xs text-muted-foreground">← Back to Base Ops</button>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-2xl">Track your zone</h2>
            <div className="flex gap-2">
              <button type="button" onClick={() => setManualMap("livonia")} className={`rounded-full px-4 py-2 text-xs uppercase tracking-[0.16em] ${manualMap === "livonia" ? "bg-[#d4a84b] text-black" : "border border-white/15"}`}>Livonia</button>
              <button type="button" onClick={() => setManualMap("chernarus")} className={`rounded-full px-4 py-2 text-xs uppercase tracking-[0.16em] ${manualMap === "chernarus" ? "bg-[#d4a84b] text-black" : "border border-white/15"}`}>Chernarus</button>
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-black">
            <MapContainer key={manualMap} crs={L.CRS.Simple} center={[-TILE / 2, TILE / 2]} zoom={2} minZoom={0} maxZoom={8} maxBounds={L.latLngBounds([[-TILE, 0], [0, TILE]])} className="h-[72vh] w-full bg-[#11150f]" scrollWheelZoom>
              <TileLayer url={spec.tiles} bounds={L.latLngBounds([[-TILE, 0], [0, TILE]])} minZoom={0} maxNativeZoom={7} maxZoom={8} noWrap />
              <Clicks world={spec.world} onPick={(x, z, lat, lng) => setPicked({ x, z, lat, lng })} />
              {picked ? (
                <Rectangle
                  bounds={[
                    toMap(picked.x - meters, picked.z - meters, spec.world),
                    toMap(picked.x + meters, picked.z + meters, spec.world),
                  ]}
                  pathOptions={{ color: "#38bdf8", weight: 3, fillColor: "#38bdf8", fillOpacity: 0.22 }}
                />
              ) : null}
              {picked ? <Marker position={[picked.lat, picked.lng]} icon={markerIcon} /> : null}
            </MapContainer>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="font-mono text-sm text-[#e8c56a]">{picked ? `X ${picked.x} · Z ${picked.z}` : "Click the live map"}</div>
            <select value={radarRange} onChange={(e) => setRadarRange(e.target.value)} className="h-11 rounded-lg border border-glass-border bg-black/40 px-3 text-sm">
              <option>250m</option><option>500m</option><option>750m</option><option>1000m</option>
            </select>
            <button type="button" disabled={!picked || claimMut.isPending} onClick={() => claimMut.mutate()} className="rounded-full bg-[#d4a84b] px-5 py-2 text-sm font-semibold text-black disabled:opacity-40">Lock zone</button>
          </div>
        </GlassPanel>
      )}
    </div>
  );
}
