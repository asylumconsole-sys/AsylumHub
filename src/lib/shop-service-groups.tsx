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

function tile(label: string, a: string, b: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 180"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="360" height="180" fill="url(#g)"/><rect x="150" y="0" width="210" height="36" fill="#e11d2e"/><text x="168" y="24" fill="#fff" font-size="16" font-family="Arial Black, sans-serif">${label}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export type ShopGroup = {
  name: string;
  description: string;
  hue: number;
  image: string;
  icon: ReactNode;
  items: { label: string; focus: string; icon: ReactNode }[];
};

export const ADDON_GROUPS: ShopGroup[] = [
  {
    name: "Priority Queue",
    description: "Skip the line and keep your faction ahead of the pack.",
    hue: 48,
    image: tile("PRIORITY", "#3a2a10", "#d4a84b"),
    icon: <IconBolt size={20} />,
    items: [{ label: "Priority Queue", focus: "priority-queue", icon: <IconBolt size={16} /> }],
  },
  {
    name: "Boosts",
    description: "Faction-only boosts: double XP, double CR, and double reputation.",
    hue: 318,
    image: tile("BOOSTS", "#4a1230", "#d45a8c"),
    icon: <IconSpark size={20} />,
    items: [
      { label: "Double XP", focus: "boosts", icon: <IconSpark size={16} /> },
      { label: "Double CR", focus: "boosts", icon: <IconUtm size={16} /> },
    ],
  },
];

export const SERVICE_GROUPS: ShopGroup[] = [
  {
    name: "Combat & Intel",
    description: "Track movement, bounties, killfeed, and server intelligence.",
    hue: 205,
    image: tile("INTEL", "#1b3a22", "#6b8f3a"),
    icon: <IconUtm size={20} />,
    items: [
      { label: "Intel & Defense", focus: "utm", icon: <IconUtm size={16} /> },
      { label: "UAV", focus: "utm-all", icon: <IconScroll size={16} /> },
      { label: "Bounties", focus: "utm-taxonomy", icon: <IconSpark size={16} /> },
    ],
  },
  {
    name: "Air Support",
    description: "Call in strikes and coordinate precision operations.",
    hue: 200,
    image: tile("FIRE SUPPORT", "#c9b52a", "#7a3b12"),
    icon: <IconFunnel size={20} />,
    items: [
      { label: "Fire Support", focus: "funnel-targets", icon: <IconFunnel size={16} /> },
      { label: "Precision Strikes", focus: "funnel-targets", icon: <IconSpark size={16} /> },
    ],
  },
  {
    name: "Base Ops",
    description: "Protect bases, manage territory, and broadcast raid events.",
    hue: 35,
    image: "/baseops.jpg",
    icon: <IconCampaign size={20} />,
    items: [
      { label: "Custom Bases", focus: "campaign", icon: <IconCampaign size={16} /> },
      { label: "Raid Announcements", focus: "campaign-events", icon: <IconCalendar size={16} /> },
    ],
  },
  {
    name: "NPC Shop",
    description: "Buy spawn charges and deploy roster operators.",
    hue: 285,
    image: tile("NPC SPAWNS", "#2a2a2a", "#6a6a6a"),
    icon: <IconImport size={20} />,
    items: [{ label: "NPC Spawns", focus: "campaign-import", icon: <IconImport size={16} /> }],
  },
  {
    name: "NPC Maker",
    description: "Build a custom operator: skin, weapons, gear, handcuffs, export.",
    hue: 42,
    image: tile("NPC MAKER", "#1a1408", "#d4a84b"),
    icon: <IconImport size={20} />,
    items: [{ label: "NPC Maker", focus: "npc-maker", icon: <IconImport size={16} /> }],
  },
  {
    name: "Vehicle Shop",
    description: "Deploy transport, utility rigs, and armored recon vehicles.",
    hue: 122,
    image: tile("VEHICLES", "#c4a032", "#3d4a1a"),
    icon: <IconCampaign size={20} />,
    items: [{ label: "Vehicles", focus: "vehicle-shop", icon: <IconCampaign size={16} /> }],
  },
  {
    name: "Zombie Hordes",
    description: "Survive outbreaks, claim horde rewards, and support the fight.",
    hue: 52,
    image: "/zombie.jpg",
    icon: <IconChart size={20} />,
    items: [{ label: "Zombie Hordes", focus: "zombie-hordes", icon: <IconSpark size={16} /> }],
  },
];
