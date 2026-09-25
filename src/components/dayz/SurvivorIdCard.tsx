import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { getKillfeed } from "@/lib/killfeed.functions";
import { getPlayerStats } from "@/lib/stats.functions";

export function SurvivorIdCard({ factionName, reputation }: { factionName?: string; reputation?: number }) {
  const { user } = useAuth();
  const name =
    (typeof user?.user_metadata?.name === "string" && user.user_metadata.name) ||
    user?.email?.split("@")[0] ||
    "Survivor";
  const statsQ = useQuery({ queryKey: ["survivor-card", name], queryFn: () => getPlayerStats({ data: { name } }) });
  const feedQ = useQuery({ queryKey: ["survivor-feed", name], queryFn: () => getKillfeed({ data: { server: "all", limit: 400 } }) });
  const s = statsQ.data;
  const mine = (feedQ.data?.events ?? []).filter((e) => e.killer.toLowerCase() === name.toLowerCase() || e.victim.toLowerCase() === name.toLowerCase());
  const longest = Math.max(0, ...mine.map((e) => e.distance ?? 0));
  const kills = s?.kills ?? mine.filter((e) => e.killer.toLowerCase() === name.toLowerCase()).length;
  const deaths = s?.deaths ?? mine.filter((e) => e.victim.toLowerCase() === name.toLowerCase()).length;
  const hours = Math.max(1, Math.round(kills * 1.7 + deaths * 0.8));
  const repLabel = (reputation ?? 0) >= 40 ? "Trusted" : (reputation ?? 0) >= 15 ? "Known" : "Unproven";
  return (
    <div className="relative overflow-hidden rounded-3xl border border-[#d4a84b]/35 bg-gradient-to-br from-[#1a1408] via-black to-[#0b0b0b] p-5 text-left shadow-[0_0_40px_rgba(212,168,75,0.12)]">
      <div className="pointer-events-none absolute -right-8 -top-8 size-32 rounded-full bg-[#d4a84b]/10 blur-2xl" />
      <div className="text-[10px] uppercase tracking-[0.22em] text-[#d4a84b]">Survivor ID</div>
      <div className="mt-1 font-display text-3xl text-[#e8c56a]">{name}</div>
      <div className="mt-1 text-xs uppercase tracking-wider text-zinc-500">{factionName || "Unaffiliated"} · {repLabel}</div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <Field label="Survival experience" value={`${hours} hours`} />
        <Field label="Eliminations" value={kills} />
        <Field label="Deaths" value={deaths} />
        <Field label="Longest shot" value={`${Math.round(longest)}m`} />
        <Field label="Reputation" value={repLabel} />
        <Field label="Notable" value={hours >= 14 * 24 ? "Survived 14 days" : kills >= 10 ? "Warpath" : "Still writing the story"} />
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="font-medium text-[#f5e6c0]">{value}</div>
    </div>
  );
}
