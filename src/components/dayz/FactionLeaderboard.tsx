import { useMemo, useState } from "react";

const FLAGS: Record<string, [string, string]> = {
  dayz: ["DayZ", "Flag_DayZ.png"],
  wolf: ["Wolf", "Flag_Wolf.png"],
  zenit: ["Zenit", "Flag_Zenit.png"],
  bear: ["Bear", "Flag_Bear.png"],
  snake: ["Snake", "Flag_Snake.png"],
  cdf: ["CDF", "Flag_CDF.png"],
};

const flagSrc = (file: string) => `https://dayz.fandom.com/wiki/Special:FilePath/${encodeURIComponent(file)}`;

type Metric = "kills" | "playtime" | "reputation";

type Row = {
  name: string;
  flag: string;
  kills: number;
  playtime: number;
  reputation: number;
  members: number;
};

const ROWS: Row[] = [
  { name: "Ashfall Syndicate", flag: "dayz", kills: 1840, playtime: 1260, reputation: 9200, members: 24 },
  { name: "Black Meridian", flag: "wolf", kills: 1312, playtime: 880, reputation: 6400, members: 17 },
  { name: "The Lanterns", flag: "zenit", kills: 740, playtime: 610, reputation: 4100, members: 11 },
  { name: "Iron Wolves", flag: "bear", kills: 2210, playtime: 1540, reputation: 10150, members: 31 },
];

const METRICS: { id: Metric; label: string; format: (n: number) => string }[] = [
  { id: "kills", label: "Total faction kills", format: (n) => n.toLocaleString() },
  { id: "playtime", label: "Playtime (hours)", format: (n) => `${n.toLocaleString()} h` },
  { id: "reputation", label: "Reputation", format: (n) => n.toLocaleString() },
];

export function FactionLeaderboard() {
  const [metric, setMetric] = useState<Metric>("kills");
  const ranked = useMemo(
    () => [...ROWS].sort((a, b) => b[metric] - a[metric]),
    [metric],
  );
  const current = METRICS.find((m) => m.id === metric)!;

  return (
    <section className="mt-6 rounded-2xl border border-primary/25 bg-white/[0.02] p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-primary">Faction board</div>
          <h2 className="font-display mt-1 text-2xl text-foreground">Leaderboard</h2>
          <p className="mt-1 text-sm text-muted-foreground">Totals across every rostered member.</p>
        </div>
        <label className="block text-xs text-muted-foreground">
          Rank by
          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value as Metric)}
            className="mt-1 block min-w-[200px] rounded-lg border border-white/15 bg-black px-3 py-2 text-sm text-foreground outline-none"
          >
            {METRICS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
        <div className="grid grid-cols-[2.5rem_minmax(0,1fr)_7rem] gap-2 border-b border-white/10 bg-white/[0.03] px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground sm:grid-cols-[2.5rem_2.5rem_minmax(0,1fr)_5rem_7rem]">
          <span>#</span>
          <span className="hidden sm:block">Flag</span>
          <span>Faction</span>
          <span className="hidden text-right sm:block">Members</span>
          <span className="text-right">{current.label}</span>
        </div>
        {ranked.map((row, index) => {
          const flag = FLAGS[row.flag] ?? FLAGS.dayz;
          return (
            <div
              key={row.name}
              className="grid grid-cols-[2.5rem_minmax(0,1fr)_7rem] items-center gap-2 border-t border-white/5 px-3 py-2.5 sm:grid-cols-[2.5rem_2.5rem_minmax(0,1fr)_5rem_7rem]"
            >
              <span className="font-mono text-sm text-primary">{index + 1}</span>
              <img
                src={flagSrc(flag[1])}
                alt={flag[0]}
                className="hidden size-9 rounded-md border border-white/10 bg-black object-contain p-0.5 sm:block"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-2 truncate font-medium">
                  <img src={flagSrc(flag[1])} alt="" className="size-6 rounded sm:hidden" />
                  {row.name}
                </div>
                <div className="text-[11px] text-muted-foreground sm:hidden">{row.members} members</div>
              </div>
              <span className="hidden text-right font-mono text-sm text-muted-foreground sm:block">{row.members}</span>
              <span className="text-right font-mono text-sm text-foreground">{current.format(row[metric])}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
