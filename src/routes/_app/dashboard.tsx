import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { GlassPanel } from "@/components/ui-custom/GlassPanel";
import { IconBolt, IconChart, IconSpark, IconWorkspace, IconImport, IconAudience, IconCampaign } from "@/components/ui-custom/CustomIcon";
import { getEconomyBalance } from "@/lib/economy.functions";
import { getKillfeed } from "@/lib/killfeed.functions";
import { getAsylumServerStatus } from "@/lib/dayz/server-status.functions";
import { DAYZ_SERVERS } from "@/lib/dayz/servers";
import { BRAND } from "@/lib/brand";
import { PsnLinkCard } from "@/components/app/PsnLinkCard";
import { LIVONIA_ZONES, ZONE_REWARD } from "@/lib/challenges/livonia-zones";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

const QUICK = [
  { to: "/challenges", label: "Challenges", desc: "Zone discovery", Icon: IconCampaign },
  { to: "/tools/npc-shop", label: "NPC Shop", desc: "Buy & spawn", Icon: IconImport },
  { to: "/account", label: "Account", desc: "Link PSN", Icon: IconAudience },
  { to: "/servers", label: "Servers", desc: "Online status", Icon: IconBolt },
  { to: "/economy", label: "Credits", desc: "Balance & XP", Icon: IconChart },
  { to: "/live", label: "Live", desc: "Kills & events", Icon: IconSpark },
  { to: "/operations", label: "Ops", desc: "Contracts", Icon: IconCampaign },
  { to: "/stats", label: "Ranks", desc: "Leaderboards", Icon: IconChart },
] as const;

function Dashboard() {
  const balanceQ = useQuery({
    queryKey: ["economy-balance"],
    queryFn: () => getEconomyBalance({ data: {} }),
  });
  const killsQ = useQuery({
    queryKey: ["live-preview"],
    queryFn: () => getKillfeed({ data: { server: "all", limit: 5 } }),
  });
  const statusQ = useQuery({
    queryKey: ["nitrado-status-lobby", DAYZ_SERVERS[0].id],
    queryFn: () => getAsylumServerStatus({ data: { serverId: DAYZ_SERVERS[0].id } }),
    retry: 0,
  });

  const credits = balanceQ.data ? balanceQ.data.balance.toLocaleString() : "—";
  const serverLine = statusQ.data
    ? statusQ.data.status === "started"
      ? `${statusQ.data.players.current}/${statusQ.data.players.max}`
      : statusQ.data.status
    : statusQ.error
      ? "Setup"
      : "—";

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 px-3 pb-4 pt-2 sm:px-4 sm:py-8">
      <section className="rounded-2xl border border-primary/30 bg-black px-4 py-5 sm:rounded-[2rem] sm:px-10 sm:py-10">
        <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-primary">Command hall</div>
        <h1 className="mt-1 font-display text-3xl leading-none text-primary sm:text-6xl">{BRAND.name}</h1>
        <p className="mt-2 text-sm text-zinc-400">{BRAND.tagline}</p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-glass-border bg-glass/30 p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Credits</div>
            <div className="mt-0.5 truncate font-display text-lg text-primary sm:text-2xl">{credits}</div>
          </div>
          <div className="rounded-xl border border-glass-border bg-glass/30 p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Online</div>
            <div className="mt-0.5 truncate font-display text-lg text-primary sm:text-2xl">{serverLine}</div>
          </div>
          <div className="rounded-xl border border-glass-border bg-glass/30 p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Kills</div>
            <div className="mt-0.5 truncate font-display text-lg text-primary sm:text-2xl">{killsQ.data?.events.length ?? 0}</div>
          </div>
        </div>
      </section>

      <div className="md:hidden">
        <PsnLinkCard />
      </div>

      <GlassPanel className="p-4 sm:p-5">
        <div className="text-[10px] uppercase tracking-[0.18em] text-primary">Challenges</div>
        <h2 className="mt-1 text-xl">Zone discovery · Livonia</h2>
        <p className="mt-1 text-sm text-muted-foreground">12 city rings. {ZONE_REWARD.toLocaleString()} cr each when you walk in on 101x.</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {LIVONIA_ZONES.map((z) => (
            <span key={z.id} className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-zinc-300">
              {z.name}
            </span>
          ))}
        </div>
        <Link to="/challenges" className="mt-3 inline-block text-xs uppercase tracking-wider text-primary">
          Open challenges →
        </Link>
      </GlassPanel>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 lg:grid-cols-4 sm:gap-3">
        {QUICK.map((q) => (
          <Link
            key={q.to}
            to={q.to as "/servers"}
            className="min-h-20 rounded-2xl border border-glass-border bg-glass/30 p-3 active:bg-glass/60 sm:p-4"
          >
            <q.Icon size={18} className="text-primary" />
            <div className="mt-2 text-sm font-medium">{q.label}</div>
            <div className="text-[11px] text-muted-foreground">{q.desc}</div>
          </Link>
        ))}
      </div>

      <GlassPanel className="p-4 sm:p-5">
        <h2 className="mb-3 text-sm font-medium">Latest live kills</h2>
        {(killsQ.data?.events.length ?? 0) === 0 && (
          <p className="text-sm text-muted-foreground">No events yet.</p>
        )}
        <ul className="space-y-2">
          {killsQ.data?.events.map((e) => (
            <li key={e.id} className="text-sm">
              <span className="text-emerald-300">{e.killer}</span>
              <span className="text-muted-foreground"> → </span>
              <span className="text-red-300">{e.victim}</span>
            </li>
          ))}
        </ul>
      </GlassPanel>
    </div>
  );
}
