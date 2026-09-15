import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { z } from "zod";
import {
  IconArrowRight,
  IconBolt,
  IconClose,
  IconCalendar,
  IconCampaign,
  IconChart,
  IconFunnel,
  IconImport,
  IconScroll,
  IconSpark,
  IconUtm,
  IconSearch,
} from "@/components/ui-custom/CustomIcon";
import { PageHexBadge } from "@/components/app/PageHexBadge";
import { FocusedToolPanel } from "@/components/tools/FocusedToolPanel";
import { FadeInUp } from "@/components/motion/WordStagger";
import { BRAND } from "@/lib/brand";
import { toast } from "sonner";
import { DAYZ_SERVERS, type DayZServerId } from "@/lib/dayz/servers";


import {
  FOCUSED_TOOLS,
  SATELLITE_TO_FOCUS_SLUG,
  getFocusedTool,
} from "@/components/tools/focused-tools";

const searchSchema = z.object({
  focus: z.string().optional(),
  workspace: z.string().optional(),
});

const SERVICE_GROUPS: { name: string; description: string; hue: number; icon: ReactNode; items: { label: string; focus: string; icon: ReactNode }[] }[] = [
  {
    name: "Combat & Intel",
    description: "Track movement, bounties, killfeed, and server intelligence.",
    hue: 205,
    icon: <IconUtm size={20} />,
    items: [
      { label: "Combat & Intel", focus: "utm", icon: <IconUtm size={16} /> },
      { label: "UAV", focus: "utm-all", icon: <IconScroll size={16} /> },
      { label: "UAV Tracking", focus: "utm-all", icon: <IconScroll size={16} /> },
      { label: "Counter-UAV", focus: "campaign-list-cleaner", icon: <IconSpark size={16} /> },
      { label: "PVP Killfeed", focus: "utm", icon: <IconSpark size={16} /> },
      { label: "Bounties", focus: "utm-taxonomy", icon: <IconSpark size={16} /> },
      { label: "Heatmap", focus: "campaign-list-cleaner", icon: <IconChart size={16} /> },
      { label: "Intel Board", focus: "funnel-performance", icon: <IconChart size={16} /> },
      { label: "Leaderboards", focus: "funnel-performance", icon: <IconChart size={16} /> },
    ],
  },
  {
    name: "Air Support",
    description: "Call in strikes and coordinate precision operations.",
    icon: <IconFunnel size={20} />,
    items: [
      { label: "Air Support", focus: "funnel-targets", icon: <IconFunnel size={16} /> },
      { label: "Precision Strikes", focus: "funnel-targets", icon: <IconSpark size={16} /> },
      { label: "Strafe Runs", focus: "funnel-performance", icon: <IconChart size={16} /> },
    ],
  },
  {
    name: "Base Ops",
    description: "Protect bases, manage territory, and broadcast raid events.",
    hue: 35,
    icon: <IconCampaign size={20} />,
    items: [
      { label: "Base Ops", focus: "campaign", icon: <IconCampaign size={16} /> },
      { label: "Raid Announcements", focus: "campaign-events", icon: <IconCalendar size={16} /> },
      { label: "Custom Bases", focus: "campaign", icon: <IconCampaign size={16} /> },
    ],
  },
  {
    name: "NPC Shop",
    description: "Build NPCs, recruit survivors, and manage custom server content.",
    hue: 285,
    icon: <IconImport size={20} />,
    items: [
      { label: "NPC Shop", focus: "campaign-import", icon: <IconImport size={16} /> },
      { label: "Custom Vehicles", focus: "campaign-events", icon: <IconSpark size={16} /> },
      { label: "Item Shop", focus: "campaign-import", icon: <IconScroll size={16} /> },
    ],
  },
  {
    name: "Vehicle Shop",
    description: "Deploy transport, utility rigs, and armored recon vehicles.",
    hue: 122,
    icon: <IconCampaign size={20} />,
    items: [
      { label: "Vehicle Shop", focus: "vehicle-shop", icon: <IconCampaign size={16} /> },
      { label: "Utility Vehicles", focus: "vehicle-shop", icon: <IconScroll size={16} /> },
      { label: "Combat Vehicles", focus: "vehicle-shop", icon: <IconSpark size={16} /> },
    ],
  },
  {
    name: "Priority Queue",
    description: "Skip the line and keep your faction ahead of the pack.",
    hue: 48,
    icon: <IconBolt size={20} />,
    items: [
      { label: "Priority Queue", focus: "campaign-events", icon: <IconBolt size={16} /> },
      { label: "Fast Track", focus: "campaign-events", icon: <IconSpark size={16} /> },
      { label: "Queue Boost", focus: "campaign-events", icon: <IconChart size={16} /> },
    ],
  },
  {
    name: "Sleeping Bags",
    description: "Set respawn points and stored recovery kits for your squads.",
    hue: 168,
    icon: <IconScroll size={20} />,
    items: [
      { label: "Sleeping Bags", focus: "campaign-events", icon: <IconScroll size={16} /> },
      { label: "Field Respawns", focus: "campaign-events", icon: <IconCampaign size={16} /> },
      { label: "Recovery Kits", focus: "campaign-events", icon: <IconSpark size={16} /> },
    ],
  },
  {
    name: "Boosts",
    description: "Faction-only boosts: double XP, double CR, and double reputation.",
    hue: 318,
    icon: <IconSpark size={20} />,
    items: [
      { label: "Double XP", focus: "boosts", icon: <IconSpark size={16} /> },
      { label: "Double CR", focus: "boosts", icon: <IconUtm size={16} /> },
      { label: "Reputation Boost", focus: "boosts", icon: <IconChart size={16} /> },
    ],
  },
  {
    name: "Zombie Hordes",
    description: "Survive outbreaks, claim horde rewards, and support the fight.",
    hue: 52,
    icon: <IconChart size={20} />,
    items: [{ label: "Zombie Hordes", focus: "zombie-hordes", icon: <IconSpark size={16} /> }],
  },
];

type ItemCategory = "Handgun" | "Rifle" | "Sniper Rifle" | "SMG" | "Shotgun" | "Ammo" | "Medical" | "Food" | "Clothing" | "Backpack" | "Attachments" | "Explosives" | "Tools" | "Vehicle" | "Survival" | "Base Building";
type ShopItem = { id: string; name: string; category: ItemCategory; price: number; detail: string; image: string };

const wikiImage = (file: string) => `https://dayz.fandom.com/wiki/Special:FilePath/${encodeURIComponent(file)}`;
const item = (id: string, name: string, category: ItemCategory, price: number, detail: string, file: string): ShopItem => ({ id, name, category, price, detail, image: wikiImage(file) });

// Wiki file names don't always match the in-game item name exactly (e.g. "M4-A1" is filed as "M4A1.png"),
// so build a list of fallback name guesses to try before giving up on an image.
function imageCandidates(entry: ShopItem): string[] {
  const base = decodeURIComponent(entry.image.split("/").pop() ?? "").replace(/\.png$/i, "");
  const name = entry.name;
  const variants = new Set<string>([
    base,
    base.replace(/-/g, ""),
    base.replace(/-/g, " "),
    name,
    name.replace(/-/g, ""),
    name.replace(/-/g, " "),
    name.replace(/\s+/g, ""),
  ]);
  return Array.from(variants).map((file) => wikiImage(`${file}.png`));
}

