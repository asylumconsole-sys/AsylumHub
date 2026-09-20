export const DONATION_TIERS = [
  { usd: 5, name: "$5", creditsMark: "5k", color: 0x6b7280 },
  { usd: 10, name: "$10", creditsMark: "10k", color: 0x22c55e },
  { usd: 15, name: "$15", creditsMark: "15k", color: 0x14b8a6 },
  { usd: 20, name: "$20", creditsMark: "20k", color: 0x06b6d4 },
  { usd: 25, name: "$25", creditsMark: "25k", color: 0x3b82f6 },
  { usd: 30, name: "$30", creditsMark: "30k", color: 0x6366f1 },
  { usd: 50, name: "$50", creditsMark: "50k", color: 0x8b5cf6 },
  { usd: 75, name: "$75", creditsMark: "75k", color: 0xa855f7 },
  { usd: 100, name: "$100", creditsMark: "100k", color: 0xd946ef },
  { usd: 150, name: "$150", creditsMark: "150k", color: 0xec4899 },
  { usd: 200, name: "$200", creditsMark: "200k", color: 0xf43f5e },
  { usd: 250, name: "$250", creditsMark: "250k", color: 0xf97316 },
  { usd: 300, name: "$300", creditsMark: "300k", color: 0xeab308 },
  { usd: 500, name: "$500", creditsMark: "500k", color: 0xfacc15 },
  { usd: 750, name: "$750", creditsMark: "750k", color: 0xfde047 },
  { usd: 1000, name: "$1000", creditsMark: "1M", color: 0xfbbf24 },
  { usd: 1500, name: "$1500", creditsMark: "1.5M", color: 0xfb7185 },
  { usd: 2000, name: "$2000", creditsMark: "2M", color: 0xe879f9 },
  { usd: 2500, name: "$2500", creditsMark: "2.5M", color: 0xc084fc },
  { usd: 5000, name: "$5000", creditsMark: "5M", color: 0x67e8f9 },
  { usd: 7500, name: "$7500", creditsMark: "7.5M", color: 0xa5f3fc },
  { usd: 10000, name: "$10k", creditsMark: "10M", color: 0xffffff },
] as const;

export function hexColor(n: number) {
  return `#${n.toString(16).padStart(6, "0")}`;
}
