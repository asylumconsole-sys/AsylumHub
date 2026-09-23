import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { IconBolt, IconChart, IconWorkspace, IconImport, IconAudience, IconCampaign } from "@/components/ui-custom/CustomIcon";
import { getEconomyBalance } from "@/lib/economy.functions";
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

const CASINO_ART =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 420" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2a1608"/>
      <stop offset="1" stop-color="#070400"/>
    </linearGradient>
    <filter id="glow"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <rect width="900" height="420" fill="url(#g)"/>
  <g opacity=".35" fill="#d4a84b">
    <rect x="40" y="210" width="70" height="180" rx="8"/>
    <rect x="130" y="230" width="70" height="160" rx="8"/>
    <rect x="700" y="210" width="70" height="180" rx="8"/>
    <rect x="790" y="230" width="70" height="160" rx="8"/>
  </g>
  <ellipse cx="450" cy="330" rx="160" ry="46" fill="#14532d"/>
  <ellipse cx="450" cy="330" rx="118" ry="28" fill="#0b3b1e" stroke="#d4a84b" stroke-width="3"/>
  <path d="M160 210 Q450 20 740 210" fill="none" stroke="#f3d27a" stroke-width="18" filter="url(#glow)"/>
  <path d="M180 210 Q450 50 720 210" fill="none" stroke="#7a4e10" stroke-width="8"/>
  <text x="450" y="150" text-anchor="middle" font-family="Georgia,serif" font-size="64" fill="#f8e7a8" filter="url(#glow)">PRO CASINO</text>
  <text x="450" y="188" text-anchor="middle" font-family="sans-serif" font-size="16" letter-spacing="6" fill="#d4a84b">SURVIVE THE JACKPOT</text>
  </svg>`);

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
  const statusQ = useQuery({ queryKey: ["nitrado-status-lobby", DAYZ_SERVERS[0].id], queryFn: () => getAsylumServerStatus({ data: { serverId: DAYZ_SERVERS[0].id } }), retry: 0 });
  const credits = balanceQ.data ? balanceQ.data.balance.toLocaleString() : balanceQ.isLoading ? "…" : "0";
  const serverLine = statusQ.data ? (statusQ.data.status === "started" ? `${statusQ.data.players.current}/${statusQ.data.players.max}` : statusQ.data.status) : statusQ.error ? "Setup" : "…";
  const tags = (linksQ.data?.links ?? []).map((l) => l.username).filter(Boolean);
  if (linksQ.data?.psn && !tags.includes(linksQ.data.psn)) tags.unshift(linksQ.data.psn);
  const tagLine = tags.length ? tags.slice(0, 2).join(" · ") : "Link PSN";

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 px-3 pb-4 pt-2 sm:px-4 sm:py-8">
      <section className="relative overflow-hidden rounded-2xl border border-[#d4a84b]/35 bg-black px-4 py-5 sm:rounded-[2rem] sm:px-10 sm:py-10">
        <style>{`
          @keyframes hall-flicker { 0%,100%{opacity:1} 41%{opacity:1} 42%{opacity:.72} 43%{opacity:1} 72%{opacity:1} 73%{opacity:.82} 74%{opacity:1} }
          @keyframes hall-grid { 0% { background-position: 0 0; } 100% { background-position: 46px 46px; } }
          @keyframes casino-shine { 0% { transform: translateX(-140%) skewX(-18deg); } 100% { transform: translateX(240%) skewX(-18deg); } }
          @keyframes casino-glow { 0%,100% { box-shadow: 0 0 0 0 rgba(243,210,122,0.25); } 50% { box-shadow: 0 0 28px 4px rgba(243,210,122,0.35); } }
        `}</style>
        <div className="pointer-events-none absolute inset-0 opacity-[0.18]" style={{ backgroundImage: "linear-gradient(135deg, transparent 0%, transparent 48%, rgba(212,168,75,0.22) 49%, transparent 50%)", backgroundSize: "46px 46px", animation: "hall-grid 18s linear infinite" }} />
        <div className="relative grid items-stretch gap-5 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="flex flex-col justify-center">
            <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#d4a84b]">Command hall</div>
            <h1 className="mt-1 font-display text-3xl leading-none text-[#e8c56a] sm:text-6xl" style={{ animation: "hall-flicker 5s infinite" }}>{BRAND.name}</h1>
            <p className="mt-2 text-sm text-zinc-400">{BRAND.tagline}</p>
          </div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative min-h-[180px] overflow-hidden rounded-2xl border border-[#d4a84b]/50 sm:min-h-[220px]"
            style={{ animation: "casino-glow 3s ease-in-out infinite" }}
          >
            <img src={CASINO_ART} alt="PRO CASINO" className="absolute inset-0 size-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/10" />
            <div className="relative flex h-full min-h-[180px] flex-col items-center justify-end p-4 sm:min-h-[220px] sm:p-5">
              <motion.button
                type="button"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => toast.message("PRO CASINO — doors opening soon")}
                className="relative overflow-hidden rounded-full bg-[#d4a84b] px-6 py-2.5 text-xs font-semibold uppercase tracking-[0.22em] text-black"
              >
                <span className="pointer-events-none absolute inset-y-0 w-12 bg-white/40" style={{ animation: "casino-shine 2s linear infinite" }} />
                <span className="relative">Enter Casino</span>
              </motion.button>
            </div>
          </motion.div>
        </div>
        <div className="relative mt-4 grid grid-cols-3 gap-2">
          <Link to="/economy" className="rounded-xl border border-[#d4a84b]/20 bg-black/50 p-3 transition hover:border-[#d4a84b]/60 hover:shadow-[0_0_24px_rgba(212,168,75,0.15)]">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500">Credits</div>
            <div className="mt-0.5 truncate font-display text-lg text-[#e8c56a] sm:text-2xl">{credits}</div>
          </Link>
          <Link to="/servers" className="rounded-xl border border-[#d4a84b]/20 bg-black/50 p-3 transition hover:border-[#d4a84b]/60 hover:shadow-[0_0_24px_rgba(212,168,75,0.15)]">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500">Online</div>
            <div className="mt-0.5 truncate font-display text-lg text-[#e8c56a] sm:text-2xl">{serverLine}</div>
          </Link>
          <Link to="/account" className="rounded-xl border border-[#d4a84b]/20 bg-black/50 p-3 transition hover:border-[#d4a84b]/60 hover:shadow-[0_0_24px_rgba(212,168,75,0.15)]">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500">Gamertag</div>
            <div className="mt-0.5 truncate font-display text-sm text-[#e8c56a] sm:text-xl">{tagLine}</div>
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
    </div>
  );
}
