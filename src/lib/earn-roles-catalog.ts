export type EarnRole = {
  key: string;
  name: string;
  challenge: string;
};

export const EARN_ROLES: EarnRole[] = [
  { key: "fresh_meat", name: "Fresh Meat", challenge: "Link PSN and join 101x or 102x." },
  { key: "survivor", name: "Survivor", challenge: "3 sessions without combat log." },
  { key: "hardened", name: "Hardened", challenge: "10 hours on the cluster." },
  { key: "iron", name: "Iron", challenge: "25 hours on the cluster." },
  { key: "blooded", name: "Blooded", challenge: "First confirmed player kill." },
  { key: "hunter", name: "Hunter", challenge: "10 player kills." },
  { key: "slayer", name: "Slayer", challenge: "25 player kills." },
  { key: "reaper", name: "Reaper", challenge: "50 player kills." },
  { key: "executioner", name: "Executioner", challenge: "100 player kills." },
  { key: "medic", name: "Field Medic", challenge: "Revive / kit 5 teammates." },
  { key: "builder", name: "Builder", challenge: "Flagged base 4+ walls." },
  { key: "architect", name: "Architect", challenge: "Two flagged bases." },
  { key: "raider", name: "Raider", challenge: "Take a contested base." },
  { key: "siege", name: "Siege", challenge: "Win 3 raids." },
  { key: "trader", name: "Trader", challenge: "Spend 5,000 cr in shops." },
  { key: "magnate", name: "Magnate", challenge: "Spend 25,000 cr." },
  { key: "operator", name: "Operator", challenge: "Deploy an Operator NPC pack." },
  { key: "battalion", name: "Battalion", challenge: "Use 50 NPC charges." },
  { key: "livonia", name: "Livonia Scout", challenge: "Marked POI on 101x." },
  { key: "chernarus", name: "Chernarus Scout", challenge: "Marked POI on 102x." },
  { key: "night_owl", name: "Night Owl", challenge: "Online after 01:00 CEST x3." },
  { key: "pilot", name: "Pilot", challenge: "Heli crash or airdrop proof." },
  { key: "ghost", name: "Ghost", challenge: "Contract with no killfeed that day." },
  { key: "warlord", name: "Warlord", challenge: "Win a community event." },
  { key: "legend", name: "Legend", challenge: "Hold Hunter + Slayer + Reaper." },
  { key: "inner", name: "Inner Circle", challenge: "30 days clean + staff nom." },
  { key: "asylum", name: "Asylum", challenge: "Command only." },
  { key: "donor", name: "Patron", challenge: "Support pack on the hub." },
  { key: "scout", name: "Scout", challenge: "Complete 5 recon contracts." },
  { key: "courier", name: "Courier", challenge: "Complete 5 supply contracts." },
  { key: "marksman", name: "Marksman", challenge: "Long-range confirmed kill." },
  { key: "unbroken", name: "Unbroken", challenge: "No bans / kicks for 14 days." },
];
