/**
 * Registry of tools that can open INLINE inside the Tools hub as a focused
 * side panel (driven by ?focus=<slug>) instead of routing to a full page.
 */

import type { ComponentType, MouseEvent, ReactNode } from "react";
import { useState } from "react";
import { toast } from "sonner";
import { UtmBuilderContent } from "@/routes/_app/tools/utm";
import { AllUtmsContent } from "@/routes/_app/tools/all-utms";
import { TaxonomyContent } from "@/routes/_app/tools/taxonomy";
import { FunnelPageContent } from "@/routes/_app/funnel";
import { FunnelTargetsContent } from "@/routes/_app/tools/funnel-targets";
import { CampaignInABoxContent } from "@/routes/_app/tools/campaign-in-a-box";
import { CampaignCreatorContent } from "@/routes/_app/tools/campaign-creator";
import { NPCShopContent } from "@/routes/_app/tools/npc-shop-content";
import { CampaignPerformanceContent, CampaignPerformanceSummary } from "@/routes/_app/tools/campaign-performance";
import { EventsContent } from "@/routes/_app/tools/events";
import { FactionHubContent } from "@/routes/_app/tools/event-intake";
import { ListCleanerContent } from "@/routes/_app/tools/list-cleaner";
import {
  IconUtm,
  IconSpark,
  IconScroll,
  IconCampaign,
  IconFunnel,
  IconChart,
  IconImport,
  IconCalendar,
} from "@/components/ui-custom/CustomIcon";

export type FocusedTool = {
  slug: string;
  primaryId: string;
  title: string;
  hue: number;
  icon: ReactNode;
  fullRouteTo: string;
  Component: ComponentType<{ hideHeader?: boolean; hideSummary?: boolean }>;
  Summary?: ComponentType;
  width?: string;
  parentTitle?: string;
  parentHue?: number;
  parentIcon?: ReactNode;
};

const ZOMBIE_TYPES = [
  { id: "military", label: "Military infected", detail: "Barracks, checkpoints, and armed zones" },
  { id: "civilian", label: "Civilian infected", detail: "Towns, homes, and roadside settlements" },
  { id: "industrial", label: "Industrial infected", detail: "Factories, warehouses, and rail yards" },
  { id: "special", label: "Special infected", detail: "Elite outbreak variants for high-risk zones" },
] as const;

const HORDE_PACKS = [
  { amount: 15, price: 10_000 },
  { amount: 25, price: 30_000 },
  { amount: 35, price: 40_000 },
] as const;

function ZombieHordesContent() {
  const [map, setMap] = useState<"chernarus" | "livonia">("chernarus");
  const [zombieType, setZombieType] = useState<(typeof ZOMBIE_TYPES)[number]["id"]>("military");
  const [amount, setAmount] = useState<15 | 25 | 35>(15);
  const [location, setLocation] = useState<{ x: number; y: number } | null>(null);
  const selectedPack = HORDE_PACKS.find((pack) => pack.amount === amount) ?? HORDE_PACKS[0];
  const selectedType = ZOMBIE_TYPES.find((type) => type.id === zombieType) ?? ZOMBIE_TYPES[0];
  const pickLocation = (event: MouseEvent<HTMLButtonElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    setLocation({
      x: Math.round(((event.clientX - bounds.left) / bounds.width) * 1000),
      y: Math.round(((event.clientY - bounds.top) / bounds.height) * 1000),
    });
  };
  const deployHorde = () => {
    if (!location) {
      toast.error("Choose a location on the map first");
      return;
    }
    toast.success("Horde deployment queued", {
      description: `${amount} ${selectedType.label.toLowerCase()} on ${map === "chernarus" ? "Chernarus" : "Livonia"} at ${location.x} x ${location.y}. Cost: ${selectedPack.price.toLocaleString()} credits.`,
    });
  };
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Zombie Hordes</div>
          <h1 className="mt-1 font-display text-3xl">Deploy an outbreak</h1>
        </div>
      </div>
    </div>
  );
}

