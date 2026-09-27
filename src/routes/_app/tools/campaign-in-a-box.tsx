import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { GlassPanel } from "@/components/ui-custom/GlassPanel";
import { IconCampaign, IconChevronLeft } from "@/components/ui-custom/CustomIcon";
import { PageHexBadge } from "@/components/app/PageHexBadge";
import { BRAND } from "@/lib/brand";
import { useAuth } from "@/contexts/AuthContext";
import { claimZoneRadar, detectPlayerZone } from "@/lib/zone-radar.functions";

export const Route = createFileRoute("/_app/tools/campaign-in-a-box")({
  component: () => <CampaignInABoxContent />,
  head: () => ({ meta: [{ title: `Base Ops — ${BRAND.name}` }] }),
});

const WORLD = { livonia: 12800, chernarus: 15360 } as const;
const SAT = {
  livonia: "https://static.xam.nu/dayz/maps/livonia/1.27/satellite/0/0/0.webp",
  chernarus: "https://static.xam.nu/dayz/maps/chernarusplus/1.27/satellite/0/0/0.webp",
} as const;

function FlagMap({ x, z, map, onPick }: { x?: number; z?: number; map: "livonia" | "chernarus"; onPick?: (x: number, z: number) => void }) {
  const size = WORLD[map];
  const left = x == null ? null : Math.min(96, Math.max(4, (x / size) * 100));
  const top = z == null ? null : Math.min(96, Math.max(4, (z / size) * 100));
  return (
    <button
      type="button"
      className="relative block w-full overflow-hidden rounded-2xl border border-[#d4a84b]/40 bg-black text-left"
      onClick={(event) => {
        if (!onPick) return;
        const rect = event.currentTarget.getBoundingClientRect();
        const px = Math.min(size, Math.max(0, Math.round(((event.clientX - rect.left) / rect.width) * size)));
        const pz = Math.min(size, Math.max(0, Math.round(((event.clientY - rect.top) / rect.height) * size)));
        onPick(px, pz);
      }}
    >
      <img src={SAT[map]} alt={`${map} map`} className="aspect-square w-full object-cover opacity-90" />
      {left != null && top != null ? (
        <div className="absolute" style={{ left: `${left}%`, top: `${top}%`, transform: "translate(-50%, -50%)" }}>
          <div className="size-4 animate-ping rounded-full bg-[#d4a84b]/70" />
          <div className="absolute left-1/2 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#d4a84b] shadow-[0_0_16px_#d4a84b]" />
        </div>
      ) : null}
      <div className="absolute bottom-3 left-3 rounded-lg border border-[#d4a84b]/40 bg-black/70 px-3 py-1.5 font-mono text-xs text-[#e8c56a]">
        {x == null || z == null ? `Click the ${map} map` : `${map.toUpperCase()} · X ${x} · Z ${z}`}
      </div>
    </button>
  );
}

