import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { GlassPanel } from "@/components/ui-custom/GlassPanel";
import { IconBolt, IconChart, IconSpark, IconWorkspace, IconImport, IconAudience, IconCampaign } from "@/components/ui-custom/CustomIcon";
import { getEconomyBalance } from "@/lib/economy.functions";
import { getKillfeed } from "@/lib/killfeed.functions";
import { getAsylumServerStatus } from "@/lib/dayz/server-status.functions";
import { DAYZ_SERVERS } from "@/lib/dayz/servers";
import { BRAND } from "@/lib/brand";
import { PsnLinkCard } from "@/components/app/PsnLinkCard";
import { DONATION_TIERS, hexColor } from "@/lib/donation-tiers";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

const QUICK = [
  { to: "/tools/npc-shop", label: "NPC Shop", desc: "Buy & spawn", Icon: IconImport },
  { to: "/account", label: "Account", desc: "Link PSN", Icon: IconAudience },
  { to: "/servers", label: "Servers", desc: "Online status", Icon: IconBolt },
  { to: "/economy", label: "Credits", desc: "Balance & XP", Icon: IconChart },
  { to: "/operations", label: "Ops", desc: "Contracts", Icon: IconCampaign },
  { to: "/stats", label: "Ranks", desc: "Leaderboards", Icon: IconChart },
  { to: "/factions", label: "Factions", desc: "Wars", Icon: IconWorkspace },
] as const;

const PAY_METHODS = [
  { id: "auto", label: "Card / Apple Pay / Google Pay" },
  { id: "paypal", label: "PayPal" },
  { id: "cashapp", label: "Cash App" },
  { id: "venmo", label: "Venmo" },
] as const;

async function startDonate(usd: number, method: string) {
  const res = await fetch("/api/stripe/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usd, method }),
  });
  const data = (await res.json()) as { url?: string; error?: string };
  if (!res.ok || !data.url) {
    toast.error(data.error || "Stripe is not configured yet");
    return;
  }
  window.location.href = data.url;
}

