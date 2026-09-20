import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { LIVONIA_ZONES, ZONE_REWARD } from "@/lib/challenges/livonia-zones";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/_app/challenges/zone-discovery")({
  component: ZoneDiscoveryPage,
  head: () => ({ meta: [{ title: `Zone discovery — ${BRAND.name}` }] }),
});

function ZoneDiscoveryPage() {
  const { user } = useAuth();
  const playerId = user?.id || "";
  const q = useQuery({
    queryKey: ["zone-discovery", playerId],
    queryFn: async () => {
      const res = await fetch(`/api/challenges/zones?playerId=${encodeURIComponent(playerId)}`, { method: "POST" });
      return res.json() as Promise<{
        found?: string[];
        awarded?: string[];
        notices?: Array<{ id: string; text: string; at: string }>;
        psn?: string | null;
        error?: string;
      }>;
    },
    enabled: Boolean(playerId),
    refetchInterval: 20_000,
  });
  const found = new Set(q.data?.found ?? []);
  const cleared = found.size;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-3xl text-primary">Zone discovery</h2>
        <p className="mt-2 max-w-2xl text-sm text-zinc-400">
          Walk a 450m ring on each Livonia city while linked and online on 101x. First visit pays {ZONE_REWARD.toLocaleString()} cr,
          a hub notice, and a Discord DM.
        </p>
        <div className="mt-3 font-mono text-sm text-primary">
          {cleared}/{LIVONIA_ZONES.length} cities · {q.data?.psn ? `PSN ${q.data.psn}` : "Link PSN to track"}
        </div>
      </div>
      {q.data?.awarded?.length ? (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          Just cleared: {q.data.awarded.join(", ")} · +{q.data.awarded.length * ZONE_REWARD} cr
        </div>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {LIVONIA_ZONES.map((zone) => {
          const done = found.has(zone.id);
          return (
            <div key={zone.id} className={`rounded-xl border p-4 ${done ? "border-emerald-400/40 bg-emerald-500/10" : "border-white/10 bg-black/40"}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium text-foreground">{zone.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    Y {zone.x} / Z {zone.z} · r{zone.radius}m
                  </div>
                </div>
                <span className={`text-[10px] uppercase tracking-wider ${done ? "text-emerald-300" : "text-zinc-500"}`}>{done ? "Found" : "Open"}</span>
              </div>
              <div className="mt-3 text-xs text-muted-foreground">+{ZONE_REWARD.toLocaleString()} cr</div>
            </div>
          );
        })}
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Hub notices</div>
        <ul className="mt-2 space-y-1 text-sm text-zinc-400">
          {(q.data?.notices ?? []).length === 0 && <li>No discoveries yet.</li>}
          {(q.data?.notices ?? []).map((n) => (
            <li key={n.id}>{n.text}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
