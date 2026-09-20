import type { ReactNode } from "react";
import {
  IconBolt,
  IconCalendar,
  IconCampaign,
  IconChart,
  IconFunnel,
  IconImport,
  IconScroll,
  IconSpark,
  IconUtm,
} from "@/components/ui-custom/CustomIcon";

export const SERVICE_GROUPS: { name: string; description: string; hue: number; icon: ReactNode; items: { label: string; focus: string; icon: ReactNode }[] }[] = [
  {
    name: "Combat & Intel",
    description: "Track movement, bounties, killfeed, and server intelligence.",
    hue: 205,
    icon: <IconUtm size={20} />,
    items: [
      { label: "Combat & Intel", focus: "utm", icon: <IconUtm size={16} /> },
      { label: "UAV", focus: "utm-all", icon: <IconScroll size={16} /> },
      { label: "UAV Tracking", focus: "utm-all", icon: <IconScroll size={16} /> },
      { label: "Counter-UAV", focus: "campaign-list-cleaner", icon: <IconSpark size={16} /> },
      { label: "PVP Killfeed", focus: "utm", icon: <IconSpark size={16} /> },
      { label: "Bounties", focus: "utm-taxonomy", icon: <IconSpark size={16} /> },
      { label: "Heatmap", focus: "campaign-list-cleaner", icon: <IconChart size={16} /> },
      { label: "Intel Board", focus: "funnel-performance", icon: <IconChart size={16} /> },
      { label: "Leaderboards", focus: "funnel-performance", icon: <IconChart size={16} /> },
    ],
  },
  {
    name: "Air Support",
    description: "Call in strikes and coordinate precision operations.",
    hue: 200,
    icon: <IconFunnel size={20} />,
    items: [
      { label: "Air Support", focus: "funnel-targets", icon: <IconFunnel size={16} /> },
      { label: "Precision Strikes", focus: "funnel-targets", icon: <IconSpark size={16} /> },
      { label: "Strafe Runs", focus: "funnel-performance", icon: <IconChart size={16} /> },
    ],
  },
  {
    name: "Base Ops",
    description: "Pro Build, sleeping bags, bases, and raid calls.",
    hue: 35,
    icon: <IconCampaign size={20} />,
    items: [
      { label: "Pro Build", focus: "pro-build", icon: <IconCampaign size={16} /> },
      { label: "Sleeping Bags", focus: "sleeping-bags", icon: <IconScroll size={16} /> },
      { label: "Custom Bases", focus: "campaign", icon: <IconCampaign size={16} /> },
      { label: "Raid Announcements", focus: "campaign-events", icon: <IconCalendar size={16} /> },
    ],
  },
  {
    name: "NPC Shop",
    description: "Build NPCs, recruit survivors, and manage custom server content.",
    hue: 285,
    icon: <IconImport size={20} />,
    items: [
      { label: "NPC Shop", focus: "campaign-import", icon: <IconImport size={16} /> },
      { label: "Custom Vehicles", focus: "campaign-events", icon: <IconSpark size={16} /> },
      { label: "Item Shop", focus: "campaign-import", icon: <IconScroll size={16} /> },
    ],
  },
  {
    name: "Vehicle Shop",
    description: "Deploy transport, utility rigs, and armored recon vehicles.",
    hue: 122,
    icon: <IconCampaign size={20} />,
    items: [
      { label: "Vehicle Shop", focus: "vehicle-shop", icon: <IconCampaign size={16} /> },
      { label: "Utility Vehicles", focus: "vehicle-shop", icon: <IconScroll size={16} /> },
      { label: "Combat Vehicles", focus: "vehicle-shop", icon: <IconSpark size={16} /> },
    ],
  },
  {
    name: "Priority Queue",
    description: "Skip the line and keep your faction ahead of the pack.",
    hue: 48,
    icon: <IconBolt size={20} />,
    items: [
      { label: "Priority Queue", focus: "campaign-events", icon: <IconBolt size={16} /> },
      { label: "Fast Track", focus: "campaign-events", icon: <IconSpark size={16} /> },
      { label: "Queue Boost", focus: "campaign-events", icon: <IconChart size={16} /> },
    ],
  },
  {
    name: "Boosts",
    description: "Faction-only boosts: double XP, double CR, and double reputation.",
    hue: 318,
    icon: <IconSpark size={20} />,
    items: [
      { label: "Double XP", focus: "boosts", icon: <IconSpark size={16} /> },
      { label: "Double CR", focus: "boosts", icon: <IconUtm size={16} /> },
      { label: "Reputation Boost", focus: "boosts", icon: <IconChart size={16} /> },
    ],
  },
  {
    name: "Zombie Hordes",
    description: "Survive outbreaks, claim horde rewards, and support the fight.",
    hue: 52,
    icon: <IconChart size={20} />,
    items: [{ label: "Zombie Hordes", focus: "zombie-hordes", icon: <IconSpark size={16} /> }],
  },
];
