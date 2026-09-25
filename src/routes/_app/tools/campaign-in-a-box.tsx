import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
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

function linkedPsn() {
  if (typeof window === "undefined") return "";
  return (
    window.localStorage.getItem("asylumhub:psn-name") ||
    window.localStorage.getItem("asylumhub:psn-id") ||
    ""
  ).trim();
}

function FlagMap({ x, z, map }: { x: number; z: number; map: "livonia" | "chernarus" }) {
  const size = WORLD[map];
  const left = Math.min(96, Math.max(4, (x / size) * 100));
  const top = Math.min(96, Math.max(4, (z / size) * 100));
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#d4a84b]/40 bg-black">
      <img src={SAT[map]} alt={`${map} map`} className="aspect-square w-full object-cover opacity-90" />
      <div className="absolute" style={{ left: `${left}%`, top: `${top}%`, transform: "translate(-50%, -50%)" }}>
        <div className="size-4 animate-ping rounded-full bg-[#d4a84b]/70" />
        <div className="absolute left-1/2 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#d4a84b] shadow-[0_0_16px_#d4a84b]" />
      </div>
      <div className="absolute bottom-3 left-3 rounded-lg border border-[#d4a84b]/40 bg-black/70 px-3 py-1.5 font-mono text-xs text-[#e8c56a]">
        {map.toUpperCase()} · X {x} · Z {z}
      </div>
    </div>
  );
}

export function CampaignInABoxContent({ hideHeader = false }: { hideHeader?: boolean } = {}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const playerId = user?.id || "demo-user";
  const [activePanel, setActivePanel] = useState<"base" | "radar" | null>(null);
  const [radarRange, setRadarRange] = useState("500m");
  const psn = linkedPsn();

  const zoneQ = useQuery({
    queryKey: ["detect-zone", playerId, psn],
    queryFn: () => detectPlayerZone({ data: { playerId, psnName: psn } }),
    enabled: activePanel === "radar",
  });

  const pin = zoneQ.data?.prompt;

  const claimMut = useMutation({
    mutationFn: () =>
      claimZoneRadar({
        data: {
          playerId,
          baseCode: pin?.code || "",
          range: radarRange,
          confirmed: true,
          factionName: pin?.faction,
          x: pin?.x,
          z: pin?.z,
          map: pin?.map,
        },
      }),
    onSuccess: () => toast.success(`Zone radar locked on ${pin?.name}`),
    onError: (err) => toast.error(err instanceof Error ? err.message : "Claim failed"),
  });

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
          <div>
            <h1 className="font-display text-3xl md:text-4xl">Base Ops</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">Last flag pole + build cluster from your linked PSN logs.</p>
          </div>
        </header>
      )}
      {!activePanel && (
        <div className="grid gap-4 md:grid-cols-2">
          <button type="button" onClick={() => navigate({ to: "/tools", search: { focus: "pro-build" } })} className="rounded-2xl border border-primary/40 bg-primary/10 p-6 text-left">
            <h2 className="font-display text-2xl">Pro Build</h2>
          </button>
          <button type="button" onClick={() => navigate({ to: "/tools", search: { focus: "sleeping-bags" } })} className="rounded-2xl border border-glass-border bg-glass/25 p-6 text-left">
            <h2 className="font-display text-2xl">Sleeping Bags</h2>
          </button>
          <button type="button" onClick={() => setActivePanel("base")} className="rounded-2xl border border-glass-border bg-glass/25 p-6 text-left">
            <h2 className="font-display text-2xl">Request custom base</h2>
          </button>
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
          <div className="text-xs uppercase tracking-[0.16em] text-[#d4a84b]">Linked PSN · {psn || "not stored on this device"}</div>
          {zoneQ.isLoading ? <div className="text-sm text-zinc-500">Reading ADM flag + build lines…</div> : null}
          {zoneQ.data ? (
            <div className="font-mono text-xs text-zinc-500">
              flags {zoneQ.data.flagsFound} · builds {zoneQ.data.buildsFound} · cluster {zoneQ.data.clusterNearLastFlag}
            </div>
          ) : null}
          {pin ? (
            <>
              <FlagMap x={pin.x} z={pin.z} map={pin.map} />
              <div className="rounded-xl border border-[#d4a84b]/40 bg-[#d4a84b]/10 p-4">
                <div className="text-[10px] uppercase tracking-[0.2em] text-[#d4a84b]">High confidence · flag + cluster</div>
                <div className="mt-1 font-display text-2xl text-[#e8c56a]">{pin.name}</div>
                <div className="font-mono text-sm text-[#f5e6c0]">X {pin.x} · Z {pin.z} · {pin.map}</div>
                <div className="mt-2 text-sm text-zinc-400">{pin.reason}</div>
                <div className="mt-4 font-display text-xl text-[#e8c56a]">Is this your base?</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => claimMut.mutate()} className="rounded-full bg-[#d4a84b] px-5 py-2 text-sm font-semibold text-black">Yes · lock radar {radarRange}</button>
                  <button type="button" onClick={() => toast.message("Ignored")} className="rounded-full border border-white/15 px-5 py-2 text-sm">No</button>
                </div>
              </div>
            </>
          ) : !zoneQ.isLoading ? (
            <div className="rounded-xl border border-dashed border-glass-border p-5 text-sm text-muted-foreground">
              {!psn
                ? "No PSN name saved on this browser. Link PSN on the account page, then reopen Track your zone."
                : "Logs for this PSN did not have a last flag pole with 8+ nearby builds (and coords). We only ask when that match is sure."}
            </div>
          ) : null}
          <select value={radarRange} onChange={(e) => setRadarRange(e.target.value)} className="h-11 w-full rounded-lg border border-glass-border bg-black/40 px-3 text-sm">
            <option>250m</option><option>500m</option><option>750m</option><option>1000m</option>
          </select>
        </GlassPanel>
      )}
      {activePanel === "base" && (
        <button type="button" onClick={() => setActivePanel(null)} className="text-xs text-muted-foreground">← Back</button>
      )}
    </div>
  );
}
