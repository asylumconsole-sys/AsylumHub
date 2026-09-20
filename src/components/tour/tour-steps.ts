export type TourStep = {
  id: string;
  route: string;
  target?: string;
  context?: string;
  eyebrow: string;
  title: string;
  body: string;
  openTo?: string;
  placement?: "bottom" | "top" | "right" | "left" | "center";
  expandTools?: boolean;
};

const SIDEBAR = '[data-tour="sidebar"]';

export const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    route: "/dashboard",
    eyebrow: "2-minute tour",
    title: "This is DAYZ PRO.",
    body: "Lobby is home. The left menu is every tool. Donate is top-right. Killfeed is the last 5 days of PvP from Discord. Use arrows to move, Esc to skip.",
    placement: "center",
  },
  {
    id: "nav-lobby",
    route: "/dashboard",
    target: '[data-tour="nav-/dashboard"]',
    context: SIDEBAR,
    openTo: "/dashboard",
    eyebrow: "Lobby",
    title: "Command hall.",
    body: "Credits, who's online, and the scrolling killfeed. Donate sits on this page. Start here after every login.",
    placement: "right",
  },
  {
    id: "nav-servers",
    route: "/dashboard",
    target: '[data-tour="nav-/servers"]',
    context: SIDEBAR,
    openTo: "/servers",
    eyebrow: "Servers",
    title: "101x and 102x status.",
    body: "See if Livonia and Chernarus are up, player counts, and restart state before you drop.",
    placement: "right",
  },
  {
    id: "nav-operations",
    route: "/dashboard",
    target: '[data-tour="nav-/operations"]',
    context: SIDEBAR,
    openTo: "/operations",
    eyebrow: "Operations",
    title: "Contracts and tasks.",
    body: "Server jobs, events, and admin work land here. Open it when you need something done in-game.",
    placement: "right",
  },
  {
    id: "nav-map",
    route: "/dashboard",
    target: '[data-tour="nav-/tools/base-map-clicker"]',
    context: SIDEBAR,
    openTo: "/tools/base-map-clicker",
    eyebrow: "Map",
    title: "Click the map for coords.",
    body: "Pick a point on Livonia or Chernarus for bases, NPC drops, and Pro Build locations.",
    placement: "right",
  },
  {
    id: "nav-shop",
    route: "/dashboard",
    target: '[data-tour="nav-/tools"]',
    context: SIDEBAR,
    openTo: "/tools",
    eyebrow: "Server shop",
    title: "Spend credits.",
    body: "NPC packs, items, Base Ops, Pro Build, and sleeping bags. Everything you buy with hub credits.",
    placement: "right",
  },
  {
    id: "nav-war",
    route: "/dashboard",
    target: '[data-tour="nav-/war-room"]',
    context: SIDEBAR,
    openTo: "/war-room",
    eyebrow: "War Room",
    title: "Factions and wars.",
    body: "Flags, faction boards, kills, playtime, and reputation. This is the faction hub — not a separate Factions page.",
    placement: "right",
  },
  {
    id: "nav-challenges",
    route: "/dashboard",
    target: '[data-tour="nav-/challenges"]',
    context: SIDEBAR,
    openTo: "/challenges",
    eyebrow: "Challenges",
    title: "Zone discovery and more.",
    body: "Visit Livonia city zones and other challenges for credit rewards and Discord pings.",
    placement: "right",
  },
  {
    id: "nav-rewards",
    route: "/dashboard",
    target: '[data-tour="nav-/rewards"]',
    context: SIDEBAR,
    openTo: "/rewards",
    eyebrow: "Rewards",
    title: "Claim what you earned.",
    body: "Credit drops and reward tracks after challenges or events.",
    placement: "right",
  },
  {
    id: "nav-battlepass",
    route: "/dashboard",
    target: '[data-tour="nav-/battlepass"]',
    context: SIDEBAR,
    openTo: "/battlepass",
    eyebrow: "Battlepass",
    title: "Season track.",
    body: "Season 1 is COMING SOON. When it drops, this is the 100-level reward path.",
    placement: "right",
  },
  {
    id: "nav-locker",
    route: "/dashboard",
    target: '[data-tour="nav-/templates"]',
    context: SIDEBAR,
    openTo: "/templates",
    eyebrow: "Locker",
    title: "Saved kits and loadouts.",
    body: "Stored presets and locker items for your character and base kits.",
    placement: "right",
  },
  {
    id: "nav-settings",
    route: "/dashboard",
    target: '[data-tour="nav-/settings"]',
    context: SIDEBAR,
    openTo: "/settings",
    eyebrow: "Settings",
    title: "Your account only.",
    body: "Theme, profile, sign out, and replay this tour. Org / team / server chat were removed.",
    placement: "right",
  },
  {
    id: "done",
    route: "/dashboard",
    eyebrow: "You're set",
    title: "Go play.",
    body: "Open Server shop to spend credits, War Room for factions, Map for coords. Replay the tour from Settings anytime.",
    placement: "center",
  },
];

export const TOUR_PREF_KEY = "tour_v2_dayz";
