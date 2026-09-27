import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { GlassPanel } from "@/components/ui-custom/GlassPanel";
import { IconCampaign, IconChevronLeft } from "@/components/ui-custom/CustomIcon";
import { PageHexBadge } from "@/components/app/PageHexBadge";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/_app/tools/campaign-in-a-box")({
  component: () => <CampaignInABoxContent />,
  head: () => ({ meta: [{ title: `Base Ops — ${BRAND.name}` }] }),
});

export function CampaignInABoxContent({ hideHeader = false }: { hideHeader?: boolean } = {}) {
  const navigate = useNavigate();
  return (
    <div className="space-y-8">
      {!hideHeader && (
        <Link to="/tools" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <IconChevronLeft size={14} /> Back to tools
        </Link>
      )}
      {!hideHeader && (
        <header className="flex items-start gap-4">
          <PageHexBadge hue={150} icon={<IconCampaign size={26} />} aria-label="Base Ops" />
          <div><h1 className="font-display text-3xl md:text-4xl">Base Ops</h1></div>
        </header>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <button type="button" onClick={() => navigate({ to: "/tools", search: { focus: "pro-build" } })} className="rounded-2xl border border-primary/40 bg-primary/10 p-6 text-left"><h2 className="font-display text-2xl">Pro Build</h2></button>
        <button type="button" onClick={() => navigate({ to: "/tools", search: { focus: "sleeping-bags" } })} className="rounded-2xl border border-glass-border bg-glass/25 p-6 text-left"><h2 className="font-display text-2xl">Sleeping Bags</h2></button>
        <GlassPanel className="p-6 text-left"><h2 className="font-display text-2xl">Request custom base</h2></GlassPanel>
        <GlassPanel className="border-cyan-400/30 p-6 text-left">
          <div className="text-xs uppercase tracking-[0.18em] text-cyan-200/70">Base Radar</div>
          <h2 className="mt-2 font-display text-2xl">Track your zone</h2>
          <p className="mt-2 text-sm text-muted-foreground">Use the Map page to pick the spot. Zone setup is paused until the map loads without crashing the hub.</p>
        </GlassPanel>
      </div>
    </div>
  );
}
