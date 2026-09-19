/**
 * Registry of tools that can open INLINE inside the Tools hub as a focused
 * side panel (driven by ?focus=<slug>) instead of routing to a full page.
 *
 * Each entry maps to a primary hex's `id` in HexToolsTree so the click on a
 * primary opens its panel and the same hex stays highlighted on the left.
 *
 * Satellite tools share their parent's primaryId so the hex tree keeps the
 * parent hex highlighted, and they expose a `parentTitle` so the page
 * header can show the parent name big with the satellite name as a
 * subtitle below it.
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
