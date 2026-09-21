const STOP = new Set(
  [
    "details",
    "detail",
    "torso",
    "head",
    "neck",
    "brain",
    "arms",
    "arm",
    "legs",
    "leg",
    "hands",
    "hand",
    "feet",
    "pelvis",
    "spine",
    "leftarm",
    "rightarm",
    "leftleg",
    "rightleg",
    "hatchet",
    "axe",
    "knife",
    "hammer",
    "pliers",
    "medic",
    "unknown",
    "player",
    "infected",
    "zombie",
    "survivor",
  ].map((s) => s.toLowerCase()),
);

export function isRealPlayerName(name: string) {
  const raw = name.trim();
  if (raw.length < 3 || raw.length > 32) return false;
  if (STOP.has(raw.toLowerCase())) return false;
  if (/^[\d.]+$/.test(raw)) return false;
  if (!/[a-zA-Z]/.test(raw)) return false;
  if (/^bullet[_-]/i.test(raw)) return false;
  if (/^(ammo|mag|magazine)_/i.test(raw)) return false;
  if (/^(m4|ak|akm|ak74|svd|mosin|winchester|sks|fal|aug|mp5|ump|usg|glock|fnx|deagle|izg)[-_]/i.test(raw)) return false;
  if (/^(u|access|base|item|land|vehicle|animal|zombie|infected|survivor)_/i.test(raw) && /_/g.test(raw) && raw.split("_").length > 2) return false;
  return true;
}