export const FOCUSED_TOOLS: Record<string, FocusedTool> = {
  "zombie-hordes": { slug: "zombie-hordes", primaryId: "server-events", title: "Zombie Hordes", hue: 52, icon: <IconSpark size={22} />, fullRouteTo: "/tools", Component: ZombieHordesContent },
  utm: { slug: "utm", primaryId: "utm", title: "Combat & Intel", hue: 275, icon: <IconUtm size={22} />, fullRouteTo: "/tools/utm", Component: UtmBuilderContent },
  "utm-campaign-name": { slug: "utm-campaign-name", primaryId: "utm", title: "Combat & Intel", hue: 275, icon: <IconUtm size={22} />, fullRouteTo: "/tools/utm", Component: UtmBuilderContent },
  "utm-taxonomy": { slug: "utm-taxonomy", primaryId: "utm", title: "Bounties", hue: 275, icon: <IconSpark size={22} />, fullRouteTo: "/tools/taxonomy", Component: TaxonomyContent, parentTitle: "Combat & Intel", parentHue: 275, parentIcon: <IconUtm size={22} /> },
  "utm-all": { slug: "utm-all", primaryId: "utm", title: "UAV Tracking", hue: 275, icon: <IconScroll size={22} />, fullRouteTo: "/tools/all-utms", Component: AllUtmsContent, parentTitle: "Combat & Intel", parentHue: 275, parentIcon: <IconUtm size={22} /> },
  funnel: { slug: "funnel", primaryId: "funnel", title: "Air Support", hue: 200, icon: <IconFunnel size={22} />, fullRouteTo: "/tools/funnel-targets", Component: FunnelPageContent },
  campaign: { slug: "campaign", primaryId: "campaign", title: "Base Ops", hue: 150, icon: <IconCampaign size={22} />, fullRouteTo: "/tools/campaign-in-a-box", Component: CampaignInABoxContent },
  "funnel-performance": { slug: "funnel-performance", primaryId: "funnel", title: "Strafe Runs", hue: 200, icon: <IconChart size={22} />, fullRouteTo: "/tools/campaign-performance", Component: CampaignPerformanceContent, Summary: CampaignPerformanceSummary, parentTitle: "Air Support", parentHue: 200, parentIcon: <IconFunnel size={22} /> },
  "funnel-targets": { slug: "funnel-targets", primaryId: "funnel", title: "Precision Strikes", hue: 200, icon: <IconSpark size={22} />, fullRouteTo: "/tools/funnel-targets", Component: FunnelTargetsContent, parentTitle: "Air Support", parentHue: 200, parentIcon: <IconFunnel size={22} /> },
  "campaign-creator": { slug: "campaign-creator", primaryId: "campaign", title: "Base Protection", hue: 150, icon: <IconCampaign size={22} />, fullRouteTo: "/tools/campaign-creator", Component: CampaignCreatorContent, parentTitle: "Base Ops", parentHue: 150, parentIcon: <IconCampaign size={22} /> },
  "campaign-import": { slug: "campaign-import", primaryId: "campaign", title: "NPC Maker", hue: 150, icon: <IconImport size={22} />, fullRouteTo: "/tools/npc-shop", Component: NPCShopContent, parentTitle: "Base Ops", parentHue: 150, parentIcon: <IconCampaign size={22} /> },
  "campaign-events": { slug: "campaign-events", primaryId: "campaign", title: "Battlepass", hue: 150, icon: <IconCalendar size={22} />, fullRouteTo: "/tools/events", Component: EventsContent, parentTitle: "Base Ops", parentHue: 150, parentIcon: <IconCampaign size={22} /> },
  "campaign-performance": { slug: "campaign-performance", primaryId: "campaign", title: "Strafe Runs", hue: 150, icon: <IconChart size={22} />, fullRouteTo: "/tools/campaign-performance", Component: CampaignPerformanceContent, Summary: CampaignPerformanceSummary, parentTitle: "Base Ops", parentHue: 150, parentIcon: <IconCampaign size={22} /> },
  "faction-hub": { slug: "faction-hub", primaryId: "campaign", title: "Faction Hub", hue: 145, icon: <IconCampaign size={22} />, fullRouteTo: "/tools/event-intake", Component: FactionHubContent },
  "campaign-list-cleaner": { slug: "campaign-list-cleaner", primaryId: "campaign", title: "Counter-UAV", hue: 150, icon: <IconSpark size={22} />, fullRouteTo: "/tools/list-cleaner", Component: ListCleanerContent, parentTitle: "Base Ops", parentHue: 150, parentIcon: <IconCampaign size={22} /> },
};

export function getFocusedTool(slug: string | undefined | null): FocusedTool | null {
  if (!slug) return null;
  if (slug === "campaign-hackathon") return FOCUSED_TOOLS["faction-hub"] ?? null;
  return FOCUSED_TOOLS[slug] ?? null;
}

export const SATELLITE_TO_FOCUS_SLUG: Record<string, string> = {
  name: "utm",
  "utm-all": "utm-all",
  tax: "utm-taxonomy",
  counter: "campaign-list-cleaner",
  board: "funnel-performance",
  perf2: "funnel-performance",
  gas: "funnel-performance",
  targeting: "funnel",
  targets: "funnel-targets",
  events: "campaign-events",
  bases: "campaign",
  creator: "campaign-creator",
  import: "campaign-import",
};

export const FOCUSED_PRIMARY_IDS = new Set(
  Object.values(FOCUSED_TOOLS).map((t) => t.primaryId),
);