function Dashboard() {
  const [donateOpen, setDonateOpen] = useState(false);
  const [method, setMethod] = useState<string>("auto");
  const [busy, setBusy] = useState<number | null>(null);
  const balanceQ = useQuery({ queryKey: ["economy-balance"], queryFn: () => getEconomyBalance({ data: {} }) });
  const killsQ = useQuery({
    queryKey: ["killfeed-5d"],
    queryFn: () => getKillfeed({ data: { server: "all", limit: 400 } }),
    refetchInterval: 30_000,
  });
  const statusQ = useQuery({
    queryKey: ["nitrado-status-lobby", DAYZ_SERVERS[0].id],
    queryFn: () => getAsylumServerStatus({ data: { serverId: DAYZ_SERVERS[0].id } }),
    retry: 0,
  });
  const credits = balanceQ.data ? balanceQ.data.balance.toLocaleString() : "—";
  const serverLine = statusQ.data ? (statusQ.data.status === "started" ? `${statusQ.data.players.current}/${statusQ.data.players.max}` : statusQ.data.status) : statusQ.error ? "Setup" : "—";
  const kills = killsQ.data?.events ?? [];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 px-3 pb-4 pt-2 sm:px-4 sm:py-8">
      <section className="relative overflow-hidden rounded-2xl border border-primary/30 bg-black px-4 py-5 sm:rounded-[2rem] sm:px-10 sm:py-10">
        <button type="button" onClick={() => { setDonateOpen(true); void fetch("/api/discord/donation-roles", { method: "POST" }); }} className="absolute right-3 top-3 z-20 sm:right-6 sm:top-6">
          <motion.span className="relative inline-flex overflow-hidden rounded-full bg-emerald-400 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-black" animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>
            Donate
            {[0, 1, 2, 3, 4].map((i) => (
              <motion.span key={i} className="pointer-events-none absolute text-[11px] font-bold text-emerald-950" style={{ left: `${10 + i * 16}%` }} animate={{ y: [-8, 36], opacity: [0, 1, 0], rotate: [-25, 25] }} transition={{ duration: 1.3, repeat: Infinity, delay: i * 0.16 }}>$</motion.span>
            ))}
          </motion.span>
        </button>
        <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-primary">Command hall</div>
        <h1 className="mt-1 font-display text-3xl leading-none text-primary sm:text-6xl">{BRAND.name}</h1>
        <p className="mt-2 pr-24 text-sm text-zinc-400">{BRAND.tagline}</p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-glass-border bg-glass/30 p-3"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Credits</div><div className="mt-0.5 truncate font-display text-lg text-primary sm:text-2xl">{credits}</div></div>
          <div className="rounded-xl border border-glass-border bg-glass/30 p-3"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Online</div><div className="mt-0.5 truncate font-display text-lg text-primary sm:text-2xl">{serverLine}</div></div>
          <div className="rounded-xl border border-glass-border bg-glass/30 p-3"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Kills 5d</div><div className="mt-0.5 truncate font-display text-lg text-primary sm:text-2xl">{kills.length}</div></div>
        </div>
      </section>

      <AnimatePresence>
        {donateOpen && (
          <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-2xl border border-emerald-400/30 bg-black p-4 sm:p-6">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.22em] text-emerald-300">Support {BRAND.name}</div>
                <h2 className="font-display text-3xl">Donate</h2>
              </div>
              <button type="button" onClick={() => setDonateOpen(false)} className="text-sm text-muted-foreground">Close</button>
            </div>
            <div className="mb-4 flex flex-wrap gap-2">
              {PAY_METHODS.map((m) => (
                <button key={m.id} type="button" onClick={() => setMethod(m.id)} className={`rounded-full px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] ${method === m.id ? "bg-emerald-400 text-black" : "border border-white/15 text-muted-foreground"}`}>
                  {m.label}
                </button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {DONATION_TIERS.map((tier) => (
                <div key={tier.name} className="rounded-2xl border p-4" style={{ borderColor: `${hexColor(tier.color)}66`, background: `${hexColor(tier.color)}14` }}>
                  <div className="flex items-baseline justify-between">
                    <div className="font-display text-3xl" style={{ color: hexColor(tier.color) }}>{tier.name}</div>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">{tier.creditsMark}</div>
                  </div>
                  <button type="button" disabled={busy === tier.usd} onClick={async () => { setBusy(tier.usd); await startDonate(tier.usd, method); setBusy(null); }} className="mt-4 w-full rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-black disabled:opacity-50" style={{ background: hexColor(tier.color) }}>
                    {busy === tier.usd ? "Opening Stripe…" : `Pay ${tier.name}`}
                  </button>
                </div>
              ))}
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <div className="md:hidden"><PsnLinkCard /></div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 lg:grid-cols-4 sm:gap-3">
        {QUICK.map((q) => (
          <Link key={q.to} to={q.to as "/servers"} className="min-h-20 rounded-2xl border border-glass-border bg-glass/30 p-3 sm:p-4">
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
        {killsQ.isLoading && <p className="text-sm text-muted-foreground">Loading logs…</p>}
        {killsQ.data?.unavailable?.length ? <p className="mb-2 text-xs text-amber-300">{killsQ.data.unavailable.map((u) => `${u.server}: ${u.reason}`).join(" · ")}</p> : null}
        <div className="max-h-80 overflow-y-auto overscroll-contain pr-1">
          {kills.length === 0 && !killsQ.isLoading && <p className="text-sm text-muted-foreground">No kills in the last 5 days.</p>}
          <ul className="space-y-2">
            {kills.map((e) => (
              <li key={e.id} className="flex items-baseline justify-between gap-3 border-b border-white/5 pb-2 text-sm">
                <div className="min-w-0">
                  <span className="text-emerald-300">{e.killer}</span>
                  <span className="text-muted-foreground"> killed </span>
                  <span className="text-red-300">{e.victim}</span>
                  {e.weapon ? <span className="text-muted-foreground"> · {e.weapon}</span> : null}
                </div>
                <div className="shrink-0 text-[11px] uppercase tracking-wider text-muted-foreground">{e.server} · {e.at.replace("T", " ").slice(0, 16)}</div>
              </li>
            ))}
          </ul>
        </div>
      </GlassPanel>
    </div>
  );
}
