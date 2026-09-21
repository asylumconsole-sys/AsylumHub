import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { GlassPanel } from "@/components/ui-custom/GlassPanel";
import { IconBolt, IconChart, IconWorkspace, IconImport, IconAudience, IconCampaign } from "@/components/ui-custom/CustomIcon";
import { getEconomyBalance } from "@/lib/economy.functions";
import { getKillfeed } from "@/lib/killfeed.functions";
import { getAsylumServerStatus } from "@/lib/dayz/server-status.functions";
import { getMyLinkedPlayernames } from "@/lib/account-links.functions";
import { DAYZ_SERVERS } from "@/lib/dayz/servers";
import { BRAND } from "@/lib/brand";
import { PsnLinkCard } from "@/components/app/PsnLinkCard";
import { useAuth } from "@/contexts/AuthContext";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

const QUICK = [
  { to: "/tools/npc-shop", label: "NPC Shop", desc: "Buy & spawn", Icon: IconImport },
  { to: "/account", label: "Account", desc: "Link PSN", Icon: IconAudience },
  { to: "/servers", label: "Servers", desc: "Online status", Icon: IconBolt },
  { to: "/economy", label: "Credits", desc: "Balance & XP", Icon: IconChart },
  { to: "/operations", label: "Operations", desc: "Contracts", Icon: IconCampaign },
  { to: "/stats", label: "Ranks", desc: "Leaderboards", Icon: IconChart },
  { to: "/war-room", label: "War Room", desc: "Factions", Icon: IconWorkspace },
] as const;

function PlayerLink({ name, tone }: { name: string; tone: "kill" | "death" }) {
  return (
    <Link to="/stats" search={{ player: name } as never} className={`font-medium underline-offset-2 hover:underline ${tone === "kill" ? "text-emerald-300" : "text-red-300"}`}>
      {name}
    </Link>
  );
}

function Dashboard() {
  const { user } = useAuth();
  const playerId = user?.id || "";
  const balanceQ = useQuery({
    queryKey: ["economy-balance", playerId],
    queryFn: () => getEconomyBalance({ data: { playerId } }),
    enabled: Boolean(playerId),
  });
  const linksQ = useQuery({
    queryKey: ["linked-playernames", playerId],
    queryFn: () => getMyLinkedPlayernames({ data: { discordId: playerId } }),
    enabled: Boolean(playerId),
  });
  const killsQ = useQuery({ queryKey: ["killfeed-5d"], queryFn: () => getKillfeed({ data: { server: "all", limit: 400 } }), refetchInterval: 30_000 });
  const statusQ = useQuery({ queryKey: ["nitrado-status-lobby", DAYZ_SERVERS[0].id], queryFn: () => getAsylumServerStatus({ data: { serverId: DAYZ_SERVERS[0].id } }), retry: 0 });
  const credits = balanceQ.data ? balanceQ.data.balance.toLocaleString() : balanceQ.isLoading ? "…" : "0";
  const serverLine = statusQ.data ? (statusQ.data.status === "started" ? `${statusQ.data.players.current}/${statusQ.data.players.max}` : statusQ.data.status) : statusQ.error ? "Setup" : "…";
  const kills = killsQ.data?.events ?? [];
  const tags = (linksQ.data?.links ?? []).map((l) => l.username).filter(Boolean);
  if (linksQ.data?.psn && !tags.includes(linksQ.data.psn)) tags.unshift(linksQ.data.psn);
  const tagLine = tags.length ? tags.slice(0, 2).join(" · ") : "Link PSN";

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 px-3 pb-4 pt-2 sm:px-4 sm:py-8">
      <section className="relative overflow-hidden rounded-2xl border border-primary/30 bg-black px-4 py-5 sm:rounded-[2rem] sm:px-10 sm:py-10">
        <motion.div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-primary/20 blur-3xl" animate={{ opacity: [0.3, 0.7, 0.3] }} transition={{ duration: 4, repeat: Infinity }} />
        <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-primary">Command hall</div>
        <h1 className="mt-1 font-display text-3xl leading-none text-primary sm:text-6xl">{BRAND.name}</h1>
        <p className="mt-2 pr-24 text-sm text-zinc-400">{BRAND.tagline}</p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Link to="/economy" className="rounded-xl border border-glass-border bg-glass/30 p-3 transition hover:border-primary/50">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Credits</div>
            <div className="mt-0.5 truncate font-display text-lg text-primary sm:text-2xl">{credits}</div>
          </Link>
          <Link to="/servers" className="rounded-xl border border-glass-border bg-glass/30 p-3 transition hover:border-primary/50">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Online</div>
            <div className="mt-0.5 truncate font-display text-lg text-primary sm:text-2xl">{serverLine}</div>
          </Link>
          <Link to="/account" className="rounded-xl border border-glass-border bg-glass/30 p-3 transition hover:border-primary/50">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Gamertag</div>
            <div className="mt-0.5 truncate font-display text-sm text-primary sm:text-xl">{tagLine}</div>
            <div className="mt-0.5 truncate text-[10px] uppercase tracking-wide text-zinc-500">Faction · War Room</div>
          </Link>
        </div>
      </section>
      <div className="md:hidden"><PsnLinkCard /></div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 lg:grid-cols-4 sm:gap-3">
        {QUICK.map((q) => (
          <Link key={q.to} to={q.to as "/servers"} className="min-h-20 rounded-2xl border border-glass-border bg-glass/30 p-3 sm:p-4 transition hover:border-primary/40">
            <q.Icon size={18} className="text-primary" />
            <div className="mt-2 text-sm font-medium">{q.label}</div>
            <div className="text-[11px] text-muted-foreground">{q.desc}</div>
          </Link>
        ))}
      </div>
      <GlassPanel className="p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium">Killfeed · last 5 days</h2>
          <span className="text-[11px] text-muted-foreground">{kills.length} kills</span>
        </div>
        <div className="max-h-80 overflow-y-auto pr-1">
          {kills.length === 0 && !killsQ.isLoading && <p className="text-sm text-muted-foreground">No kills in the last 5 days.</p>}
          <ul className="space-y-2">
            {kills.map((e) => (
              <li key={e.id} className="border-b border-white/5 pb-2 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="min-w-0">
                    <PlayerLink name={e.killer} tone="kill" />
                    <span className="text-muted-foreground"> killed </span>
                    <PlayerLink name={e.victim} tone="death" />
                    {e.weapon ? <span className="text-muted-foreground"> with {e.weapon}</span> : null}
                    {typeof e.distance === "number" ? <span className="text-muted-foreground"> · {Math.round(e.distance)}m</span> : null}
                  </div>
                  <div className="shrink-0 text-[11px] uppercase tracking-wider text-muted-foreground">{e.server} · {e.at.replace("T", " ").slice(0, 16)}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </GlassPanel>
    </div>
  );
}
