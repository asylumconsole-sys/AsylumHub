export type EarnRole = { key: string; name: string; challenge: string };

function ranks(prefix: string, label: string, challenge: (n: number) => string, count: number): EarnRole[] {
  return Array.from({ length: count }, (_, i) => {
    const n = i + 1;
    return { key: `${prefix}_${n}`, name: `${label} ${n}`, challenge: challenge(n) };
  });
}

export const EARN_ROLES: EarnRole[] = [
  ...ranks("surv", "Survivor", (n) => `${n * 3} hours survived`, 10),
  ...ranks("kill", "Kills", (n) => `${n * 10} player kills`, 10),
  ...ranks("trade", "Trader", (n) => `Spend ${n * 5000} cr`, 8),
  ...ranks("build", "Builder", (n) => `${n} flagged base${n > 1 ? "s" : ""}`, 6),
  ...ranks("raid", "Raider", (n) => `${n} successful raid${n > 1 ? "s" : ""}`, 6),
  ...ranks("npc", "NPC", (n) => `${n * 10} NPC charges used`, 6),
  ...ranks("recon", "Recon", (n) => `${n * 2} recon contracts`, 5),
  ...ranks("supply", "Courier", (n) => `${n * 2} supply contracts`, 5),
  ...ranks("night", "Night Owl", (n) => `${n} late-night sessions`, 4),
  ...ranks("event", "Event", (n) => `${n} community event${n > 1 ? "s" : ""}`, 5),
  { key: "fresh_meat", name: "Fresh Meat", challenge: "Link PSN + join a server" },
  { key: "blooded", name: "Blooded", challenge: "First player kill" },
  { key: "medic", name: "Field Medic", challenge: "Revive / kit 5" },
  { key: "pilot", name: "Pilot", challenge: "Heli or airdrop" },
  { key: "ghost", name: "Ghost", challenge: "Contract, no killfeed" },
  { key: "livonia", name: "Livonia Scout", challenge: "101x marked POI" },
  { key: "chernarus", name: "Chernarus Scout", challenge: "102x marked POI" },
  { key: "marksman", name: "Marksman", challenge: "Long-range kill" },
  { key: "unbroken", name: "Unbroken", challenge: "14 days clean" },
  { key: "warlord", name: "Warlord", challenge: "Win a war-room op" },
  { key: "legend", name: "Legend", challenge: "Hold Kills 5+" },
  { key: "inner", name: "Inner Circle", challenge: "Staff nominate" },
  { key: "asylum", name: "Asylum", challenge: "Command only" },
  { key: "patron", name: "Patron", challenge: "Support pack" },
  { key: "architect", name: "Architect", challenge: "Builder 6 done" },
  { key: "siege", name: "Siege", challenge: "Raider 6 done" },
  { key: "magnate", name: "Magnate", challenge: "Trader 8 done" },
  { key: "battalion", name: "Battalion", challenge: "NPC 6 done" },
  { key: "executioner", name: "Executioner", challenge: "Kills 10 done" },
  { key: "iron", name: "Iron", challenge: "Survivor 10 done" },
];