const ITEM_CATALOG: ShopItem[] = [
  item("glock19", "Glock 19", "Handgun", 1800, "Compact 9mm sidearm for close quarters.", "Glock 19.png"),
  item("deagle", "Desert Eagle", "Handgun", 4200, "Heavy pistol with serious stopping power.", "Deagle.png"),
  item("fnx45", "FNX45", "Handgun", 3600, "Reliable .45 sidearm with a strong report.", "FNX45.png"),
  item("mk-ii", "MK II", "Handgun", 2400, "Quiet .22 pistol for discreet work.", "MK II.png"),
  item("m4a1", "M4-A1", "Rifle", 12500, "Modular assault rifle for faction operations.", "M4-A1.png"),
  item("akm", "AKM", "Rifle", 10800, "Hard-hitting 7.62 rifle built for the wasteland.", "AKM.png"),
  item("ak74", "AK-74", "Rifle", 9400, "Controllable 5.45 assault rifle.", "AK-74.png"),
  item("aug", "AUG A1", "Rifle", 11400, "Bullpup rifle with a fast handling profile.", "AUG A1.png"),
  item("lar", "FAL", "Rifle", 15200, "Battle rifle for players who want reach and force.", "FAL.png"),
  item("mosin", "Mosin 9130", "Sniper Rifle", 8500, "Classic bolt-action rifle with long-range reach.", "Mosin 9130.png"),
  item("svd", "SVD", "Sniper Rifle", 17800, "Semi-automatic marksman rifle for overwatch.", "SVD.png"),
  item("vss", "VSS", "Sniper Rifle", 16400, "Suppressed marksman platform for covert teams.", "VSS.png"),
  item("win70", "Winchester 70", "Sniper Rifle", 9800, "Precise hunting rifle with a clean sight picture.", "Winchester 70.png"),
  item("mp5", "USG-45", "SMG", 7200, "Compact submachine gun for urban fights.", "USG-45.png"),
  item("scorpion", "Scorpion EVO 3", "SMG", 7600, "Fast-firing SMG with a large magazine.", "Scorpion EVO 3.png"),
  item("mp133", "BK-133", "Shotgun", 4600, "Pump shotgun that keeps doorways honest.", "BK-133.png"),
  item("doublebarrel", "BK-43", "Shotgun", 3900, "Break-action double barrel for brutal close work.", "BK-43.png"),
  item("ij70", "IJ-70", "Handgun", 1300, "Common sidearm and dependable last resort.", "IJ-70.png"),
  item("ammo-556", "5.56x45mm Box", "Ammo", 900, "Box of rifle ammunition.", "5.56x45mm.png"),
  item("ammo-762", "7.62x39mm Box", "Ammo", 1100, "Box of intermediate rifle ammunition.", "7.62x39mm.png"),
  item("ammo-308", ".308 Winchester Box", "Ammo", 1400, "Box of full-power marksman rounds.", ".308 Winchester.png"),
  item("ammo-9mm", "9x19mm Box", "Ammo", 700, "Box of compact pistol and SMG rounds.", "9x19mm.png"),
  item("bandage", "Bandage", "Medical", 350, "Stop bleeding before the next push.", "Bandage.png"),
  item("saline", "Saline Bag", "Medical", 1200, "Restore blood volume after treatment.", "Saline Bag.png"),
  item("morphine", "Morphine Auto-Injector", "Medical", 950, "Treat a broken leg and keep moving.", "Morphine Auto-Injector.png"),
  item("charcoal", "Charcoal Tablets", "Medical", 500, "Clean up a bad stomach situation.", "Charcoal Tabs.png"),
  item("canned", "Canned Bacon", "Food", 260, "Long-life food for a long night.", "Canned Bacon.png"),
  item("water", "Canteen", "Food", 450, "Carry clean water between safehouses.", "Canteen.png"),
  item("rice", "Rice", "Food", 380, "A reliable dry food staple.", "Rice.png"),
  item("plate", "Plate Carrier", "Clothing", 6800, "Extra protection for high-risk raids.", "Plate Carrier.png"),
  item("ghillie", "Ghillie Suit", "Clothing", 5900, "Blend into the tree line.", "Ghillie Suit.png"),
  item("helmet", "Assault Helmet", "Clothing", 3200, "Protect your head during contact.", "Assault Helmet.png"),
  item("knife", "Combat Knife", "Tools", 900, "A field blade for work and defense.", "Combat Knife.png"),
  item("hatchet", "Hatchet", "Tools", 1250, "Harvest wood and open difficult crates.", "Hatchet.png"),
  item("lockpick", "Lockpick", "Tools", 2100, "A quiet answer to locked storage.", "Lockpick.png"),
  item("repair", "Weapon Cleaning Kit", "Tools", 1800, "Keep your weapon reliable in the field.", "Weapon Cleaning Kit.png"),
  item("bicycle", "Bicycle", "Vehicle", 6200, "Quiet transport for supply runs.", "Bicycle.png"),
  item("tent", "Medium Tent", "Survival", 2800, "Create a temporary faction cache.", "Medium Tent.png"),
  item("cooking", "Cooking Pot", "Survival", 800, "Turn raw finds into a hot meal.", "Cooking Pot.png"),
  item("radio", "Field Transceiver", "Survival", 1700, "Stay connected when the grid goes dark.", "Field Transceiver.png"),
  item("m79", "M79", "Rifle", 13200, "Single-shot launcher for specialist squads.", "M79.png"),
  item("bizon", "PP-19 Bizon", "SMG", 6900, "High-capacity SMG for close-range pressure.", "PP-19 Bizon.png"),
  item("repeater", "Repeater Carbine", "Rifle", 5200, "Fast lever action for mobile hunters.", "Repeater.png"),
  item("cr527", "CR-527", "Rifle", 6100, "Compact bolt-action rifle with a useful magazine.", "CR-527.png"),
  item("sks", "SK 59/66", "Rifle", 7300, "Rugged semi-automatic rifle for the frontier.", "SK 59-66.png"),
  item("saiga", "Vaiga", "Shotgun", 8800, "Magazine-fed shotgun for clearing rooms.", "Vaiga.png"),
  item("pioneer", "Pioneer", "Sniper Rifle", 7600, "Modern bolt-action rifle for quiet overwatch.", "Pioneer.png"),
  item("bk18", "BK-18", "Rifle", 2800, "Simple single-shot hunting rifle.", "BK-18.png"),
  item("ammo-12", "12ga Buckshot Box", "Ammo", 850, "Close-range shotgun shells.", "12ga Buckshot.png"),
  item("ammo-45", ".45 ACP Box", "Ammo", 650, "Subsonic pistol and SMG ammunition.", ".45 ACP.png"),
  item("ammo-380", ".380 ACP Box", "Ammo", 500, "Compact handgun ammunition.", ".380 ACP.png"),
  item("ammo-545", "5.45x39mm Box", "Ammo", 950, "Soviet-pattern assault rifle ammunition.", "5.45x39mm.png"),
  item("ammo-76254", "7.62x54mmR Box", "Ammo", 1500, "Full-power marksman ammunition.", "7.62x54mmR.png"),
  item("hunter-scope", "Hunting Scope", "Attachments", 2600, "Magnify targets at hunting distance.", "Hunting Scope.png"),
  item("pu-scope", "PU Scope", "Attachments", 2200, "Classic optic for the Mosin platform.", "PU Scope.png"),
  item("kashtan", "KASHTAN Scope", "Attachments", 3900, "Mid-range optic for AK platforms.", "KASHTAN.png"),
  item("suppressor", "Normalized Suppressor", "Attachments", 4400, "Reduce report and muzzle flash.", "Normalized Suppressor.png"),
  item("mag-m4", "M4 60-Round Mag", "Attachments", 2300, "Extended magazine for M4 operations.", "M4 60Rnd Mag.png"),
  item("mag-ak", "AK-M 30-Round Mag", "Attachments", 1200, "Spare magazine for AK platforms.", "AKM 30Rnd Mag.png"),
  item("grenade", "M67 Grenade", "Explosives", 2800, "Fragmentation grenade for fortified positions.", "M67 Grenade.png"),
  item("smoke", "Smoke Grenade", "Explosives", 1400, "Create concealment for a squad move.", "Smoke Grenade.png"),
  item("flashbang", "Flashbang", "Explosives", 1800, "Disorient a room before entry.", "Flashbang.png"),
  item("stabvest", "Stab Vest", "Clothing", 2100, "Light protection without slowing you down.", "Stab Vest.png"),
  item("fieldjacket", "Field Jacket", "Clothing", 900, "Durable storage for the road.", "Field Jacket.png"),
  item("militaryboots", "Combat Boots", "Clothing", 1200, "Keep your feet protected on long runs.", "Combat Boots.png"),
  item("tacticalhelmet", "Tactical Helmet", "Clothing", 4100, "Military head protection with attachment rails.", "Tactical Helmet.png"),
  item("tacticalbag", "Tactical Backpack", "Backpack", 4800, "Carry more supplies without losing mobility.", "Tactical Backpack.png"),
  item("assaultbag", "Assault Backpack", "Backpack", 3600, "Balanced faction pack for patrols.", "Assault Backpack.png"),
  item("drybag", "Drybag Backpack", "Backpack", 2400, "Keep your supplies protected from rain.", "Drybag.png"),
  item("splint", "Splint", "Medical", 420, "Set a broken leg and get back to base.", "Splint.png"),
  item("epipen", "Epinephrine Auto-Injector", "Medical", 1000, "Bring an unconscious survivor back around.", "Epinephrine Auto-Injector.png"),
  item("vitamins", "Vitamins", "Medical", 480, "Support recovery when supplies are scarce.", "Tetracycline Pills.png"),
  item("tacticalbacon", "Tactical Bacon", "Food", 520, "High-energy field ration.", "Tactical Bacon.png"),
  item("peaches", "Canned Spaghetti", "Food", 300, "A warm meal from a cold can.", "Canned Spaghetti.png"),
  item("fishingrod", "Fishing Rod", "Survival", 1300, "Find food away from the roads.", "Fishing Rod.png"),
  item("fishinghook", "Fishing Hook", "Survival", 180, "A small tool for a reliable catch.", "Fishing Hook.png"),
  item("shovel", "Shovel", "Tools", 1100, "Dig, build, and prepare a hidden cache.", "Shovel.png"),
  item("saw", "Hacksaw", "Tools", 760, "Cut through metal and salvage components.", "Hacksaw.png"),
  item("gascan", "Jerry Can", "Vehicle", 1800, "Carry fuel for a long-distance run.", "Jerry Can.png"),
  item("carbattery", "Car Battery", "Vehicle", 2600, "Restore power to a stranded vehicle.", "Car Battery.png"),
  item("radiator", "Radiator", "Vehicle", 2300, "Keep a faction vehicle running cool.", "Radiator.png"),
  item("cz61", "CZ 61 Scorpion", "SMG", 5400, "Tiny SMG that fits in a jacket pocket.", "CZ 61 Scorpion.png"),
  item("famas", "FAMAS", "Rifle", 12100, "Bullpup rifle with a distinct high rate of fire.", "FAMAS.png"),
  item("m16a2", "M16-A2", "Rifle", 11700, "Reliable full-length service rifle.", "M16-A2.png"),
  item("sg5-k", "SG5-K", "SMG", 5900, "Compact SMG for room clearing.", "SG5-K.png"),
  item("blaze", "Blaze 95", "Sniper Rifle", 9200, "Hard-hitting bolt-action rifle for exposed ground.", "Blaze 95.png"),
  item("vikhr", "VSD", "Sniper Rifle", 18200, "Suppressed marksman rifle for long patrols.", "VSD.png"),
  item("longhorn", "Longhorn R8 Revolver", "Handgun", 3300, "Powerful revolver for close encounters.", "Longhorn R8 Revolver.png"),
  item("cr75", "CR-75", "Handgun", 1600, "Light service pistol with reliable cycling.", "CR-75.png"),
  item("colts", "1911", "Handgun", 3100, "Classic .45 sidearm with a crisp trigger.", "Colt 1911.png"),
  item("ammo-9x39", "9x39mm Box", "Ammo", 1300, "Subsonic ammunition for suppressed platforms.", "9x39mm.png"),
  item("ammo-22", ".22 Box", "Ammo", 300, "Light rimfire ammunition.", ".22 LR.png"),
  item("mag-akm", "AKM 30-Round Mag", "Attachments", 1150, "Spare magazine for AKM builds.", "AKM 30rnd Mag.png"),
  item("bipod", "Bipod", "Attachments", 3100, "Steady a rifle for long-range shooting.", "Bipod.png"),
  item("flashlight", "Flashlight", "Attachments", 650, "Light up dark interiors and bunkers.", "Flashlight.png"),
  item("laser", "Tactical Laser", "Attachments", 2700, "Fast target acquisition in low light.", "Tactical Laser.png"),
  item("bayonet", "Bayonet", "Attachments", 1900, "Turn a rifle into a close-quarters option.", "Bayonet.png"),
  item("claymore", "Improvised Explosive", "Explosives", 3400, "Deny a route with a placed charge.", "Improvised Explosive.png"),
  item("satchel", "Satchel Charge", "Explosives", 5200, "Breach a fortified base wall.", "Satchel Charge.png"),
  item("gascanister", "Gas Canister", "Explosives", 2100, "Volatile canister for demolition work.", "Gas Canister.png"),
  item("raincoat", "Rain Coat", "Clothing", 700, "Stay dry during long patrols.", "Rain Coat.png"),
  item("beret", "Beret", "Clothing", 350, "Faction headwear for identification.", "Beret.png"),
  item("gasmask", "Gas Mask", "Clothing", 2900, "Protection against contaminated zones.", "Gas Mask.png"),
  item("plateshirt", "Press Vest", "Clothing", 1600, "Light carrier for extra pouch storage.", "Press Vest.png"),
  item("jeans", "Jeans", "Clothing", 250, "Everyday survivor clothing.", "Jeans.png"),
  item("coyotebag", "Coyote Backpack", "Backpack", 3900, "Balanced storage for extended patrols.", "Coyote Backpack.png"),
  item("mountainbag", "Mountain Backpack", "Backpack", 5600, "Large storage for a long expedition.", "Mountain Backpack.png"),
  item("hikingbag", "Hiking Backpack", "Backpack", 2000, "Lightweight pack for early game runs.", "Hiking Backpack.png"),
  item("tactical-baseball", "Baseball Bat", "Tools", 400, "Improvised close-range weapon.", "Baseball Bat.png"),
  item("machete", "Machete", "Tools", 1700, "Fast melee weapon with a long reach.", "Machete.png"),
  item("fireaxe", "Fire Axe", "Tools", 2200, "Break down doors and defend a base.", "Fire Axe.png"),
  item("crowbar", "Crowbar", "Tools", 1350, "Pry open crates and reinforce doors.", "Crowbar.png"),
  item("sewing", "Sewing Kit", "Tools", 500, "Repair torn clothing in the field.", "Sewing Kit.png"),
  item("compass", "Compass", "Survival", 600, "Navigate without relying on landmarks.", "Compass.png"),
  item("map", "Chernarus Map", "Survival", 450, "Plan routes across the region.", "Map.png"),
  item("matches", "Matchbox", "Survival", 220, "Start a fire quickly in the field.", "Matches.png"),
  item("waterbottle", "Water Bottle", "Survival", 300, "Keep hydrated between camps.", "Plastic Bottle.png"),
  item("largetent", "Large Tent", "Survival", 4200, "Expand your faction's storage footprint.", "Large Tent.png"),
  item("barrel", "Barrel", "Survival", 1900, "Weatherproof storage for a hidden stash.", "Barrel.png"),
  item("wheel", "Car Wheel", "Vehicle", 1500, "Replace a damaged tire on the move.", "Wheel.png"),
  item("sparkplug", "Spark Plug", "Vehicle", 700, "Keep an engine firing reliably.", "Spark Plug.png"),
  item("carbattery2", "Truck Battery", "Vehicle", 3100, "Heavy-duty power for larger vehicles.", "Truck Battery.png"),

  // ── Additional firearms ──────────────────────────────────────────────
  item("mp5k", "Kolt 1911", "Handgun", 3000, "Reliable service pistol with a crisp break.", "Colt 1911.png"),
  item("cr550", "CR-550 Savanna", "Rifle", 8600, "Bolt-action rifle with a large magazine.", "CR-550 Savanna.png"),
  item("vpo215", "VPO-215 Hunter", "Rifle", 5400, "Compact bolt-action hunting carbine.", "VPO-215 Hunter.png"),
  item("vpo269", "VPO-269 Zubr", "Shotgun", 9200, "Combination rifle-shotgun for versatile hunting.", "VPO-269 Zubr.png"),
  item("lemas", "LE-MAS", "Rifle", 10600, "Modern bullpup platform with rapid handling.", "LE-MAS.png"),
  item("kam", "KA-M", "Rifle", 9700, "Wasteland-modified assault rifle.", "KA-M.png"),
  item("sval", "SVAL", "Sniper Rifle", 15800, "Suppressed integrally-quiet marksman rifle.", "SVAL.png"),
  item("asval", "ASVAL", "Rifle", 14200, "Suppressed assault rifle for silent operations.", "ASVAL.png"),
  item("izh18", "IZH-18", "Sniper Rifle", 4200, "Single-shot break-action hunting rifle.", "IZH-18 Single-Shot Rifle.png"),
  item("mlock91", "Mlock 91", "Handgun", 2200, "Service pistol with a reliable double-action trigger.", "Mlock 91.png"),
  item("fx45", "FX-45", "Handgun", 2600, "Heavy-frame pistol chambered in .45.", "FX-45.png"),
  item("p1", "P1", "Handgun", 2900, "Classic service pistol with a distinct profile.", "P1.png"),
  item("cr61", "CR-61 Skorpion", "SMG", 5100, "Miniature machine pistol for concealed carry.", "CR-61 Skorpion.png"),
  item("uma", "UMP-45", "SMG", 7900, "Heavy-caliber submachine gun for room clearing.", "UMP-45.png"),
  item("sawedoff", "Sawed-off Shotgun", "Shotgun", 2600, "Cut-down shotgun for maximum concealment.", "Sawed-off Shotgun.png"),
  item("longhornrifle", "Winchester 70 Deluxe", "Sniper Rifle", 10400, "Upgraded hunting rifle with a premium finish.", "Winchester 70.png"),

  // ── More ammunition ───────────────────────────────────────────────────
  item("ammo-357", ".357 Magnum Box", "Ammo", 1000, "Powerful revolver ammunition.", ".357 Magnum.png"),
  item("ammo-9x21", "9x21mm Box", "Ammo", 750, "Standard sidearm ammunition.", "9x21mm.png"),
  item("ammo-1145", "11.43x23mm Box", "Ammo", 800, "Heavy pistol ammunition for large-frame handguns.", "11.43x23mm.png"),
  item("ammo-buckshot9", "9mm Buckshot Box", "Ammo", 700, "Improvised close-range shotgun rounds.", "9mm Buckshot.png"),
  item("ammo-flare", "Flare Round", "Ammo", 300, "Signal flare for illumination or rescue.", "Flare.png"),
  item("ammo-slug", "12ga Rifled Slug Box", "Ammo", 950, "Long-range shotgun slugs.", "12ga Rifled Slug.png"),

  // ── More attachments ──────────────────────────────────────────────────
  item("acog", "ACOG Optic", "Attachments", 5200, "4x fixed magnification combat optic.", "ACOG Optic.png"),
  item("holosight", "Holosight", "Attachments", 3400, "Fast target acquisition red dot.", "Holosight.png"),
  item("m68", "M68 Reflex Sight", "Attachments", 3000, "Compact reflex sight for CQB.", "M68 Reflex Sight.png"),
  item("lrs", "LRS (Long Range Scope)", "Attachments", 6400, "High-magnification precision optic.", "LRS.png"),
  item("scopemount", "Rifle Scope Rail", "Attachments", 700, "Mounting rail for optics.", "Rail.png"),
  item("compensator", "Compensator", "Attachments", 1300, "Reduce muzzle rise on full auto.", "Compensator.png"),
  item("foregrip", "Tactical Foregrip", "Attachments", 1500, "Improve control during sustained fire.", "Foregrip.png"),
  item("mag-vss", "VSS 20-Round Mag", "Attachments", 1900, "Spare magazine for VSS/VAL platforms.", "VSS 20rnd Mag.png"),
  item("mag-fal", "FAL 20-Round Mag", "Attachments", 1700, "Spare magazine for FAL battle rifles.", "FAL 20rnd Mag.png"),
  item("mag-mp5", "USG 30-Round Mag", "Attachments", 1400, "Spare magazine for SMG platforms.", "UMP 25rnd Mag.png"),

  // ── More medical ──────────────────────────────────────────────────────
  item("bloodbagempty", "Blood Bag (Empty)", "Medical", 300, "Collect blood from a donor.", "Blood Bag.png"),
  item("bloodbagfull", "Blood Bag (Full)", "Medical", 1600, "Transfuse blood into a wounded survivor.", "Blood Bag.png"),
  item("iodine", "Tincture of Iodine", "Medical", 550, "Disinfect wounds after surgery.", "Iodine.png"),
  item("disinfectant", "Disinfectant Spray", "Medical", 600, "Sterilize wounds to prevent infection.", "Disinfectant Spray.png"),
  item("painkillers", "Painkillers", "Medical", 400, "Reduce pain from injuries.", "Painkillers.png"),
  item("antibiotics", "Tetracycline Antibiotics", "Medical", 700, "Treat illness before it spreads.", "Tetracycline Antibiotics.png"),
  item("vitaminbottle", "Vitamin Bottle", "Medical", 460, "Boost immunity over time.", "Vitamin Bottle.png"),
  item("surgicalkit", "Surgical Kit", "Medical", 2200, "Perform field surgery on serious wounds.", "Surgical Kit.png"),
  item("ragbandage", "Rag", "Medical", 120, "Improvised bandage material.", "Rag.png"),

  // ── More food & drink ──────────────────────────────────────────────────
  item("cannedtuna", "Canned Tuna", "Food", 280, "Protein-rich canned fish.", "Canned Tuna.png"),
  item("cannedbeef", "Canned Beef", "Food", 320, "Hearty canned ration.", "Canned Beef.png"),
  item("cannedsardines", "Canned Sardines", "Food", 240, "Small tin of preserved fish.", "Canned Sardines.png"),
  item("kompot", "Kompot", "Food", 260, "Sweet preserved fruit drink.", "Kompot.png"),
  item("pot-o-food", "Pot of Cooked Meat", "Food", 500, "A hearty cooked meal ready to eat.", "Cooking Pot.png"),
  item("applejuice", "Apple Juice", "Food", 220, "Refreshing bottled juice.", "Apple Juice.png"),
  item("powerbar", "Powerbar", "Food", 300, "Energy-dense snack bar.", "Powerbar.png"),
  item("mre", "Cereal Bar", "Food", 260, "Quick snack for the road.", "Cereal Bar.png"),

  // ── More clothing ─────────────────────────────────────────────────────
  item("paramedicshirt", "Paramedic Shirt", "Clothing", 500, "Medical faction identifier clothing.", "Paramedic Shirt.png"),
  item("policeuniform", "Police Uniform", "Clothing", 1300, "Faded law-enforcement uniform.", "Police Jacket.png"),
  item("hunterjacket", "Hunter Jacket", "Clothing", 1100, "Warm jacket suited for the wilderness.", "Hunter Jacket.png"),
  item("survivorvest", "Survivor Vest", "Clothing", 950, "Utility vest with extra pouches.", "Press Vest.png"),
  item("bandana", "Bandana", "Clothing", 260, "Cover your face from dust and identification.", "Bandana.png"),
  item("baseballcap", "Baseball Cap", "Clothing", 220, "Casual survivor headwear.", "Baseball Cap.png"),
  item("hikingboots", "Hiking Boots", "Clothing", 900, "Comfortable boots for long treks.", "Hiking Boots.png"),
  item("rubberboots", "Rubber Boots", "Clothing", 500, "Waterproof boots for wet terrain.", "Rubber Boots.png"),
  item("ushankahat", "Ushanka", "Clothing", 480, "Warm winter fur hat.", "Ushanka.png"),
  item("gorkajacket", "Gorka Jacket", "Clothing", 3400, "Rugged military field jacket.", "Gorka Jacket.png"),
  item("gorkapants", "Gorka Pants", "Clothing", 2900, "Matching military field trousers.", "Gorka Pants.png"),
  item("ttscjacket", "TTsKO Jacket", "Clothing", 2600, "Woodland camouflage field jacket.", "TTsKO Jacket.png"),
  item("wetsuit", "Wetsuit", "Clothing", 2400, "Protect against cold water exposure.", "Wetsuit.png"),

  // ── More backpacks & containers ─────────────────────────────────────────
  item("aliceframe", "Alice Pack", "Backpack", 3200, "Rugged military-issue framed pack.", "Alice Pack.png"),
  item("carrierlite", "Carrier Lite Rig", "Backpack", 2600, "Slim carrier for essential gear.", "Carrier Lite Rig.png"),
  item("czechbag", "Czech Backpack", "Backpack", 1900, "Compact vintage-style pack.", "Czech Backpack.png"),
  item("plasticcase", "Plastic Case", "Survival", 900, "Weatherproof case for small gear.", "Plastic Case.png"),
  item("ammobox", "Ammo Box", "Survival", 1400, "Secure storage for ammunition stock.", "Ammo Box.png"),
  item("weaponcase", "Weapon Case", "Survival", 3800, "Store and transport a full-size weapon.", "Improvised Weapon Case.png"),

  // ── More tools & explosives ─────────────────────────────────────────────
  item("pipewrench", "Pipe Wrench", "Tools", 950, "Heavy tool with dual use as a weapon.", "Pipe Wrench.png"),
  item("sledgehammer", "Sledgehammer", "Tools", 2400, "Break down barricades and fortifications.", "Sledgehammer.png"),
  item("pliers", "Pliers", "Tools", 480, "Precision tool for repairs and crafting.", "Pliers.png"),
  item("screwdriver", "Screwdriver", "Tools", 350, "Basic tool for maintenance and crafting.", "Screwdriver.png"),
  item("wrench", "Wrench", "Tools", 520, "Loosen and tighten hardware.", "Wrench.png"),
  item("handdrill", "Hand Drill", "Tools", 900, "Start a fire without matches.", "Hand Drill.png"),
  item("tripwire", "Tripwire Trap Kit", "Explosives", 2700, "Set an early-warning perimeter trap.", "Improvised Explosive.png"),
  item("landmine", "PMK Landmine", "Explosives", 6200, "Anti-personnel mine for base defense.", "Improvised Explosive.png"),

  // ── Base building ─────────────────────────────────────────────────────
  item("fencekit", "Fence Kit", "Base Building", 2200, "Build a perimeter wall section.", "Fence Kit.png"),
  item("watchtowerkit", "Watchtower Kit", "Base Building", 4600, "Elevated lookout structure for base defense.", "Watchtower Kit.png"),
  item("gatekit", "Gate Kit", "Base Building", 3100, "Controlled entry point for a walled base.", "Gate Kit.png"),
  item("codelock", "Code Lock", "Base Building", 3800, "Secure a base gate with a numeric code.", "Code Lock.png"),
  item("combolock", "Combination Lock", "Base Building", 1600, "Basic padlock for storage containers.", "Combination Lock.png"),
  item("territorykit", "Territory Flag Kit", "Base Building", 5200, "Claim territory for your faction.", "Flag Kit.png"),
  item("shelterkit", "Wooden Shelter Kit", "Base Building", 1800, "Simple weatherproof shelter frame.", "Watchtower Kit.png"),
  item("cratewooden", "Wooden Crate", "Base Building", 900, "Basic hidden storage container.", "Wooden Crate.png"),
  item("barrelblue", "Blue Barrel", "Base Building", 1300, "Weatherproof stash barrel.", "Barrel.png"),
  item("undergroundstash", "Underground Stash", "Base Building", 700, "Buried concealment for a small cache.", "Barrel.png"),
  item("watchtower2", "Metal Watchtower Kit", "Base Building", 6800, "Reinforced elevated defense structure.", "Watchtower Kit.png"),

  // ── More vehicles & parts ───────────────────────────────────────────────
  item("sedanparts", "Sedan Door", "Vehicle", 1900, "Replacement door panel for a Sedan.", "Sedan Door (Blue).png"),
  item("hatchbackhood", "Hatchback Hood", "Vehicle", 1700, "Replacement hood for a Hatchback.", "Hatchback Hood (Blue).png"),
  item("odtruck", "Truck Wheel", "Vehicle", 2100, "Heavy-duty wheel for a cargo truck.", "Wheel.png"),
  item("v3sengine", "V3S Engine", "Vehicle", 4200, "Replacement engine for a military truck.", "Truck Battery.png"),
  item("kayak", "Kayak", "Vehicle", 5400, "Lightweight paddle boat for rivers and coastline.", "Kayak.png"),
  item("boat-cz", "CSJ-6 Boat", "Vehicle", 12800, "Small motorboat for coastal travel.", "CSJ-6 Wooden Boat.png"),
  item("sparkplug2", "Glow Plug", "Vehicle", 650, "Diesel engine starting component.", "Spark Plug.png"),
  item("fueltank", "Fuel Tank", "Vehicle", 2500, "Restore a vehicle's fuel storage.", "Fuel Tank (Blue).png"),

  // ── More survival gear ───────────────────────────────────────────────────
  item("stone", "Stone Knife", "Tools", 250, "Improvised bladed tool.", "Stone Knife.png"),
  item("courierbag", "Courier Bag", "Backpack", 1500, "Small satchel for light loadouts.", "Courier Bag.png"),
  item("nvgoggles", "NVGoggles", "Attachments", 8600, "Night vision for zero-visibility ops.", "NVGoggles.png"),
  item("binoculars", "Binoculars", "Survival", 1600, "Scout distant targets and terrain.", "Binoculars.png"),
  item("rangefinder", "Rangefinder", "Survival", 2400, "Measure distance for precision shots.", "Rangefinder.png"),
  item("watch", "Wrist Watch", "Survival", 380, "Track in-game time at a glance.", "Wrist Watch.png"),
  item("gpsgadget", "GPS", "Survival", 2900, "Track your coordinates in the field.", "GPS.png"),
  item("chemlight", "Chemlight", "Survival", 260, "Portable non-flame light source.", "Chemlight (green).png"),
  item("roadflare", "Road Flare", "Survival", 320, "Bright emergency signal light.", "Road Flare.png"),
  item("fireplacekit", "Fireplace Kit", "Survival", 480, "Set up a controlled campfire.", "Fireplace.png"),
];

