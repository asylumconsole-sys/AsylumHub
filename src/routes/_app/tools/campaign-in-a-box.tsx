import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { GlassPanel } from "@/components/ui-custom/GlassPanel";
import { IconCampaign, IconChevronLeft } from "@/components/ui-custom/CustomIcon";
import { PageHexBadge } from "@/components/app/PageHexBadge";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/_app/tools/campaign-in-a-box")({
  component: () => <CampaignInABoxContent />,
  head: () => ({ meta: [{ title: `Base Ops — ${BRAND.name}` }] }),
});

const BASE_MAPS = {
  livonia: { label: "Livonia 101x", path: "livonia" },
  chernarus: { label: "Chernarus 102x", path: "chernarusplus" },
} as const;

const BASE_SIZES = [
  { id: "small", label: "Small base", price: 25_000, detail: "Compact shelter, storage, and one defensive position." },
  { id: "medium", label: "Medium base", price: 35_000, detail: "Expanded compound, storage wing, and two defensive positions." },
  { id: "large", label: "Large base", price: 55_000, detail: "Full compound, vehicle bay, storage wing, and perimeter defenses." },
] as const;

const BASE_EXTRAS = ["Water well", "Greenhouse", "Locked container"] as const;
const BASE_REQUESTS_KEY = "asylumhub:base-requests";
type BaseRequest = { id: string; map: keyof typeof BASE_MAPS; location: { x: number; y: number }; size: string; radar: boolean; radarRange: string };