export function CampaignInABoxContent({ hideHeader = false }: { hideHeader?: boolean } = {}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const playerId = user?.id || "";
  const [activePanel, setActivePanel] = useState<"base" | "radar" | null>(null);
  const [radarRange, setRadarRange] = useState("500m");
  const [localPsn, setLocalPsn] = useState("");
  const [manualMap, setManualMap] = useState<"livonia" | "chernarus">("livonia");
  const [manualX, setManualX] = useState("");
  const [manualZ, setManualZ] = useState("");
  useEffect(() => {
    setLocalPsn(window.localStorage.getItem("asylumhub:psn-name") || "");
  }, [activePanel]);
  const zoneQ = useQuery({
    queryKey: ["detect-zone-v6", playerId, localPsn],
    queryFn: () => detectPlayerZone({ data: { playerId, psnName: localPsn || undefined } }),
    enabled: activePanel === "radar" && Boolean(playerId),
  });
  const pin = zoneQ.data?.prompt;
  const psn = zoneQ.data?.psnName || localPsn;
  const typedX = Number(manualX);
  const typedZ = Number(manualZ);
  const manual = Number.isFinite(typedX) && Number.isFinite(typedZ) && typedX > 0 && typedZ > 0
    ? { x: Math.round(typedX), z: Math.round(typedZ), map: manualMap, name: "Clicked base", reason: "Set on the map." }
    : null;
  const chosen = manual ?? pin;
  const claimMut = useMutation({
    mutationFn: (coords: { x: number; z: number; map: "livonia" | "chernarus"; code?: string }) =>
      claimZoneRadar({ data: { playerId, baseCode: coords.code || `pin-${coords.x}-${coords.z}`, range: radarRange, confirmed: true, x: coords.x, z: coords.z, map: coords.map } }),
    onSuccess: (_res, coords) => toast.success(`Zone radar locked at ${coords.x}, ${coords.z}`),
    onError: (err) => toast.error(err instanceof Error ? err.message : "Claim failed"),
  });
  const pick = (x: number, z: number) => {
    setManualX(String(x));
    setManualZ(String(z));
  };

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
        <GlassPanel className="space-y-5 border-cyan-400/30 p-6">
          <button type="button" onClick={() => setActivePanel(null)} className="text-xs text-muted-foreground">← Back to Base Ops</button>
          <h2 className="font-display text-2xl">Track your zone</h2>
          <div className="text-xs uppercase tracking-[0.16em] text-[#d4a84b]">Linked PSN · {psn || (zoneQ.isLoading ? "loading…" : "none")}</div>
          {zoneQ.data ? (
            <>
              <div className="font-mono text-xs text-zinc-500">
                files {zoneQ.data.filesScanned ?? 0} · flags {zoneQ.data.flagsFound} · builds {zoneQ.data.buildsFound} · pins {zoneQ.data.positionsFound}
              </div>
              {zoneQ.data.note ? <div className="text-xs text-zinc-500">{zoneQ.data.note}</div> : null}
            </>
          ) : null}
          <div className="flex gap-2">
            <button type="button" onClick={() => setManualMap("livonia")} className={`rounded-full px-4 py-2 text-xs uppercase tracking-[0.16em] ${manualMap === "livonia" ? "bg-[#d4a84b] text-black" : "border border-white/15"}`}>Livonia</button>
            <button type="button" onClick={() => setManualMap("chernarus")} className={`rounded-full px-4 py-2 text-xs uppercase tracking-[0.16em] ${manualMap === "chernarus" ? "bg-[#d4a84b] text-black" : "border border-white/15"}`}>Chernarus</button>
          </div>
          <FlagMap x={chosen?.x} z={chosen?.z} map={manual?.map || pin?.map || manualMap} onPick={pick} />
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">X
              <input value={manualX} onChange={(e) => setManualX(e.target.value)} inputMode="numeric" placeholder="6920" className="mt-1 h-11 w-full rounded-lg border border-glass-border bg-black/40 px-3 font-mono text-sm" />
            </label>
            <label className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Z
              <input value={manualZ} onChange={(e) => setManualZ(e.target.value)} inputMode="numeric" placeholder="11467" className="mt-1 h-11 w-full rounded-lg border border-glass-border bg-black/40 px-3 font-mono text-sm" />
            </label>
          </div>
          <p className="text-xs text-zinc-500">Click the map or type coords. That pin is what gets locked.</p>
          {chosen ? (
            <div className="rounded-xl border border-[#d4a84b]/40 bg-[#d4a84b]/10 p-4">
              <div className="font-display text-2xl text-[#e8c56a]">{chosen.name}</div>
              <div className="font-mono text-sm text-[#f5e6c0]">X {chosen.x} · Z {chosen.z} · {chosen.map}</div>
              <div className="mt-2 text-sm text-zinc-400">{chosen.reason}</div>
              <button type="button" onClick={() => chosen && claimMut.mutate({ x: chosen.x, z: chosen.z, map: chosen.map, code: (chosen as { code?: string }).code })} className="mt-4 rounded-full bg-[#d4a84b] px-5 py-2 text-sm font-semibold text-black">Lock this pin · {radarRange}</button>
            </div>
          ) : zoneQ.isLoading ? (
            <div className="text-sm text-zinc-500">Reading server ADM/RPT… you can still click the map.</div>
          ) : (
            <div className="rounded-xl border border-dashed border-glass-border p-5 text-sm text-muted-foreground">No ADM pin yet. Click the map or enter X/Z.</div>
          )}
          <select value={radarRange} onChange={(e) => setRadarRange(e.target.value)} className="h-11 w-full rounded-lg border border-glass-border bg-black/40 px-3 text-sm">
            <option>250m</option><option>500m</option><option>750m</option><option>1000m</option>
          </select>
        </GlassPanel>
      )}
    </div>
  );
}
