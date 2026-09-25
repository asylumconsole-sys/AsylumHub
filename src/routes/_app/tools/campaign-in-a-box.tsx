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
const FACTION_PROFILE_KEY = "asylumhub:faction-profile";
type BaseRequest = { id: string; map: keyof typeof BASE_MAPS; location: { x: number; y: number }; size: string; radar: boolean; radarRange: string };

export function CampaignInABoxContent({ hideHeader = false }: { hideHeader?: boolean } = {}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const playerId = user?.id || "";
  const [mapKey, setMapKey] = useState<keyof typeof BASE_MAPS>("chernarus");
  const [size, setSize] = useState<(typeof BASE_SIZES)[number]["id"]>("medium");
  const [location, setLocation] = useState<{ x: number; y: number } | null>(null);
  const [extras, setExtras] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [radarRange, setRadarRange] = useState("500m");
  const [ownedBases, setOwnedBases] = useState<BaseRequest[]>([]);
  const [activePanel, setActivePanel] = useState<"base" | "radar" | null>(null);
  const [pickedFaction, setPickedFaction] = useState("");
  const [pickedBase, setPickedBase] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const zoneQ = useQuery({
    queryKey: ["detect-zone", playerId],
    queryFn: () => detectPlayerZone({ data: { playerId } }),
    enabled: activePanel === "radar" && Boolean(playerId),
  });

  const claimMut = useMutation({
    mutationFn: () =>
      claimZoneRadar({
        data: { playerId, baseCode: pickedBase, range: radarRange, confirmed: true },
      }),
    onSuccess: (res) => {
      toast.success(`Zone radar locked on ${res.base?.name || pickedBase}`);
      setConfirmOpen(false);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Claim failed"),
  });

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(BASE_REQUESTS_KEY) ?? "[]") as BaseRequest[];
      setOwnedBases(saved);
    } catch {
      setOwnedBases([]);
    }
    try {
      const raw = window.localStorage.getItem(FACTION_PROFILE_KEY);
      if (raw) {
        const profile = JSON.parse(raw) as { name?: string };
        if (profile.name) setPickedFaction(profile.name);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!zoneQ.data) return;
    if (zoneQ.data.ownedFactions[0] && !pickedFaction) setPickedFaction(zoneQ.data.ownedFactions[0]);
    if (zoneQ.data.prompt?.code) {
      setPickedBase(zoneQ.data.prompt.code);
      setConfirmOpen(true);
    }
  }, [zoneQ.data, pickedFaction]);

  const selectedSize = BASE_SIZES.find((option) => option.id === size) ?? BASE_SIZES[1];
  const totalCost = selectedSize.price + extras.length * 5_000;
  const submitRequest = () => {
    if (!location) return;
    const request: BaseRequest = { id: crypto.randomUUID(), map: mapKey, location, size, radar: false, radarRange };
    const next = [...ownedBases, request];
    window.localStorage.setItem(BASE_REQUESTS_KEY, JSON.stringify(next));
    setOwnedBases(next);
    setSubmitted(true);
  };
  const toggleExtra = (extra: string) => setExtras((current) => current.includes(extra) ? current.filter((item) => item !== extra) : [...current, extra]);

  const factionBases = (zoneQ.data?.factionBases ?? []).filter((b) => !pickedFaction || b.faction === pickedFaction);
  const prompt = zoneQ.data?.prompt;

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
                <p className="mt-2 text-sm text-muted-foreground">Auto-detect your last flag pole, then confirm the compound.</p>
              </button>
            </div>
          )}
          {activePanel === "radar" && (
            <GlassPanel className="space-y-5 border-cyan-400/30 p-6">
              <button type="button" onClick={() => setActivePanel(null)} className="text-xs text-muted-foreground hover:text-foreground">← Back to Base Ops</button>
              <h2 className="font-display text-2xl">Track your zone</h2>
              <p className="text-sm text-muted-foreground">
                We look at your last flag pole, then only ask <span className="text-[#e8c56a]">Is this your base?</span> if that pin sits on a dense build cluster. Zone radar can only be claimed by the faction owner.
              </p>
              {zoneQ.isLoading ? <div className="text-sm text-zinc-500">Scanning flag poles…</div> : null}
              {zoneQ.data && !zoneQ.data.isFactionOwner ? (
                <div className="space-y-3 rounded-xl border border-[#d4a84b]/30 p-4">
                  <div className="text-sm text-[#f5e6c0]">You are not marked as a faction owner. Pick the faction you fight with, then that faction's base.</div>
                  <select value={pickedFaction} onChange={(e) => { setPickedFaction(e.target.value); setPickedBase(""); }} className="h-11 w-full rounded-lg border border-glass-border bg-black/40 px-3 text-sm">
                    <option value="">Select faction</option>
                    {(zoneQ.data.factions.length ? zoneQ.data.factions : ["Unaffiliated"]).map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                  <select value={pickedBase} onChange={(e) => setPickedBase(e.target.value)} disabled={!pickedFaction} className="h-11 w-full rounded-lg border border-glass-border bg-black/40 px-3 text-sm disabled:opacity-40">
                    <option value="">Select that faction's base</option>
                    {factionBases.map((b) => (
                      <option key={b.code} value={b.code}>{b.name} · {b.code}{b.x != null ? ` · ${b.x},${b.z}` : ""}</option>
                    ))}
                  </select>
                  <p className="text-xs text-zinc-500">Claim still fails unless you are the owner of that base.</p>
                </div>
              ) : null}
              {prompt ? (
                <div className="rounded-xl border border-[#d4a84b]/40 bg-[#d4a84b]/10 p-4">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-[#d4a84b]">High confidence</div>
                  <div className="mt-1 font-display text-xl text-[#e8c56a]">{prompt.name}</div>
                  <div className="text-sm text-zinc-400">{prompt.faction} · flag {prompt.x}, {prompt.z} · {prompt.map}</div>
                  <div className="mt-2 text-sm text-[#f5e6c0]">{prompt.reason}</div>
                  <div className="mt-4 text-lg text-[#e8c56a]">Is this your base?</div>
                  <div className="mt-3 flex gap-2">
                    <button type="button" onClick={() => { setPickedBase(prompt.code); setConfirmOpen(true); }} className="rounded-full bg-[#d4a84b] px-4 py-2 text-sm font-semibold text-black">Yes, claim zone</button>
                    <button type="button" onClick={() => setConfirmOpen(false)} className="rounded-full border border-white/15 px-4 py-2 text-sm">No</button>
                  </div>
                </div>
              ) : zoneQ.data && zoneQ.data.isFactionOwner && zoneQ.data.candidates.length === 0 ? (
                <div className="rounded-xl border border-dashed border-glass-border p-5 text-sm text-muted-foreground">No flag pole + build cluster matched you yet. Add coords on an owned custom base first.</div>
              ) : null}
              {(zoneQ.data?.candidates.length ?? 0) > 0 && !prompt ? (
                <div className="space-y-2">
                  <div className="text-xs uppercase tracking-wider text-zinc-500">Not sure yet — pick only if you own it</div>
                  {zoneQ.data!.candidates.map((c) => (
                    <button key={c.code} type="button" onClick={() => { setPickedBase(c.code); setConfirmOpen(true); }} className="w-full rounded-xl border border-glass-border px-3 py-2 text-left text-sm">
                      {c.name} · {c.x},{c.z} · score {c.buildScore}
                    </button>
                  ))}
                </div>
              ) : null}
              <select value={radarRange} onChange={(event) => setRadarRange(event.target.value)} className="h-11 w-full rounded-lg border border-glass-border bg-black/40 px-3 text-sm">
                <option>250m</option><option>500m</option><option>750m</option><option>1000m</option>
              </select>
              <button
                type="button"
                disabled={!pickedBase || claimMut.isPending}
                onClick={() => {
                  if (!pickedBase) return toast.error("Pick a base first");
                  setConfirmOpen(true);
                }}
                className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground disabled:opacity-40"
              >
                {claimMut.isPending ? "Claiming…" : "Purchase Base Radar · 5,000 credits"}
              </button>
              {confirmOpen && pickedBase ? (
                <div className="rounded-xl border border-[#d4a84b]/40 p-4">
                  <div className="font-medium text-[#e8c56a]">Is this your base?</div>
                  <div className="mt-1 text-sm text-zinc-400">Only the faction owner can lock radar on it.</div>
                  <div className="mt-3 flex gap-2">
                    <button type="button" onClick={() => claimMut.mutate()} className="rounded-full bg-[#d4a84b] px-4 py-2 text-sm font-semibold text-black">Yes</button>
                    <button type="button" onClick={() => setConfirmOpen(false)} className="rounded-full border border-white/15 px-4 py-2 text-sm">No</button>
                  </div>
                </div>
              ) : null}
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
