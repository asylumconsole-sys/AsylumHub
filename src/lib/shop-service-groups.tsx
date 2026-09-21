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

export const SERVICE_GROUPS: {
  name: string;
  description: string;
  hue: number;
  image: string;
  icon: ReactNode;
  items: { label: string; focus: string; icon: ReactNode }[];
}[] = [
  {
    name: "Combat & Intel",
    description: "Track movement, bounties, killfeed, and server intelligence.",
    hue: 205,
    image: "/shop/intel-defense.jpg",
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
    image: "/shop/fire-support.jpg",
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
    description: "Build NPCs, recruit survivors, and manage custom server content.",
    hue: 285,
    image: "/shop/npc-spawns.jpg",
    icon: <IconImport size={20} />,
    items: [{ label: "NPC Spawns", focus: "campaign-import", icon: <IconImport size={16} /> }],
  },
  {
    name: "Vehicle Shop",
    description: "Deploy transport, utility rigs, and armored recon vehicles.",
    hue: 122,
    image: "/shop/vehicles.jpg",
    icon: <IconCampaign size={20} />,
    items: [{ label: "Vehicles", focus: "vehicle-shop", icon: <IconCampaign size={16} /> }],
  },
  {
    name: "Factions",
    description: "War room, flags, and faction standings.",
    hue: 18,
    image: "/factions.jpg",
    icon: <IconCampaign size={20} />,
    items: [{ label: "Factions", focus: "faction-hub", icon: <IconCampaign size={16} /> }],
  },
  {
    name: "Priority Queue",
    description: "Skip the line and keep your faction ahead of the pack.",
    hue: 48,
    image: "/shop/item-shop.jpg",
    icon: <IconBolt size={20} />,
    items: [{ label: "Priority Queue", focus: "campaign-events", icon: <IconBolt size={16} /> }],
  },
  {
    name: "Boosts",
    description: "Faction-only boosts: double XP, double CR, and double reputation.",
    hue: 318,
    image: "/shop/item-shop.jpg",
    icon: <IconSpark size={20} />,
    items: [
      { label: "Double XP", focus: "boosts", icon: <IconSpark size={16} /> },
      { label: "Double CR", focus: "boosts", icon: <IconUtm size={16} /> },
    ],
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