export function CampaignInABoxContent({ hideHeader = false }: { hideHeader?: boolean } = {}) {
  const navigate = useNavigate();
  const [mapKey, setMapKey] = useState<keyof typeof BASE_MAPS>("chernarus");
  const [size, setSize] = useState<(typeof BASE_SIZES)[number]["id"]>("medium");
  const [location, setLocation] = useState<{ x: number; y: number } | null>(null);
  const [extras, setExtras] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [radarRange, setRadarRange] = useState("500m");
  const [ownedBases, setOwnedBases] = useState<BaseRequest[]>([]);
  const [selectedBaseId, setSelectedBaseId] = useState("");
  const [activePanel, setActivePanel] = useState<"base" | "radar" | null>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(BASE_REQUESTS_KEY) ?? "[]") as BaseRequest[];
      setOwnedBases(saved);
      if (saved[0]) setSelectedBaseId(saved[0].id);
    } catch {
      setOwnedBases([]);
    }
  }, []);

  const selectedSize = BASE_SIZES.find((option) => option.id === size) ?? BASE_SIZES[1];
  const totalCost = selectedSize.price + extras.length * 5_000;
  const submitRequest = () => {
    if (!location) return;
    const request: BaseRequest = { id: crypto.randomUUID(), map: mapKey, location, size, radar: false, radarRange };
    const next = [...ownedBases, request];
    window.localStorage.setItem(BASE_REQUESTS_KEY, JSON.stringify(next));
    setOwnedBases(next);
    setSelectedBaseId(request.id);
    setSubmitted(true);
  };
  const toggleExtra = (extra: string) => setExtras((current) => current.includes(extra) ? current.filter((item) => item !== extra) : [...current, extra]);

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
            <p className="mt-2 max-w-2xl text-muted-foreground">Custom bases, Pro Build drops, and sleeping bags.</p>
          </div>
        </header>
      )}

      {submitted ? (
        <GlassPanel className="p-10 text-center">
          <h2 className="font-display text-2xl">Base request submitted</h2>
          <button type="button" onClick={() => setSubmitted(false)} className="mt-6 rounded-lg border border-glass-border px-4 py-2 text-sm">Submit another request</button>
        </GlassPanel>
      ) : (
        <>
          {!activePanel && (
            <div className="grid gap-4 md:grid-cols-2">
              <button type="button" onClick={() => navigate({ to: "/tools", search: { focus: "pro-build" } })} className="rounded-2xl border border-primary/40 bg-primary/10 p-6 text-left transition hover:border-primary/70">
                <div className="text-xs uppercase tracking-[0.18em] text-primary">Base Ops</div>
                <h2 className="mt-2 font-display text-2xl">Pro Build</h2>
                <p className="mt-2 text-sm text-muted-foreground">200k PRO Builder crate dropped on your confirmed base.</p>
              </button>
              <button type="button" onClick={() => navigate({ to: "/tools", search: { focus: "sleeping-bags" } })} className="rounded-2xl border border-glass-border bg-glass/25 p-6 text-left transition hover:border-primary/50">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Base Ops</div>
                <h2 className="mt-2 font-display text-2xl">Sleeping Bags</h2>
                <p className="mt-2 text-sm text-muted-foreground">Set respawn points and recovery kits for your squad.</p>
              </button>
              <button type="button" onClick={() => setActivePanel("base")} className="rounded-2xl border border-glass-border bg-glass/25 p-6 text-left transition hover:border-primary/50">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Base Ops</div>
                <h2 className="mt-2 font-display text-2xl">Request custom base</h2>
                <p className="mt-2 text-sm text-muted-foreground">Choose a map, pin a location, and pick a base size.</p>
              </button>
              <button type="button" onClick={() => setActivePanel("radar")} className="rounded-2xl border border-cyan-400/30 bg-cyan-400/5 p-6 text-left transition hover:border-cyan-300/70">
                <div className="text-xs uppercase tracking-[0.18em] text-cyan-200/70">Base Radar · 5,000 credits</div>
                <h2 className="mt-2 font-display text-2xl">Track your zone</h2>
                <p className="mt-2 text-sm text-muted-foreground">Equip a radar zone on one of your owned bases.</p>
              </button>
            </div>
          )}
          {activePanel === "radar" && (
            <GlassPanel className="space-y-5 border-cyan-400/30 p-6">
              <button type="button" onClick={() => setActivePanel(null)} className="text-xs text-muted-foreground hover:text-foreground">← Back to Base Ops</button>
              <h2 className="font-display text-2xl">Track your zone</h2>
              {ownedBases.length > 0 ? (
                <>
                  <select value={selectedBaseId} onChange={(event) => setSelectedBaseId(event.target.value)} className="h-11 w-full rounded-lg border border-glass-border bg-black/40 px-3 text-sm">
                    {ownedBases.map((base, index) => <option key={base.id} value={base.id}>Base {index + 1} · {BASE_MAPS[base.map].label}</option>)}
                  </select>
                  <select value={radarRange} onChange={(event) => setRadarRange(event.target.value)} className="h-11 w-full rounded-lg border border-glass-border bg-black/40 px-3 text-sm">
                    <option>250m</option><option>500m</option><option>750m</option><option>1000m</option>
                  </select>
                  <button type="button" className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground">Purchase Base Radar · 5,000 credits</button>
                </>
              ) : (
                <div className="rounded-xl border border-dashed border-glass-border p-5 text-sm text-muted-foreground">No owned bases found.</div>
              )}
            </GlassPanel>
          )}
          {activePanel === "base" && (
            <>
              <button type="button" onClick={() => setActivePanel(null)} className="mb-4 text-xs text-muted-foreground hover:text-foreground">← Back to Base Ops</button>
              <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
                <GlassPanel className="overflow-hidden p-0">
                  <div className="border-b border-glass-border px-5 py-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Request custom base</div>
                    <h2 className="mt-1 font-display text-2xl">Choose your location</h2>
                  </div>
                  <div className="flex min-h-[320px] flex-col items-center justify-center bg-black/30 p-8 text-center">
                    <button type="button" onClick={() => window.open("/tools/base-map-clicker", "_blank")} className="rounded-lg border border-glass-border px-4 py-2.5 text-sm">Open map clicker</button>
                  </div>
                </GlassPanel>
                <GlassPanel className="space-y-5 p-5">
                  {BASE_SIZES.map((option) => (
                    <button key={option.id} type="button" onClick={() => setSize(option.id)} className={`w-full rounded-xl border p-3 text-left ${size === option.id ? "border-primary/70 bg-primary/10" : "border-glass-border"}`}>
                      <div className="flex items-center justify-between"><span>{option.label}</span><span className="font-mono text-sm text-primary">{option.price.toLocaleString()} cr</span></div>
                    </button>
                  ))}
                  <div className="grid grid-cols-2 gap-2">{BASE_EXTRAS.map((extra) => <button key={extra} type="button" onClick={() => toggleExtra(extra)} className={`rounded-lg border px-2 py-2 text-xs ${extras.includes(extra) ? "border-primary/60 bg-primary/10 text-primary" : "border-glass-border"}`}>{extra}</button>)}</div>
                  <button type="button" disabled={!location} onClick={submitRequest} className="w-full rounded-lg bg-primary px-4 py-3 text-sm text-primary-foreground disabled:opacity-40">Request custom base · {totalCost.toLocaleString()} cr</button>
                </GlassPanel>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
