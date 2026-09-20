export type EarnRole = { key: string; name: string; challenge: string; color: number };

export const EARN_ROLES: EarnRole[] = [
  { key: "fresh_meat", name: "Fresh Meat", challenge: "Link PSN and join a server", color: 0x9ca3af },
  { key: "survivor", name: "Survivor", challenge: "3 clean sessions", color: 0x22c55e },
  { key: "hardened", name: "Hardened", challenge: "10 hours on the cluster", color: 0x16a34a },
  { key: "blooded", name: "Blooded", challenge: "First player kill", color: 0xdc2626 },
  { key: "hunter", name: "Hunter", challenge: "10 player kills", color: 0xef4444 },
  { key: "slayer", name: "Slayer", challenge: "25 player kills", color: 0xb91c1c },
  { key: "medic", name: "Field Medic", challenge: "Revive or kit 5 teammates", color: 0xf43f5e },
  { key: "builder", name: "Builder", challenge: "Flagged base, 4+ walls", color: 0xa16207 },
  { key: "raider", name: "Raider", challenge: "Take a contested base", color: 0xea580c },
  { key: "trader", name: "Trader", challenge: "Spend 5,000 cr", color: 0xeab308 },
  { key: "operator", name: "Operator", challenge: "Deploy an Operator NPC pack", color: 0x0ea5e9 },
  { key: "livonia", name: "Livonia Scout", challenge: "Marked POI on 101x", color: 0x65a30d },
  { key: "chernarus", name: "Chernarus Scout", challenge: "Marked POI on 102x", color: 0x4d7c0f },
  { key: "night_owl", name: "Night Owl", challenge: "3 late-night sessions", color: 0x6366f1 },
  { key: "pilot", name: "Pilot", challenge: "Heli crash or airdrop", color: 0x7c3aed },
  { key: "ghost", name: "Ghost", challenge: "Contract with no killfeed", color: 0x64748b },
  { key: "warlord", name: "Warlord", challenge: "Win a community event", color: 0xc026d3 },
  { key: "unbroken", name: "Unbroken", challenge: "14 days with no ban", color: 0xf8fafc },
  { key: "inner", name: "Inner Circle", challenge: "Staff nomination", color: 0xf97316 },
  { key: "asylum", name: "Asylum", challenge: "Command only", color: 0x111827 },
];
