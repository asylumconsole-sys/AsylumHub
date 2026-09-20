import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { GlassPanel } from "@/components/ui-custom/GlassPanel";
import { GlassSkeleton } from "@/components/ui-custom/GlassSkeleton";
import { PanelError } from "@/components/ui-custom/PanelError";
import { DayZPageHeader } from "@/components/dayz/DayZPageHeader";
import { IconChart } from "@/components/ui-custom/CustomIcon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getLeaderboards, getPlayerStats } from "@/lib/stats.functions";

type BoardId = "kills" | "playtime" | "longRange" | "headshots";

export const Route = createFileRoute("/_app/stats")({
  component: StatsPage,
  validateSearch: (s: Record<string, unknown>) => ({ player: typeof s.player === "string" ? s.player : undefined }),
});

function StatsPage() {
  const { player } = Route.useSearch();
  const [tab, setTab] = useState<BoardId>("kills");
  const [lookup, setLookup] = useState(player ?? "");
  const [looked, setLooked] = useState<string | null>(player ?? null);
  useEffect(() => {
    if (player) {
      setLookup(player);
      setLooked(player);
    }
  }, [player]);

  const boardQ = useQuery({ queryKey: ["leaderboards"], queryFn: () => getLeaderboards(), refetchInterval: 60_000 });
  const playerQ = useQuery({ queryKey: ["player-stats", looked], queryFn: () => getPlayerStats({ data: { name: looked! } }), enabled: !!looked });
  const rows = boardQ.data?.[tab];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <DayZPageHeader title="Leaderboards" subtitle="Compete across kills, playtime, long range and headshots" icon={<IconChart size={16} />} hue={200} actions={<Button variant="outline" onClick={() => boardQ.refetch()}>Refresh</Button>} />
      <GlassPanel className="mb-4 p-4">
        <div className="flex flex-wrap gap-2">
          <Input className="max-w-sm" placeholder="Look up player name" value={lookup} onChange={(e) => setLookup(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && lookup.trim()) setLooked(lookup.trim()); }} />
          <Button disabled={!lookup.trim()} onClick={() => setLooked(lookup.trim())}>Look up</Button>
        </div>
        {playerQ.isFetching && <p className="mt-3 text-xs text-muted-foreground">Searching…</p>}
        {looked && playerQ.data === null && !playerQ.isFetching && <p className="mt-3 text-sm text-muted-foreground">No stats for “{looked}”.</p>}
        {playerQ.data && (
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Stat label="Player" value={playerQ.data.displayName} />
            <Stat label="Kills" value={playerQ.data.kills} />
            <Stat label="Deaths" value={playerQ.data.deaths} />
            <Stat label="K/D" value={playerQ.data.kd} />
            <Stat label="Credits" value={playerQ.data.balance.toLocaleString()} />
          </div>
        )}
      </GlassPanel>
      <div className="mb-3 flex flex-wrap gap-2">
        {([["kills", "Kills"], ["playtime", "Playtime"], ["longRange", "Long range"], ["headshots", "Headshots"]] as const).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setTab(id)} className={`rounded-full border px-3 py-1 text-xs uppercase tracking-wider ${tab === id ? "border-primary/50 bg-primary/15 text-primary" : "border-glass-border text-muted-foreground"}`}>{label}</button>
        ))}
      </div>
      {boardQ.isLoading && <GlassSkeleton className="h-64" />}
      {boardQ.error && <PanelError message={boardQ.error instanceof Error ? boardQ.error.message : "Failed to load boards"} onRetry={() => boardQ.refetch()} />}
      {rows && (
        <GlassPanel className="overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-glass-border bg-glass/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr><th className="px-4 py-3">#</th><th className="px-4 py-3">Player</th><th className="px-4 py-3">Server</th><th className="px-4 py-3">Value</th><th className="px-4 py-3">K/D</th><th className="px-4 py-3">Kills</th><th className="px-4 py-3">Deaths</th></tr>
            </thead>
            <tbody className="divide-y divide-glass-border/40">
              {rows.map((row, i) => (
                <tr key={row.playerId} className="hover:bg-glass/20">
                  <td className="px-4 py-2.5 text-muted-foreground">{i + 1}</td>
                  <td className="px-4 py-2.5 font-medium">{row.displayName}</td>
                  <td className="px-4 py-2.5 font-mono text-primary">{row.server}</td>
                  <td className="px-4 py-2.5">{tab === "kills" ? row.kills : tab === "playtime" ? row.playtime : tab === "longRange" ? row.longRange : row.headshots}</td>
                  <td className="px-4 py-2.5">{row.kd}</td>
                  <td className="px-4 py-2.5">{row.kills}</td>
                  <td className="px-4 py-2.5">{row.deaths}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </GlassPanel>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-glass-border bg-glass/30 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
