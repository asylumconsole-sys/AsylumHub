import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/contexts/AuthContext";
import { GlassPanel } from "@/components/ui-custom/GlassPanel";
import { IconLogout, IconSettings } from "@/components/ui-custom/CustomIcon";
import { PageHexBadge } from "@/components/app/PageHexBadge";
import { ThemeToggle } from "@/components/ui-custom/ThemeToggle";
import { TOUR_PREF_KEY } from "@/components/tour/tour-steps";

export const Route = createFileRoute("/_app/settings")({
  component: Settings,
});

function Settings() {
  const { user, signOut } = useAuth();
  const email = user?.email ?? "";
  const name = email || "Signed in";
  return (
    <div className="space-y-6 pb-16">
      <div className="flex items-start gap-4">
        <PageHexBadge hue={88} size={26} icon={<IconSettings size={22} />} aria-label="Settings" />
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Settings</div>
          <h1 className="mt-1 font-display text-4xl tracking-tight">Account</h1>
          <p className="mt-2 text-sm text-muted-foreground">Theme, sign out, and the 2-minute tour.</p>
        </div>
      </div>
      <GlassPanel className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Signed in</div>
            <div className="mt-1 font-display text-xl">{name}</div>
          </div>
          <button type="button" onClick={() => void signOut()} className="inline-flex items-center gap-2 rounded-full border border-glass-border px-4 py-2 text-sm">
            <IconLogout size={14} /> Sign out
          </button>
        </div>
      </GlassPanel>
      <GlassPanel className="flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Appearance</div>
          <div className="mt-2 font-display text-lg">Light, dark, or Halloween</div>
        </div>
        <ThemeToggle />
      </GlassPanel>
      <GlassPanel className="flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Guided tour</div>
          <div className="mt-2 font-display text-lg">Replay the 2-minute tour</div>
          <p className="mt-1 text-sm text-muted-foreground">Walks Lobby, Servers, Operations, Map, Shop, War Room, Challenges, Rewards, Battlepass, Locker, Settings.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            try { localStorage.removeItem(TOUR_PREF_KEY); } catch { /* ignore */ }
            window.dispatchEvent(new Event("lovable:start-tour"));
          }}
          className="rounded-full border border-primary/40 bg-primary/10 px-4 py-2 text-sm text-primary"
        >
          Replay tour
        </button>
      </GlassPanel>
    </div>
  );
}
