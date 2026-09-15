import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { IconBolt } from "@/components/ui-custom/CustomIcon";
import { useAuth } from "@/contexts/AuthContext";
import { BRAND } from "@/lib/brand";
import { getRewardStats, type RewardStats } from "@/lib/rewards.functions";

export const Route = createFileRoute("/_app/rewards")({
  component: RewardsPage,
  head: () => ({
    meta: [
      { title: `Rewards - ${BRAND.name}` },
      { name: "description", content: "Combat rewards and player reward statistics." },
    ],
  }),
});

type RewardRule = {
  label: string;
  detail: string;
  amount: number;
  stat: keyof Omit<RewardStats, "playerId" | "displayName">;
};

const REWARD_RULES: RewardRule[] = [
  { label: "Kill", detail: "Every player kill", amount: 200, stat: "kills" },
  { label: "Headshot bonus", detail: "Added to the kill reward", amount: 150, stat: "headshotKills" },
  { label: "Long range: 400m", detail: "400m to 599m", amount: 150, stat: "longRange400Kills" },
  { label: "Long range: 600m", detail: "600m to 999m", amount: 350, stat: "longRange600Kills" },
  { label: "Long range: 1,000m", detail: "1,000m and beyond", amount: 1000, stat: "longRange1000Kills" },
  { label: "Death", detail: "Per death", amount: -100, stat: "deaths" },
  { label: "Spawn kill", detail: "Penalty per confirmed spawn kill", amount: -200, stat: "spawnKills" },
  { label: "Car destroy", detail: "Enemy vehicle destroyed", amount: 100, stat: "carDestroys" },
  { label: "Animal kill", detail: "Per animal", amount: 100, stat: "animalKills" },
  { label: "Combat log", detail: "Penalty per combat log", amount: -200, stat: "combatLogs" },
];

function formatAmount(amount: number) {
	if (amount === 0) return "0";
  return `${amount > 0 ? "+" : "-"} ${Math.abs(amount).toLocaleString()}`;
}

function totalEarned(stats: RewardStats) {
  return REWARD_RULES.reduce((total, rule) => total + Number(stats[rule.stat]) * rule.amount, 0);
}

