import { useEffect, useMemo, useState } from "react";
import { flagImage, flagImageFallback, FACTION_FLAGS } from "@/lib/faction-flags";

const STORAGE = "asylumhub:faction-profile";

type Metric = "kills" | "playtime" | "reputation";
type Row = { name: string; flag: string; kills: number; playtime: number; reputation: number; members: number };

const METRICS: { id: Metric; label: string; format: (n: number) => string }[] = [
  { id: "kills", label: "Total faction kills", format: (n) => n.toLocaleString() },
  { id: "playtime", label: "Playtime (hours)", format: (n) => `${n.toLocaleString()} h` },
  { id: "reputation", label: "Reputation", format: (n) => n.toLocaleString() },
];

function flagFile(id: string) {
  return FACTION_FLAGS.find(([fid]) => fid === id)?.[2] ?? FACTION_FLAGS[0][2];
}

export function FactionLeaderboard() {
  const [metric, setMetric] = useState<Metric>("kills");
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE);
      if (!raw) return;
      const profile = JSON.parse(raw) as { name?: string; flag?: string; members?: string[]; kills?: number; playtime?: number; reputation?: number };
      if (!profile.name) return;
      setRows([
        {
          name: profile.name,
          flag: profile.flag || "",
          kills: profile.kills ?? 0,
          playtime: profile.playtime ?? 0,
          reputation: profile.reputation ?? 0,
          members: Math.max(1, profile.members?.length ?? 0),
        },
      ]);
    } catch {
      setRows([]);
    }
  }, []);

  const ranked = useMemo(() => [...rows].sort((a, b) => b[metric] - a[metric]), [metric, rows]);
  const current = METRICS.find((m) => m.id === metric)!;

  return (
    <section className="mt-6 rounded-2xl border border-primary/25 bg-white/[0.02] p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-primary">Faction board</div>
          <h2 className="font-display mt-1 text-2xl text-foreground">Leaderboard</h2>
        </div>
        <select value={metric} onChange={(e) => setMetric(e.target.value as Metric)} className="rounded-lg border border-white/15 bg-black px-3 py-2 text-sm">
          {METRICS.map((m) => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </select>
      </div>
      {!ranked.length ? (
        <div className="mt-4 rounded-xl border border-dashed border-white/10 p-6 text-sm text-muted-foreground">No live factions on the board yet.</div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
          {ranked.map((row, index) => {
            const file = flagFile(row.flag);
            return (
              <div key={row.name} className="grid grid-cols-[2.5rem_minmax(0,1fr)_7rem] items-center gap-2 px-3 py-2.5 sm:grid-cols-[2.5rem_2.5rem_minmax(0,1fr)_5rem_7rem]">
                <span className="font-mono text-sm text-primary">{index + 1}</span>
                <img src={flagImage(file)} alt="" className="hidden size-9 object-contain sm:block" onError={(e) => { e.currentTarget.src = flagImageFallback(file); }} />
                <div className="truncate font-medium">{row.name}</div>
                <span className="hidden text-right font-mono text-sm text-muted-foreground sm:block">{row.members}</span>
                <span className="text-right font-mono text-sm">{current.format(row[metric])}</span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
