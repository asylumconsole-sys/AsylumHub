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
    id: "link-account",
    route: "/account",
    target: '[data-tour="psn-link"]',
    eyebrow: "2-minute tour",
    title: "Link your account first.",
    body: "Type your PSN or Xbox gamertag and hit Link. Linking unlocks auto NPC spawns on your tag, the right credit wallet, killfeed stats, shop drops, and faction intel. It also changes your Discord nickname to that gamertag. You can change the nickname later in Settings for 1,000 CR.",
    placement: "bottom",
    openTo: "/account",
  },
  {
    id: "welcome",
    route: "/dashboard",
    eyebrow: "2-minute tour",
    title: "This is DAYZ PRO.",
    body: "Lobby is home. The left menu is every tool. Donate is under Settings. Killfeed is the last 5 days of PvP. Use arrows to move, Esc to skip.",
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
    body: "Credits, who's online, and the scrolling killfeed. Start here after every login.",
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
    body: "Server jobs, events, and admin work land here.",
    placement: "right",
  },
  {
    id: "nav-shop",
    route: "/dashboard",
    target: '[data-tour="nav-/tools"]',
    context: SIDEBAR,
    openTo: "/tools",
    eyebrow: "Shop",
    title: "Spend credits.",
    body: "NPC packs, items, Base Ops, Pro Build, and the donator Black Market.",
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
    body: "Flags, faction boards, kills, playtime, and reputation.",
    placement: "right",
  },
  {
    id: "nav-settings",
    route: "/dashboard",
    target: '[data-tour="nav-/settings"]',
    context: SIDEBAR,
    openTo: "/settings",
    eyebrow: "Settings",
    title: "Nickname later.",
    body: "Change the Discord nickname that came from your linked tag here for 1,000 CR. Replay this tour anytime.",
    placement: "right",
  },
  {
    id: "done",
    route: "/dashboard",
    eyebrow: "You're set",
    title: "Go play.",
    body: "Account linked, tour done. Shop for kits, War Room for factions, Map for coords.",
    placement: "center",
  },
];

export const TOUR_PREF_KEY = "tour_v3_link";
