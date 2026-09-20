export const PRO_BUILDER_PRICE = 200_000;
export const BUILDER_ROLE_ID = "1551187969254101112";
export const BUILDER_CHANNEL_ID = "1406434160561750039";

export const PRO_BUILDER_KIT = {
  id: "pro_builder",
  name: "PRO Builder",
  price: PRO_BUILDER_PRICE,
  blurb: "2-hour material drop every 30 minutes until restart. Staff place the kit after you confirm the base.",
  waves: "50 metal sheets / 50 planks / 20 colored barrels / 15 hatchets / 250 boxed nails / 60 stones / 5 white flags / 150 logs / 10 pickaxes / 3 hammers / 15 large tents / 10 car tents / 50 fence kits / 5 flag pole kits / 25 watchtower kits / 2 plank piles / 50 hacksaws / 100 metal wire / 15 pliers — every 30 min for 2 hours.",
};

export type ProBuildOrder = {
  id: string;
  playerId: string;
  playerName: string;
  discordId?: string;
  mode: "base" | "map";
  x?: number;
  z?: number;
  baseConfirmed: boolean;
  images: string[];
  status: "pending_details" | "queued" | "assigned";
  createdAt: string;
};
