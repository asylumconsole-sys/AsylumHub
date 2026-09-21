import { createFileRoute, Outlet, Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { GradientMesh } from "@/components/ui-custom/GradientMesh";
import {
  IconCampaign,
  IconUtm,
  IconChevronLeft,
  IconChevronRight,
  IconSearch,
  IconFunnel,
  IconImport,
  IconChart,
  IconWorkspace,
} from "@/components/ui-custom/CustomIcon";
import {
  GoldLobby,
  GoldServers,
  GoldOperations,
  GoldMap,
  GoldShop,
  GoldWarRoom,
  GoldChallenges,
  GoldRewards,
  GoldBattlepass,
  GoldLocker,
  GoldSettings,
} from "@/components/app/GoldNavIcons";
import { CommandPalette } from "@/components/app/CommandPalette";
import { CommanderOrb } from "@/components/app/CommanderOrb";
import { CommanderAI } from "@/components/app/CommanderAI";
const COMMANDER_ENABLED = import.meta.env.VITE_COMMANDER_ENABLED !== "false";
import { BottomNav } from "@/components/app/BottomNav";
import { UserMenu } from "@/components/app/UserMenu";
import { OnboardingChecklist } from "@/components/app/OnboardingChecklist";
import { GuidedTour } from "@/components/tour/GuidedTour";
import { RouteProgressBar } from "@/components/app/RouteProgressBar";
import { BrandHexLogo } from "@/components/app/BrandHexLogo";
import { BRAND } from "@/lib/brand";
import { AutosaveStatus } from "@/components/app/AutosaveStatus";
import { purgeExpiredDrafts } from "@/hooks/use-draft";

export const Route = createFileRoute("/_app")({
  component: AppShell,
});

const PRIMARY_NAV = [
  { to: "/dashboard", label: "Lobby", Icon: GoldLobby },
  { to: "/servers", label: "Servers", Icon: GoldServers },
  { to: "/operations", label: "Operations", Icon: GoldOperations },
  { to: "/tools/base-map-clicker", label: "Map", Icon: GoldMap },
  { to: "/tools", label: "Server shop", Icon: GoldShop },
  { to: "/war-room", label: "War Room", Icon: GoldWarRoom },
  { to: "/challenges", label: "Challenges", Icon: GoldChallenges },
  { to: "/rewards", label: "Rewards", Icon: GoldRewards },
  { to: "/battlepass", label: "Battlepass", Icon: GoldBattlepass },
  { to: "/templates", label: "Locker", Icon: GoldLocker },
] as const;

type ToolChild = { to: string; label: string; Icon: typeof IconCampaign; search?: Record<string, string> };
type ToolItem = ToolChild & { id: string; children?: ToolChild[] };

const MARKETING_TOOLS: ToolItem[] = [
  { id: "utm", to: "/tools", search: { focus: "utm" }, label: "Combat & Intel", Icon: IconUtm, children: [] },
  { id: "funnel", to: "/tools", search: { focus: "funnel-targets" }, label: "Air Support", Icon: IconFunnel, children: [] },
  { id: "create", to: "/tools/npc-shop", label: "NPC Shop", Icon: IconImport, children: [] },
  { id: "faction", to: "/war-room", label: "Faction Hub", Icon: IconWorkspace, children: [] },
  { id: "perks", to: "/economy", label: "Credits Economy", Icon: IconChart, children: [] },
];

function AppShell() {
  const { session, loading } = useAuth();
  const loc = useLocation();
  const nav = useNavigate();
  const pathnameRef = useRef(loc.pathname);
  useEffect(() => { pathnameRef.current = loc.pathname; }, [loc.pathname]);
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => { purgeExpiredDrafts(); }, []);
  useEffect(() => {
    if (!loading && !session) nav({ to: "/login", search: { redirect: pathnameRef.current, mode: "signin", error: undefined }, replace: true });
  }, [loading, session, nav]);
  const hideMesh = loc.pathname.startsWith("/tools");
  if (loading || !session) {
    return (
      <div className="relative flex min-h-dvh items-center justify-center bg-black">
        <div className="relative z-10 text-sm text-muted-foreground">{loading ? `Booting ${BRAND.name}` : "Redirecting to sign in"}</div>
      </div>
    );
  }
  return (
    <div className={`relative min-h-screen text-foreground ${hideMesh ? "bg-black" : "bg-[color:var(--color-ink)]"}`}>
      {!hideMesh && <GradientMesh />}
      <div className="relative z-10 flex min-h-screen">
        <aside className={`sticky top-0 hidden h-screen shrink-0 self-start overflow-y-auto border-r border-glass-border bg-black/20 backdrop-blur-xl md:flex md:flex-col ${collapsed ? "w-16" : "w-64"}`}>
          <div className={`flex items-center ${collapsed ? "justify-center px-1" : "justify-between gap-1 px-4"} py-5`}>
            <Link to="/" className="flex min-w-0 items-center gap-2 text-foreground">
              <BrandHexLogo size={collapsed ? 32 : 34} />
              {!collapsed && <span className="font-display text-base tracking-tight truncate">{BRAND.name}</span>}
            </Link>
            {!collapsed && (
              <button onClick={() => setCollapsed(true)} aria-label="Collapse sidebar" className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-glass/60">
                <IconChevronLeft size={16} />
              </button>
            )}
          </div>
          {collapsed && (
            <div className="px-2 pb-2">
              <button onClick={() => setCollapsed(false)} aria-label="Expand sidebar" className="inline-flex h-7 w-full items-center justify-center rounded-md text-muted-foreground hover:bg-glass/60">
                <IconChevronRight size={16} />
              </button>
            </div>
          )}
          {!collapsed && <div className="px-3 pb-2"><SidebarSearch /></div>}
          <nav className={`flex-1 space-y-1 ${collapsed ? "px-2" : "px-3"}`}>
            {PRIMARY_NAV.map((n) => {
              const active = n.to === "/tools" ? loc.pathname.startsWith("/tools") : loc.pathname.startsWith(n.to);
              return (
                <Link key={n.label} to={n.to} preload="intent" title={collapsed ? n.label : undefined} className={`relative flex items-center ${collapsed ? "justify-center px-0" : "gap-3 px-3"} rounded-xl py-2.5 text-sm ${active ? "bg-glass text-foreground" : "text-muted-foreground hover:bg-glass/50 hover:text-foreground"}`}>
                  <n.Icon size={18} />
                  {!collapsed && <span>{n.label}</span>}
                </Link>
              );
            })}
            <div className="pt-4">
              <Link to="/settings" className={`flex items-center ${collapsed ? "justify-center px-0" : "gap-3 px-3"} rounded-xl py-2.5 text-sm ${loc.pathname.startsWith("/settings") ? "bg-glass text-foreground" : "text-muted-foreground hover:bg-glass/50"}`}>
                <GoldSettings size={18} />
                {!collapsed && <span>Settings</span>}
              </Link>
            </div>
          </nav>
          {COMMANDER_ENABLED && (
            <div className={`${collapsed ? "m-2" : "m-3"}`}>
              <button onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))} className={`flex w-full items-center ${collapsed ? "justify-center" : "gap-2 px-3"} rounded-xl border border-glass-border bg-glass/40 py-2.5 text-sm text-muted-foreground`}>
                <CommanderOrb size={18} />
                {!collapsed && <span className="font-display">Ask {BRAND.shortName} AI</span>}
              </button>
            </div>
          )}
        </aside>
        {COMMANDER_ENABLED ? <CommanderAI /> : <CommandPalette />}
        <main className="min-w-0 flex-1 overflow-x-hidden pb-[calc(env(safe-area-inset-bottom)+5rem)] md:pb-0">
          <header className="sticky top-0 z-30 flex items-center justify-between border-b border-glass-border bg-black/50 px-4 py-3 backdrop-blur-xl md:hidden">
            <Link to="/dashboard" className="flex items-center gap-2"><BrandHexLogo size={26} /><span className="font-display">{BRAND.name}</span></Link>
          </header>
          <div className="pointer-events-none fixed right-4 top-3 z-40 flex items-center gap-2 md:right-5 md:top-4">
            <div className="pointer-events-auto hidden md:block"><AutosaveStatus /></div>
            <div className="pointer-events-auto"><OnboardingChecklist variant="pill" /></div>
            <div className="pointer-events-auto"><UserMenu /></div>
          </div>
          <div className={`mx-auto w-full pb-10 pt-6 md:pt-20 ${loc.pathname === "/tools" ? "max-w-full px-0" : "max-w-6xl px-4 sm:px-6"}`}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={loc.pathname}
                initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
                transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
      <BottomNav />
      <RouteProgressBar />
      <GuidedTour />
    </div>
  );
}

