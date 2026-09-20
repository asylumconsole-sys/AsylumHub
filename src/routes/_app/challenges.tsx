import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { LIVONIA_ZONES, ZONE_REWARD } from "@/lib/challenges/livonia-zones";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/_app/challenges")({
  component: ChallengesPage,
  head: () => ({ meta: [{ title: `Challenges — ${BRAND.name}` }] }),
});

function ChallengesPage() {
  const { user } = useAuth();
  const playerId = user?.id || "";
  const q = useQuery({
    queryKey: ["zone-discovery", playerId],
    queryFn: async () => {
      const res = await fetch(`/api/challenges/zones?playerId=${encodeURIComponent(playerId)}`, { method: "POST" });
      return res.json() as Promise<{
        found?: string[];
        awarded?: string[];
        notices?: Array<{ id: string; text: string }>;
        psn?: string | null;
      }>;
    },
    enabled: Boolean(playerId),
    refetchInterval: 20_000,
  });
  const found = new Set(q.data?.found ?? []);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div>
        <div className="text-[11px] uppercase tracking-[0.22em] text-primary">Challenges</div>
        <h1 className="font-display mt-1 text-4xl text-primary">Zone discovery</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-400">
          Walk the city rings on 101x Livonia. First visit = {ZONE_REWARD.toLocaleString()} cr, a hub notice, and a Discord DM.
        </p>
        <div className="mt-2 font-mono text-sm text-primary">
          {found.size}/{LIVONIA_ZONES.length} · {q.data?.psn ? `PSN ${q.data.psn}` : "Link PSN on Account"}
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {LIVONIA_ZONES.map((zone) => {
          const done = found.has(zone.id);
          return (
            <div key={zone.id} className={`rounded-xl border p-4 ${done ? "border-emerald-400/40 bg-emerald-500/10" : "border-white/10 bg-black/40"}`}>
              <div className="flex justify-between gap-2">
                <div>
                  <div className="font-medium">{zone.name}</div>
                  <div className="text-[11px] text-muted-foreground">Y {zone.x} / Z {zone.z} · r{zone.radius}m</div>
                </div>
                <span className={`text-[10px] uppercase ${done ? "text-emerald-300" : "text-zinc-500"}`}>{done ? "Found" : "Open"}</span>
              </div>
              <div className="mt-3 text-xs text-muted-foreground">+{ZONE_REWARD.toLocaleString()} cr</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
