export type EarnRole = {
  key: string;
  name: string;
  challenge: string;
  reward: string;
  credits: number;
  color: number;
};

export const EARN_ROLES: EarnRole[] = [
  { key: "fresh_meat", name: "Fresh Meat", challenge: "Link PSN on dayzpro.online and join 101x or 102x once.", reward: "Starter tag + 250 cr", credits: 250, color: 0x9ca3af },
  { key: "survivor", name: "Survivor", challenge: "Survive 3 separate sessions without a combat log.", reward: "Survivor tag + 500 cr", credits: 500, color: 0x22c55e },
  { key: "hardened", name: "Hardened", challenge: "Play 10 hours across the cluster.", reward: "Hardened tag + 1,000 cr", credits: 1000, color: 0x16a34a },
  { key: "blooded", name: "Blooded", challenge: "Confirm your first player kill on the killfeed.", reward: "Blooded tag + 750 cr", credits: 750, color: 0xb91c1c },
  { key: "hunter", name: "Hunter", challenge: "10 player kills.", reward: "Hunter tag + 1,500 cr", credits: 1500, color: 0xdc2626 },
  { key: "slayer", name: "Slayer", challenge: "25 player kills.", reward: "Slayer tag + 3,000 cr", credits: 3000, color: 0xef4444 },
  { key: "reaper", name: "Reaper", challenge: "50 player kills.", reward: "Reaper tag + 6,000 cr", credits: 6000, color: 0x7f1d1d },
  { key: "medic", name: "Field Medic", challenge: "Revive or kit 5 teammates in one wipe week.", reward: "Medic tag + 1,200 cr", credits: 1200, color: 0xf43f5e },
  { key: "builder", name: "Builder", challenge: "Finish a flagged base (4+ walls + storage) on either map.", reward: "Builder tag + 2,000 cr", credits: 2000, color: 0xa16207 },
  { key: "raider", name: "Raider", challenge: "Take a contested base or lock a raid window with staff proof.", reward: "Raider tag + 4,000 cr", credits: 4000, color: 0xea580c },
  { key: "trader", name: "Trader", challenge: "Spend 5,000 cr in the item or NPC shop.", reward: "Trader tag + 1,000 cr", credits: 1000, color: 0xeab308 },
  { key: "magnate", name: "Magnate", challenge: "Spend 25,000 cr across shops.", reward: "Magnate tag + 5,000 cr", credits: 5000, color: 0xfacc15 },
  { key: "operator", name: "Operator", challenge: "Buy and deploy an Operator NPC pack.", reward: "Operator tag + 2,500 cr", credits: 2500, color: 0x0ea5e9 },
  { key: "battalion", name: "Battalion", challenge: "Own 50+ NPC spawn charges used on the live map.", reward: "Battalion tag + 7,500 cr", credits: 7500, color: 0x0369a1 },
  { key: "livonia", name: "Livonia Scout", challenge: "Extract a screenshot from 101x Livonia at a marked POI.", reward: "Livonia tag + 800 cr", credits: 800, color: 0x65a30d },
  { key: "chernarus", name: "Chernarus Scout", challenge: "Extract a screenshot from 102x Chernarus at a marked POI.", reward: "Chernarus tag + 800 cr", credits: 800, color: 0x4d7c0f },
  { key: "night_owl", name: "Night Owl", challenge: "Be online after 01:00 CEST on 3 different nights.", reward: "Night Owl tag + 1,000 cr", credits: 1000, color: 0x6366f1 },
  { key: "pilot", name: "Pilot", challenge: "Secure a heli crash or air drop with proof.", reward: "Pilot tag + 2,200 cr", credits: 2200, color: 0x7c3aed },
  { key: "ghost", name: "Ghost", challenge: "Complete a contract without appearing on killfeed that day.", reward: "Ghost tag + 1,800 cr", credits: 1800, color: 0x64748b },
  { key: "warlord", name: "Warlord", challenge: "Win a scheduled community event or war-room op.", reward: "Warlord tag + 8,000 cr", credits: 8000, color: 0xc026d3 },
  { key: "legend", name: "Legend", challenge: "Hold 4 combat roles at once (Blooded + Hunter + Slayer + Reaper path).", reward: "Legend tag + 10,000 cr", credits: 10000, color: 0xf59e0b },
  { key: "inner", name: "Inner Circle", challenge: "Staff-nominated. Consistent play + no ban 30 days.", reward: "Inner Circle tag + 12,000 cr", credits: 12000, color: 0xf97316 },
  { key: "asylum", name: "Asylum", challenge: "Founder / lifetime mark. Awarded by command only.", reward: "Asylum tag", credits: 0, color: 0x111827 },
  { key: "donor", name: "Patron", challenge: "Support pack purchased on the hub.", reward: "Patron tag + 3,000 cr", credits: 3000, color: 0x2dd4bf },
];