const ITEM_FILTERS = ["All", "Name A-Z", "Handgun", "Rifle", "Sniper Rifle", "SMG", "Shotgun", "Ammo", "Medical", "Food", "Clothing", "Backpack", "Attachments", "Explosives", "Tools", "Vehicle", "Survival", "Base Building"] as const;

export const Route = createFileRoute("/_app/tools/")({
  component: ToolsHub,
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: `Server shop — ${BRAND.name}` },
      {
        name: "description",
        content:
          "Base Ops, Services, Bounties, Air Support.",
      },
    ],
  }),
});

function ToolsHub() {
  const { focus, workspace } = Route.useSearch();
  const navigate = useNavigate();
  const [shopTab, setShopTab] = useState<"server" | "items">("server");
  const tool = getFocusedTool(focus);
  const focusedPrimaryId = tool?.primaryId ?? null;
  // Reverse the satellite→slug map to find which satellite is active.
  const focusedSatelliteId =
    Object.entries(SATELLITE_TO_FOCUS_SLUG).find(([, slug]) => slug === focus)?.[0] ?? null;

  const handleFocus = useCallback(
    (primaryId: string) => {
      const entry = Object.values(FOCUSED_TOOLS).find(
        (t) => t.primaryId === primaryId && !t.parentTitle,
      );
      if (!entry) return;
      navigate({ to: "/tools", search: { focus: entry.slug, workspace }, replace: false });
    },
    [navigate, workspace],
  );

  const handleSatelliteFocus = useCallback(
    (_primaryId: string, satelliteId: string) => {
      const slug = SATELLITE_TO_FOCUS_SLUG[satelliteId];
      if (!slug) return false;
      navigate({ to: "/tools", search: { focus: slug, workspace }, replace: false });
      return true;
    },
    [navigate, workspace],
  );

  const handleClose = useCallback(() => {
    navigate({ to: "/tools", search: { workspace }, replace: false });
  }, [navigate, workspace]);


  const badgeHue = tool?.parentHue ?? tool?.hue ?? 88;
  const badgeIcon = tool?.parentIcon ?? tool?.icon;
  const mainTitle = tool?.parentTitle ?? tool?.title;
  const subTitle = tool?.parentTitle ? tool.title : null;
  const serverShopRef = useRef<HTMLDivElement | null>(null);
  const [sparkFocus, setSparkFocus] = useState({ x: 50, y: 50, active: false });

  useEffect(() => {
    const element = serverShopRef.current;
    if (!element) return;
    const onMove = (event: PointerEvent) => {
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const x = ((event.clientX - rect.left) / rect.width) * 100;
      const y = ((event.clientY - rect.top) / rect.height) * 100;
      setSparkFocus({ x: Math.min(100, Math.max(0, x)), y: Math.min(100, Math.max(0, y)), active: true });
    };
    const onLeave = () => setSparkFocus({ x: 50, y: 50, active: false });
    element.addEventListener("pointermove", onMove);
    element.addEventListener("pointerleave", onLeave);
    return () => {
      element.removeEventListener("pointermove", onMove);
      element.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <div ref={serverShopRef} className={`server-shop-root relative flex min-h-[calc(100vh-3rem)] flex-col overflow-x-hidden pb-10 ${tool ? "space-y-3" : "space-y-8"}`}>
      <style>{`@import url("https://fonts.googleapis.com/css2?family=MedievalSharp&display=swap");
        .server-shop-root {
          position: relative;
          min-height: calc(100vh - 3rem);
          background:
            radial-gradient(circle at 50% 0%, rgba(245, 158, 11, 0.16), transparent 28%),
            radial-gradient(circle at 50% 100%, rgba(194, 82, 30, 0.24), transparent 42%),
            linear-gradient(180deg, rgba(9, 7, 6, 0.82), rgba(14, 10, 9, 0.96));
          color: #f5e6c8;
        }
        .shop-atmosphere {
          position: absolute;
          inset: 0;
          pointer-events: none;
          overflow: hidden;
          opacity: 0.95;
        }
        .shop-desert { position: absolute; inset: 0; background: url('/drylands.png') center top / cover no-repeat; opacity: 0.18; filter: saturate(1.1) contrast(1.12); }
        .shop-glow { position: absolute; left: 50%; bottom: -8%; width: 78%; height: 38%; transform: translateX(-50%); background: radial-gradient(ellipse, rgba(255, 123, 52, 0.52), rgba(129, 32, 17, 0.2) 48%, transparent 78%); filter: blur(28px); }
        .shop-smoke { position: absolute; bottom: 0; width: 350px; height: 560px; border-radius: 50%; background: radial-gradient(ellipse at 40% 90%, rgba(94, 60, 35, 0.72), rgba(18, 12, 10, 0.12) 48%, transparent 70%); filter: blur(30px); opacity: 0.38; animation: shop-soar 12s ease-in-out infinite; }
        .shop-smoke-a { left: 4%; }
        .shop-smoke-b { right: 5%; animation-delay: -4s; }
        @keyframes shop-soar { 0%, 100% { transform: translateY(14px) scale(0.92); opacity: 0.22; } 50% { transform: translateY(-30px) scale(1.04); opacity: 0.5; } }
        .shop-ember { position: absolute; bottom: 4%; width: 3px; height: 3px; border-radius: 999px; background: radial-gradient(circle, rgba(255, 216, 130, 1), rgba(255, 137, 58, 0.96) 42%, rgba(126, 28, 18, 0.7)); box-shadow: 0 0 12px rgba(255, 157, 65, 0.9), 0 0 20px rgba(251, 96, 31, 0.4); opacity: 0; animation: shop-ember 5s ease-out infinite; }
        @keyframes shop-ember { 0% { opacity: 0; transform: translate(0, 0) scale(0.4); } 12% { opacity: 1; } 100% { opacity: 0; transform: translate(18px, -560px) scale(0.12); } }
        .shop-medieval-title, .server-shop-root h1, .server-shop-root h2, .server-shop-root h3 { font-family: "MedievalSharp", Georgia, serif; font-weight: 400; }
        .shop-masthead { position: relative; z-index: 1; padding: 28px 24px 0; }
        .shop-badge-row { display: flex; align-items: center; gap: 16px; }
        .shop-kicker { display: inline-block; margin-top: 8px; font-size: 10px; letter-spacing: 0.28em; text-transform: uppercase; color: rgba(244, 189, 96, 0.8); }
        .shop-title { margin-top: 4px; font-size: clamp(3rem, 6vw, 5rem); line-height: 0.9; letter-spacing: 0.04em; color: #fceac9; text-shadow: 0 0 30px rgba(186, 68, 29, 0.5), 0 3px 0 rgba(18, 8, 7, 0.9); }
        .shop-subtitle { max-width: 660px; margin-top: 10px; color: rgba(245, 228, 197, 0.72); font-size: 0.96rem; line-height: 1.6; }
        .shop-hero-bar {
          position: relative; z-index: 1; margin: 22px auto 0; max-width: 1380px; padding: 16px 18px; border: 1px solid rgba(233, 168, 84, 0.34); border-radius: 18px; background: linear-gradient(90deg, rgba(35, 22, 16, 0.86), rgba(18, 13, 11, 0.76)); box-shadow: 0 18px 44px rgba(0, 0, 0, 0.28); display: grid; grid-template-columns: 1.15fr 0.85fr; gap: 16px; align-items: center;
        }
        .shop-hero-meta { display: flex; align-items: center; justify-content: space-between; gap: 14px; }
        .shop-hero-stat { display: grid; gap: 4px; min-width: 140px; }
        .shop-hero-stat span { color: rgba(245, 228, 197, 0.6); font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase; }
        .shop-hero-stat strong { color: #f4d391; font-size: 1.8rem; font-family: "MedievalSharp", Georgia, serif; }
        .shop-hero-callout { display: flex; align-items: center; justify-content: flex-end; gap: 12px; }
        .shop-hero-pill { position: relative; overflow: hidden; border: 1px solid rgba(235, 172, 87, 0.28); border-radius: 999px; padding: 7px 12px; background: rgba(88, 46, 24, 0.36); color: #f3d28f; letter-spacing: 0.15em; font-size: 10px; text-transform: uppercase; }
        .shop-hero-pill::after { content: ""; position: absolute; inset-y: 0; left: 0; width: 40%; background: rgba(255,255,255,0.35); filter: blur(4px); animation: servershop-shine 3.4s ease-in-out infinite; }
        .shop-directory-wrap { position: relative; z-index: 1; width: min(1380px, calc(100% - 32px)); margin: 26px auto 0; }
        .shop-directory-shell { border: 1px solid rgba(231, 170, 86, 0.26); border-radius: 28px; background: rgba(16, 11, 9, 0.8); box-shadow: 0 25px 80px rgba(0, 0, 0, 0.42), inset 0 0 0 1px rgba(255, 188, 112, 0.05); overflow: hidden; }
        .shop-directory-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; padding: 18px; }
        .shop-card {
          position: relative; display: flex; align-items: stretch; gap: 14px; min-height: 145px; width: 100%; border: 1px solid rgba(224, 162, 77, 0.2); border-radius: 18px; background: linear-gradient(180deg, rgba(32, 18, 12, 0.88), rgba(15, 11, 9, 0.96)); padding: 16px; text-align: left; overflow: hidden; cursor: pointer; transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .shop-card:hover { transform: translateY(-1px); border-color: rgba(246, 190, 88, 0.4); box-shadow: 0 14px 30px rgba(0,0,0,0.18); }
        .shop-card::before { content: ""; position: absolute; inset: 0 auto 0 0; width: 4px; background: linear-gradient(180deg, rgba(255, 176, 82, 0.9), rgba(131, 39, 17, 0.8)); }
        .shop-card-art { position: relative; display: grid; place-items: center; width: 78px; height: 78px; border-radius: 16px; overflow: hidden; border: 1px solid rgba(244, 189, 90, 0.18); background: radial-gradient(circle at 50% 28%, rgba(207, 110, 30, 0.38), rgba(12, 10, 9, 0.96)); }
        .shop-card-art img { width: 100%; height: 100%; object-fit: cover; }
        .shop-card-content { display: flex; flex: 1; flex-direction: column; justify-content: center; min-width: 0; }
        .shop-card-title { color: #f6e0b9; font-size: clamp(1.2rem, 2vw, 1.7rem); }
        .shop-card-meta { margin-top: 8px; color: rgba(245, 228, 197, 0.68); font-size: 12px; }
        .shop-card-pills { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
        .shop-card-pill { padding: 5px 8px; border-radius: 999px; border: 1px solid rgba(235, 168, 88, 0.2); background: rgba(119, 55, 22, 0.2); color: #f3cf8c; font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase; }
        @media (max-width: 980px) { .shop-directory-grid { grid-template-columns: 1fr 1fr; } .shop-hero-bar { grid-template-columns: 1fr; } }
        @media (max-width: 640px) { .shop-directory-grid { grid-template-columns: 1fr; } .shop-hero-meta { flex-direction: column; align-items: flex-start; } .shop-hero-callout { justify-content: flex-start; } }
        .server-shop-root { background: #000 !important; }
        .server-shop-root .shop-atmosphere { display: none; }
        .server-shop-root .shop-hero-bar,
        .server-shop-root .shop-directory-shell { background: #050505; }
        .server-shop-root .shop-card { background: #090909; }
        .server-shop-root { color: #f2f2f2; }
        .server-shop-root .shop-kicker { color: #ffffff; }
        .server-shop-root .shop-title { color: #ffffff; text-shadow: 0 0 30px rgba(255, 255, 255, 0.16), 0 3px 0 rgba(0, 0, 0, 0.95); }
        .server-shop-root .shop-subtitle { color: rgba(226, 226, 226, 0.68); }
        .server-shop-root .shop-hero-bar { border-color: rgba(255, 255, 255, 0.28); }
        .server-shop-root .shop-hero-stat span { color: rgba(210, 210, 210, 0.58); }
        .server-shop-root .shop-hero-stat strong { color: #ffffff; }
        .server-shop-root .shop-hero-pill { border-color: rgba(255, 255, 255, 0.3); background: rgba(255, 255, 255, 0.06); color: #ffffff; }
        .server-shop-root .shop-directory-shell { border-color: rgba(255, 255, 255, 0.24); box-shadow: 0 25px 80px rgba(0, 0, 0, 0.5), inset 0 0 0 1px rgba(255, 255, 255, 0.04); }
        .server-shop-root .shop-card { border-color: rgba(255, 255, 255, 0.18); }
        .server-shop-root .shop-card:hover { border-color: rgba(255, 255, 255, 0.58); box-shadow: 0 14px 30px rgba(0, 0, 0, 0.25), 0 0 24px rgba(255, 255, 255, 0.08); }
        .server-shop-root .shop-card::before { background: linear-gradient(180deg, #ffffff, #666666); }
        .server-shop-root .shop-card-art { border-color: rgba(255, 255, 255, 0.14); background: #050505; }
        .item-shop-catalog .shop-card-art { width: 100%; height: 148px; flex-shrink: 0; }
        .item-shop-catalog .shop-card-art img { object-fit: contain; padding: 14px; transform: scale(0.88); }
        .server-shop-root .shop-card-title { color: #f5f5f5; }
        .server-shop-root .shop-card-meta { color: rgba(216, 216, 216, 0.62); }
        .server-shop-root .shop-card-pill { border-color: rgba(255, 255, 255, 0.22); background: rgba(255, 255, 255, 0.06); color: #eeeeee; }
        .server-shop-root .shop-directory-shell { background: rgba(4, 4, 4, 0.96); }
        .server-shop-root .shop-directory-grid { background: linear-gradient(180deg, rgba(255,255,255,0.01), transparent); }
        .server-shop-root .shop-hero-bar { background: linear-gradient(90deg, rgba(18, 12, 9, 0.94), rgba(10, 8, 7, 0.92)); }
        @keyframes servershop-scan { 0% { transform: translateY(-100%); } 100% { transform: translateY(100%); } }
        @keyframes servershop-shine { 0% { transform: translateX(-140%) skewX(-20deg); } 100% { transform: translateX(240%) skewX(-20deg); } }
        @keyframes servershop-float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-6px); } }
        .shop-card-shine::after { content: ""; position: absolute; inset-y: 0; left: 0; width: 34%; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.16), transparent); transform: translateX(-140%) skewX(-20deg); opacity: 0; transition: opacity 0.2s ease; }
        .shop-card-shine:hover::after { opacity: 1; animation: servershop-shine 1.1s ease-out; }
        .shop-hero-stat, .shop-kicker, .shop-title { animation: servershop-float 5.5s ease-in-out infinite; }
        .shop-hero-stat:nth-child(2), .shop-kicker:nth-child(2) { animation-delay: -1.8s; }
        .shop-hero-stat:nth-child(3), .shop-title { animation-delay: -3.2s; }
        .shop-directory-wrap { animation: none; }
      `}</style>
      <div className="shop-atmosphere" aria-hidden>
        <div className="shop-desert" />
        <div className="shop-glow" />
        <div className="shop-smoke shop-smoke-a" />
        <div className="shop-smoke shop-smoke-b" />
        {Array.from({ length: 70 }, (_, index) => (
          <span
            key={index}
            className="shop-ember"
            style={{
              left: `${(index * 13.7) % 100}%`,
              animationDelay: `${(index % 9) * -0.5}s`,
              animationDuration: `${3.2 + (index % 5) * 1.2}s`,
              width: `${2 + (index % 3)}px`,
              height: `${2 + (index % 4)}px`,
            }}
          />
        ))}
      </div>

      <div className="pointer-events-none absolute inset-0 z-[2] overflow-hidden" aria-hidden>
        {Array.from({ length: 96 }, (_, index) => {
          const baseX = (index * 9.3) % 100;
          const baseY = (index * 6.1) % 100;
          const dx = sparkFocus.x - baseX;
          const dy = sparkFocus.y - baseY;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const influence = sparkFocus.active ? Math.max(0, 1 - distance / 18) : 0;
          const repelX = distance === 0 ? 0 : (dx / Math.max(distance, 1)) * influence * 18;
          const repelY = distance === 0 ? 0 : (dy / Math.max(distance, 1)) * influence * 18;
          return (
          <motion.span
            key={index}
            className="absolute rounded-full bg-primary/90"
            style={{
              left: `${baseX}%`,
              top: `${baseY}%`,
              width: `${1 + (index % 3)}px`,
              height: `${1 + (index % 3)}px`,
              boxShadow: `0 0 ${14 + influence * 20}px color-mix(in oklab, var(--primary) ${90 + influence * 8}%, transparent)`,
              opacity: 0.35 + influence * 0.65,
            }}
            animate={{
              y: [0, -120 - (index % 8) * 18 - (sparkFocus.active ? 12 : 0)],
              x: [0, ((index % 5) - 2) * 12 + repelX],
              opacity: [0, 1, 0],
              scale: [0.3, 1 + influence * 1.6, 0.1],
            }}
            transition={{
              duration: 2.8 + (index % 7) * 0.5,
              repeat: Infinity,
              delay: (index % 12) * 0.12,
              ease: "easeOut",
            }}
          />
          );
        })}
      </div>

      {!tool && (
        <div className="pointer-events-none absolute inset-0 z-[1] overflow-hidden" aria-hidden>
          <div
            className="absolute inset-x-0 top-0 h-40 opacity-[0.14]"
            style={{
              background: "linear-gradient(180deg, transparent, rgba(255,200,120,0.9), transparent)",
              animation: "servershop-scan 7s linear infinite",
            }}
          />
          <div className="absolute inset-6 sm:inset-10">
            {(["top-4 left-4 border-l border-t", "top-4 right-4 border-r border-t"] as const).map((pos) => (
              <span key={pos} className={`absolute size-8 sm:size-12 border-primary/60 ${pos}`} />
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes tool-close-shine {
          0% { transform: translateX(-140%) skewX(-20deg); }
          100% { transform: translateX(240%) skewX(-20deg); }
        }
      `}</style>

      <header className="shop-masthead relative z-10">
        {tool && (
          <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Tools</div>
        )}

        <div className="mt-3 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          {!tool && (
            <div className="shop-badge-row">
              <div className="relative flex size-[46px] items-center justify-center">
                <motion.span
                  className="absolute inset-0 rounded-full border-2 border-primary/25 border-t-primary"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
                />
                <PageHexBadge hue={88} size={26} icon={<IconBolt size={22} />} aria-label="Server shop" />
              </div>
              <div>
                <div className="shop-kicker">
                  {BRAND.name} · Tools
                </div>
                <motion.h1
                  className="shop-title flex"
                  initial="hidden"
                  animate="visible"
                  variants={{ visible: { transition: { staggerChildren: 0.03 } } }}
                  aria-label="Server shop."
                >
                  {"Server shop.".split("").map((char, index) => (
                    <motion.span
                      key={index}
                      variants={{
                        hidden: { opacity: 0, y: 18 },
                        visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } },
                      }}
                      style={{ display: "inline-block", whiteSpace: char === " " ? "pre" : "normal" }}
                    >
                      {char}
                    </motion.span>
                  ))}
                </motion.h1>
                <p className="shop-subtitle">
                  Drylands command access. Keep your factions synced, your raids rolling, and your losses patched before the next ember storm hits.
                </p>
              </div>
            </div>
          )}

        </div>

        {!tool && (
          <FadeInUp delay={0.7}>
            <div className="shop-hero-bar">
              <div className="shop-hero-meta">
                <div className="shop-hero-stat">
                  <span>Active services</span>
                  <strong><AnimatedCount value={24} /></strong>
                </div>
                <div className="shop-hero-stat">
                  <span>Raid status</span>
                  <strong>Online</strong>
                </div>
                <div className="shop-hero-stat">
                  <span>Faction sync</span>
                  <strong>Stable</strong>
                </div>
              </div>
              <div className="shop-hero-callout">
                <span className="shop-hero-pill">Season I // Drylands</span>
                <span className="shop-hero-pill">24/7 ops</span>
              </div>
            </div>
          </FadeInUp>
        )}
        {!tool && <hr className="spectrum-divider mt-8" />}

        {!tool && (
          <div className="relative mx-auto mt-5 flex w-fit items-center gap-1 rounded-full border border-white/15 bg-black/70 p-1" role="tablist" aria-label="Shop sections">
            {([ ["server", "Server Shop"], ["items", "Item Shop"] ] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={shopTab === id}
                onClick={() => setShopTab(id)}
                className={`relative z-10 rounded-full px-5 py-2 text-xs uppercase tracking-[0.18em] transition ${shopTab === id ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {shopTab === id && (
                  <motion.span layoutId="shop-tab-pill" className="absolute inset-0 -z-10 rounded-full bg-primary" transition={{ type: "spring", stiffness: 420, damping: 32 }} />
                )}
                {label}
              </button>
            ))}
          </div>
        )}

        {tool && (
          <FadeInUp delay={0.05} className="mt-2">
            <div className="relative flex flex-wrap items-center gap-3 sm:gap-4 pt-3">
              <div className="absolute inset-x-0 top-0 spectrum-divider" />
              <PageHexBadge hue={badgeHue} icon={badgeIcon} size={26} aria-label={mainTitle} />

              <div className="min-w-0 flex-1">
                <div className="text-eyebrow !text-[10px] opacity-70">
                  {subTitle ? (tool.parentTitle ?? "Sub-tool") : "Tool"}
                </div>
                <h2 className="shop-medieval-title text-lg sm:text-xl md:text-2xl leading-tight truncate">
                  {subTitle ? subTitle : mainTitle}
                </h2>
              </div>

              <div className="flex items-center gap-2 pt-1 shrink-0">
                <motion.button
                  type="button"
                  onClick={handleClose}
                  aria-label="Close panel (Esc)"
                  className="group relative inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-primary/30 bg-primary/95 text-primary-foreground shadow-[0_0_20px_rgba(34,211,238,0.28)] transition-all duration-200 hover:scale-[1.03]"
                  whileHover={{ scale: 1.05, boxShadow: "0 0 32px color-mix(in oklab, var(--primary) 65%, transparent)" }}
                  whileTap={{ scale: 0.96 }}
                >
                  <span
                    className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-white/40 blur-sm"
                    style={{ animation: "tool-close-shine 2.6s ease-in-out infinite" }}
                    aria-hidden
                  />
                  <span className="relative flex items-center justify-center">
                    <IconClose size={14} />
                  </span>
                </motion.button>
              </div>

            </div>
          </FadeInUp>
        )}
      </header>

      <div className={tool ? "relative flex min-h-[calc(100vh-13rem)] flex-1 flex-col" : "relative"}>
        {!tool && (
          <>
            {shopTab === "server" ? (
              <ServiceDirectory
                onOpen={(focus) => navigate({ to: "/tools", search: { focus, workspace } })}
                onOpenFull={(path) => navigate({ to: path })}
              />
            ) : (
              <ItemShop />
            )}
          </>
        )}

        {/* Summary band — stays inside the content column, above the panel. */}
        {tool?.Summary && (
          <section className="relative z-20 px-4 sm:px-6">
            <tool.Summary />
          </section>
        )}

        {tool ? (
          <div className="relative z-30 flex min-h-0 min-w-0 flex-1">
            <div className="flex min-h-0 min-w-0 w-full flex-1">
              <FocusedToolPanel tool={tool} onClose={handleClose} />
            </div>
          </div>
        ) : (
          <FocusedToolPanel tool={tool} onClose={handleClose} />
        )}
      </div>
    </div>
  );
}

function ServiceDirectory({
  onOpen,
  onOpenFull,
}: {
  onOpen: (focus: string) => void;
  onOpenFull: (path: string) => void;
}) {
  return (
    <section className="shop-directory-wrap" aria-label="Server service directory">
      <div className="shop-directory-shell">
        <div className="shop-directory-grid">
          {SERVICE_GROUPS.map((group, index) => (
            <motion.button
              key={group.name}
              type="button"
              onClick={() => {
                if (group.name === "Combat & Intel") return onOpenFull("/tools/uav");
                if (group.name === "Vehicle Shop") return onOpen("vehicle-shop");
                if (group.name === "Boosts") return onOpen("boosts");
                if (group.items[0]) onOpen(group.items[0].focus);
              }}
              className="shop-card group shop-card-shine"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.06, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ y: -3 }}
            >
              <span className="shop-card-art" aria-hidden>
                {group.name === "Faction Hub" && <img src="/factions.jpg" alt="" className="h-full w-full object-cover" />}
                {group.name === "Base Ops" && <img src="/baseops.jpg" alt="" className="h-full w-full object-cover" />}
                {group.name === "Zombie Hordes" && <img src="/zombie.jpg" alt="" className="h-full w-full object-cover" />}
                {group.name === "Vehicle Shop" && <img src="/vehicles/ada-4x4.png" alt="" className="h-full w-full object-cover" />}
                {group.name !== "Faction Hub" && group.name !== "Base Ops" && group.name !== "Zombie Hordes" && group.name !== "Vehicle Shop" && (
                  <span
                    className="inline-flex size-full items-center justify-center"
                    style={{ background: `oklch(0.28 0.12 ${group.hue} / 0.55)`, color: `oklch(0.9 0.12 ${group.hue})` }}
                  >
                    {group.icon}
                  </span>
                )}
              </span>
              <span className="shop-card-content">
                <span className="shop-card-title shop-medieval-title">{group.name}</span>
                <span className="shop-card-meta">{group.items.length} services · {group.description}</span>
                <span className="shop-card-pills">
                  {group.items.slice(0, 2).map((item) => (
                    <span key={item.label} className="shop-card-pill">{item.label}</span>
                  ))}
                </span>
              </span>
              <IconArrowRight size={14} className="ml-auto mt-auto text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
            </motion.button>
          ))}
        </div>
      </div>
    </section>
  );
}

function AnimatedCount({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const duration = 900;
    let frame: number;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      setDisplay(Math.round(value * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <>{display}</>;
}

function ItemShop() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof ITEM_FILTERS)[number]>("All");
  const [selected, setSelected] = useState<ShopItem | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [credits, setCredits] = useState(50_000);
  const [owned, setOwned] = useState<string[]>([]);
  const [cart, setCart] = useState<Array<{ item: ShopItem; quantity: number }>>([]);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const [imageAttempt, setImageAttempt] = useState<Record<string, number>>({});
  const [deliveryServer, setDeliveryServer] = useState<DayZServerId>(DAYZ_SERVERS[0].id);
  const [coordX, setCoordX] = useState("");
  const [coordZ, setCoordZ] = useState("");
  const markImageFailed = (id: string) => setFailedImages((current) => new Set(current).add(id));
  const nextImageAttempt = (entry: ShopItem) => {
    const attempt = imageAttempt[entry.id] ?? 0;
    const candidates = imageCandidates(entry);
    if (attempt + 1 >= candidates.length) {
      markImageFailed(entry.id);
      return;
    }
    setImageAttempt((current) => ({ ...current, [entry.id]: attempt + 1 }));
  };
  const useMyLocation = () => {
    setCoordX("7500");
    setCoordZ("7500");
    toast.success("Location captured", { description: "Using your last known in-game position." });
  };
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return ITEM_CATALOG
      .filter((entry) => filter === "All" || filter === "Name A-Z" || entry.category === filter)
      .filter((entry) => !normalized || `${entry.name} ${entry.category} ${entry.detail}`.toLowerCase().includes(normalized))
      .sort((a, b) => filter === "Name A-Z" ? a.name.localeCompare(b.name) : 0);
  }, [filter, query]);

  const choose = (entry: ShopItem) => {
    setSelected(entry);
    setQuantity(1);
  };

  const addItemToCart = (entry: ShopItem, count: number) => {
    setCart((current) => {
      const existing = current.find((line) => line.item.id === entry.id);
      if (existing) return current.map((line) => line.item.id === entry.id ? { ...line, quantity: Math.min(10, line.quantity + count) } : line);
      return [...current, { item: entry, quantity: count }];
    });
    toast.success(`${entry.name} added to cart`, { description: `${count} item${count === 1 ? "" : "s"} ready for checkout.` });
  };

  const addToCart = () => {
    if (!selected) return;
    addItemToCart(selected, quantity);
    setSelected(null);
  };

  const cartTotal = cart.reduce((sum, line) => sum + line.item.price * line.quantity, 0);

  const checkout = () => {
    if (!cart.length) return;
    if (!coordX.trim() || !coordZ.trim()) {
      toast.error("Delivery location required", { description: "Enter coordinates or use \"Spawn at my location\"." });
      return;
    }
    if (credits < cartTotal) {
      toast.error("Not enough credits", { description: `You need ${cartTotal.toLocaleString()} credits.` });
      return;
    }
    setCredits((value) => value - cartTotal);
    setOwned((current) => [...new Set([...current, ...cart.map((line) => line.item.id)])]);
    toast.success("Order confirmed", {
      description: `${cart.length} line item${cart.length === 1 ? "" : "s"} routed to ${deliveryServer} at (${coordX}, ${coordZ}).`,
    });
    setCart([]);
    setCoordX("");
    setCoordZ("");
  };

  const removeFromCart = (id: string) => setCart((current) => current.filter((line) => line.item.id !== id));

  const selectedTotal = selected ? selected.price * quantity : 0;

  return (
    <section className="shop-directory-wrap item-shop-catalog" aria-label="Item Shop catalog">
      <div className="shop-directory-shell">
            <div className="border-b border-white/10 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="shop-medieval-title text-2xl text-primary">Item catalogue</h2>
                  <p className="mt-1 text-xs text-muted-foreground">DayZ field gear, weapons, ammunition, and survival stock.</p>
                </div>
                <div className="text-right text-xs text-muted-foreground"><span className="text-primary">{credits.toLocaleString()}</span> credits · {owned.length} owned</div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <label className="flex min-w-[240px] flex-1 items-center gap-2 rounded-lg border border-white/15 bg-black/60 px-3">
                  <IconSearch size={15} className="text-primary" />
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search every item..." className="w-full bg-transparent py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground" />
                </label>
                <select value={filter} onChange={(event) => setFilter(event.target.value as (typeof ITEM_FILTERS)[number])} className="rounded-lg border border-white/15 bg-black px-3 py-2 text-sm text-foreground outline-none">
                  {ITEM_FILTERS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </div>
            </div>
              <div className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {filtered.map((entry) => (
                    <article key={entry.id} className={`shop-card min-h-0 flex-col text-left ${selected?.id === entry.id ? "border-primary" : ""}`}>
                      <div className="shop-card-art relative flex h-32 w-full shrink-0 items-center justify-center overflow-hidden bg-black">
                        {!failedImages.has(entry.id) ? (
                          <img
                            src={imageCandidates(entry)[imageAttempt[entry.id] ?? 0]}
                            alt={entry.name}
                            loading="lazy"
                            className="absolute inset-0 h-full w-full object-contain bg-black p-2"
                            onError={() => nextImageAttempt(entry)}
                          />
                        ) : (
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">No image</span>
                        )}
                      </div>
                      <button type="button" onClick={() => choose(entry)} className="shop-card-content text-left">
                        <span className="shop-card-title shop-medieval-title">{entry.name}</span>
                        <span className="shop-card-meta">{entry.detail}</span>
                        <div className="mt-3 flex items-center justify-between gap-2"><span className="shop-card-pill">{entry.category}</span><span className="text-xs font-semibold text-primary">{entry.price.toLocaleString()}</span></div>
                        {owned.includes(entry.id) && <span className="mt-2 text-[10px] uppercase tracking-wider text-emerald-300">Owned</span>}
                      </button>
                      <button type="button" onClick={() => addItemToCart(entry, 1)} className="mt-4 rounded-lg border border-primary/50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary transition hover:bg-primary hover:text-primary-foreground">Add to cart</button>
                    </article>
                  ))}
                </div>
                {filtered.length === 0 && <p className="p-10 text-center text-sm text-muted-foreground">No items match that search.</p>}
                {selected && (
                  <div className="mt-5 rounded-xl border border-primary/25 bg-black/80 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div><div className="text-[10px] uppercase tracking-[0.2em] text-primary">Purchase review</div><h3 className="shop-medieval-title mt-1 text-2xl">{selected.name}</h3><p className="mt-1 max-w-xl text-sm text-muted-foreground">{selected.detail}</p></div>
                      <button type="button" onClick={() => setSelected(null)} className="text-xs text-muted-foreground hover:text-foreground">Close</button>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <label className="text-xs uppercase tracking-wider text-muted-foreground">Quantity <input type="number" min={1} max={10} value={quantity} onChange={(event) => setQuantity(Math.min(10, Math.max(1, Number(event.target.value) || 1)))} className="ml-2 w-16 rounded border border-white/15 bg-black px-2 py-1.5 text-center text-foreground" /></label>
                      <span className="text-sm text-muted-foreground">Total <strong className="text-primary">{selectedTotal.toLocaleString()} credits</strong></span>
                      <button type="button" onClick={addToCart} className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:brightness-110">Add to cart</button>
                    </div>
                  </div>
                )}
              </div>

              <aside className="rounded-xl border border-primary/25 bg-black/90 p-4 lg:sticky lg:top-24 lg:h-fit">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="shop-medieval-title text-xl text-primary">Cart</h3>
                  <span className="text-xs text-muted-foreground">{cart.reduce((sum, line) => sum + line.quantity, 0)} items</span>
                </div>
                <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
                  {cart.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Your cart is empty.</p>
                  ) : (
                    cart.map((line) => (
                      <div key={line.item.id} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs">
                        <span className="truncate">{line.item.name} <span className="text-muted-foreground">× {line.quantity}</span></span>
                        <span className="shrink-0 text-primary">{(line.item.price * line.quantity).toLocaleString()}</span>
                        <button type="button" onClick={() => removeFromCart(line.item.id)} className="shrink-0 text-muted-foreground hover:text-white">✕</button>
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-4 border-t border-white/10 pt-4">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-primary">Delivery</div>
                  <select value={deliveryServer} onChange={(event) => setDeliveryServer(event.target.value as DayZServerId)} className="mt-2 w-full rounded-lg border border-white/15 bg-black px-3 py-2 text-sm text-foreground outline-none">
                    {DAYZ_SERVERS.map((server) => <option key={server.id} value={server.id}>{server.label}</option>)}
                  </select>
                  <div className="mt-2 flex gap-2">
                    <input value={coordX} onChange={(event) => setCoordX(event.target.value)} placeholder="X" className="w-full rounded-lg border border-white/15 bg-black px-2 py-2 text-center text-sm text-foreground outline-none" />
                    <input value={coordZ} onChange={(event) => setCoordZ(event.target.value)} placeholder="Z" className="w-full rounded-lg border border-white/15 bg-black px-2 py-2 text-center text-sm text-foreground outline-none" />
                  </div>
                  <button type="button" onClick={useMyLocation} className="mt-2 w-full rounded-lg border border-glass-border px-3 py-2 text-xs text-muted-foreground transition hover:bg-glass/40 hover:text-foreground">Spawn at my location</button>
                </div>

                <div className="mt-4 border-t border-white/10 pt-4">
                  <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Total</span><strong className="text-primary">{cartTotal.toLocaleString()} credits</strong></div>
                  <button type="button" onClick={checkout} disabled={!cart.length} className="mt-3 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40">Complete checkout</button>
                </div>
              </aside>
            </div>
      </div>
    </section>
  );
}