function RewardsPage() {
  const { session } = useAuth();
  const discordId = session?.user?.id;
  const discordName =
    (session?.user?.user_metadata?.name as string | undefined) ||
    (session?.user?.user_metadata?.username as string | undefined);
  const playerName = typeof window === "undefined" ? "" : window.localStorage.getItem("asylumhub:psn-name") || window.localStorage.getItem("asylumhub:psn-id") || "";
  const statsQ = useQuery({
    queryKey: ["rewards-stats", discordId, playerName],
    queryFn: () => getRewardStats({ data: { playerId: discordId, playerName, displayName: discordName } }),
    refetchInterval: 30_000,
  });
  const earned = statsQ.data ? totalEarned(statsQ.data) : 0;

  return (
    <main className="relative min-h-[calc(100vh-3rem)] overflow-hidden bg-black text-foreground">
      <style>{`
        @keyframes rewards-scan { 0% { transform: translateY(-100%); } 100% { transform: translateY(850%); } }
        @keyframes rewards-flicker { 0%, 100% { opacity: 1; } 46% { opacity: 1; } 47% { opacity: .72; } 48% { opacity: 1; } }
      `}</style>
      <motion.div className="pointer-events-none absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_50%_0%,color-mix(in_oklab,var(--primary)_26%,transparent),transparent_55%)]" animate={{ opacity: [0.18, 0.38, 0.18] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }} />
      <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(135deg,transparent_0%,transparent_48%,color-mix(in_oklab,var(--primary)_18%,transparent)_49%,transparent_50%)] [background-size:46px_46px]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 opacity-[0.07]" style={{ background: "linear-gradient(180deg, transparent, color-mix(in oklab, var(--primary) 90%, white), transparent)", animation: "rewards-scan 6s linear infinite" }} />
      <div className="pointer-events-none absolute inset-6 sm:inset-10" style={{ animation: "rewards-flicker 7s ease-in-out infinite" }} aria-hidden>
        {(["top-4 left-4 border-l border-t", "top-4 right-4 border-r border-t", "bottom-4 left-4 border-l border-b", "bottom-4 right-4 border-r border-b"] as const).map((position) => <span key={position} className={`absolute size-8 border-primary/40 sm:size-12 ${position}`} />)}
      </div>

      <div className="relative mx-auto max-w-5xl px-4 py-8 sm:py-10">
        <motion.header className="border-b border-primary/25 pb-6" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="flex items-center gap-3 text-primary">
            <span className="grid size-10 place-items-center border border-primary/40 bg-primary/10"><IconBolt size={20} /></span>
            <span className="text-[11px] uppercase tracking-[0.28em]">{BRAND.name} / Combat ledger</span>
          </div>
          <h1 className="font-display mt-4 text-4xl text-primary sm:text-5xl">Rewards</h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400">Every action has a cost. Your combat record and total earnings are tracked here.</p>
        </motion.header>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <motion.section className="border border-primary/25 bg-white/[0.025] p-5 sm:p-6" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08, duration: 0.5 }}>
            <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div><h2 className="font-display text-2xl">Your reward stats</h2><p className="mt-1 text-xs text-muted-foreground">{playerName || "No PSN identity linked"}</p></div>
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">Live record</span>
            </div>
            {!playerName ? <p className="mt-5 text-sm text-zinc-400">Link your PSN ID to match your DayZ server events. <Link to="/account" className="text-primary hover:underline">Link account</Link></p> : statsQ.isLoading ? <div className="mt-5 h-40 animate-pulse bg-white/5" /> : statsQ.error ? <p className="mt-5 text-sm text-red-300">Unable to load reward stats.</p> : (
              <div className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
                {REWARD_RULES.map((rule) => <div key={rule.stat} className="flex items-center justify-between border-b border-white/5 py-2 text-sm"><span className="text-zinc-400">{rule.label}</span><span className="font-mono text-foreground">{Number(statsQ.data?.[rule.stat] ?? 0).toLocaleString()}</span></div>)}
              </div>
            )}
          </motion.section>

          <motion.aside className="relative overflow-hidden border border-primary/35 bg-primary/[0.08] p-5 sm:p-6" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.5 }}>
            <motion.div className="pointer-events-none absolute -right-10 -top-10 size-36 rounded-full border border-primary/20" animate={{ rotate: 360 }} transition={{ duration: 16, repeat: Infinity, ease: "linear" }} />
            <div className="relative text-[11px] uppercase tracking-[0.24em] text-primary">Rewards earned so far</div>
            <div className={`relative mt-4 font-display text-5xl ${earned < 0 ? "text-red-300" : "text-primary"}`}>{formatAmount(earned)}<span className="ml-2 text-base">CR</span></div>
            <p className="relative mt-4 text-sm text-zinc-400">Net value from every recorded kill, objective, penalty, and survival action.</p>
          </motion.aside>
        </div>

        <motion.section className="mt-4 border border-primary/25 bg-white/[0.025]" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22, duration: 0.5 }}>
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 sm:px-6"><h2 className="font-display text-2xl">Reward schedule</h2><span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Credits</span></div>
          <div className="divide-y divide-white/5">
            {REWARD_RULES.map((rule, index) => <motion.div key={rule.stat} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-5 py-3 sm:px-6" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.28 + index * 0.035 }}><span className="grid size-7 place-items-center border border-primary/25 font-mono text-[10px] text-primary">{String(index + 1).padStart(2, "0")}</span><div><div className="text-sm font-medium">{rule.label}</div><div className="mt-0.5 text-xs text-muted-foreground">{rule.detail}</div></div><span className={`font-mono text-sm ${rule.amount < 0 ? "text-red-300" : "text-primary"}`}>{formatAmount(rule.amount)} CR</span></motion.div>)}
          </div>
        </motion.section>
      </div>
    </main>
  );
}