function SidebarSearch() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const flat = useMemo(() => MARKETING_TOOLS.flatMap((t) => [{ label: t.label, to: t.to, search: t.search, Icon: t.Icon, parent: null as string | null }, ...(t.children ?? []).map((c) => ({ label: c.label, to: c.to, search: c.search, Icon: c.Icon, parent: t.label }))]), []);
  const ql = q.trim().toLowerCase();
  const hits = useMemo(() => (ql ? flat.filter((x) => x.label.toLowerCase().includes(ql) || (x.parent ?? "").toLowerCase().includes(ql)) : []), [flat, ql]);
  const go = (h: (typeof flat)[number]) => { setQ(""); setOpen(false); navigate({ to: h.to as never, search: (h.search ?? {}) as never }); };
  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-lg border border-glass-border bg-glass/40 px-2.5 py-1.5 text-sm text-muted-foreground">
        <IconSearch size={14} />
        <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 120)} onKeyDown={(e) => { if (e.key === "Enter" && hits[0]) { e.preventDefault(); go(hits[0]); } }} placeholder="Search tools…" className="w-full bg-transparent outline-none" />
      </div>
      <AnimatePresence>
        {open && ql && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-auto rounded-lg border border-glass-border bg-black/80 p-1">
            {hits.length === 0 ? <div className="px-3 py-2 text-xs text-muted-foreground">No matches</div> : hits.map((h, i) => (
              <button key={`${h.to}-${h.label}-${i}`} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => go(h)} className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-muted-foreground hover:text-foreground">
                <h.Icon size={14} /><span className="flex-1 truncate">{h.label}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
