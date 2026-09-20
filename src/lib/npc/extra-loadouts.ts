export type NpcLoadoutCopy = {
  blurb: string;
  sections: Array<{ title: string; items: string[] }>;
};

export const EXTRA_LOADOUTS: Record<string, NpcLoadoutCopy> = {
  death_bloomz: {
    blurb: "Lethal efficiency in hazardous sectors. Death Bloomz strikes from the dark.",
    sections: [
      { title: "Weapons", items: ["CZ550 — 10rd mag, hunting scope, improvised suppressor", "AUG — 60rd STANAG, M4 suppressor", "M79 grenade launcher in pack"] },
      { title: "Armor", items: ["Black Gorka helmet, 3-hole balaclava", "NVG headstrap + night vision + 9V", "Black plate carrier + pouches"] },
      { title: "Vest / jacket", items: ["2 improvised suppressors, 4x CZ550 mags, .308 TR box", "2x M7 frag, 2x RGD-5", "3x 60rd STANAG, weapon cleaning kit", "Autumn hunting jacket + beige leather gloves"] },
      { title: "Pants / belt", items: ["Autumn hunter pants, brown jungle boots", "Full canteen, hunting knife in leather sheath"] },
      { title: "Leather sack", items: ["M79, 5x 40mm HE, 2x 40mm chem gas", "Land mine, lockpick, canned peaches", "Field shovel, yellow candycane, rangefinder + 9V"] },
    ],
  },
  raid_1: {
    blurb: "Break through defenses. Raid1 is built for high-intensity breaches.",
    sections: [
      { title: "Weapons", items: ["AKM — 75 drum, suppressor, wood furniture", "Winchester 70 Green — hunting scope, improvised suppressor", "M79 in hunting bag"] },
      { title: "Armor", items: ["BDU ballistic helmet, BDU balaclava, black eye mask", "Plate carrier + pouches"] },
      { title: "Jacket cargo", items: ["Improvised explosive + 2 plastic charges", "Remote detonator", "3x 40mm chem gas, 1x 40mm HE", "Tactical green gloves"] },
      { title: "Pants", items: ["PO-X antidote, morphine, bandage, codeine", "AK 75 drum, 3x .308 tracer"] },
      { title: "Bag / belt", items: ["Hunting bag: M79, cleaning kit, 2x AK drums", "Field shovel, green candycane, rangefinder", "Canteen + combat knife", "6x 40mm HE in vest pouches"] },
    ],
  },
  raid_2: {
    blurb: "NBC breach kit. Raid 2 cracks high-security zones and custom bunkers.",
    sections: [
      { title: "Weapons", items: ["M14 — 20rd, MK4 optic, improvised suppressor", "AKM — 75 drum, suppressor, black wood furniture", "M79 in attack bag"] },
      { title: "NBC", items: ["Gray NBC hood, GP-5 + filter, jacket, gloves, pants, boots"] },
      { title: "Explosives", items: ["Jacket + bag: improvised explosives + remotes", "Pants: 6x 40mm chem gas", "Bag: 11x 40mm HE"] },
      { title: "Hip pack", items: ["Full canteen, punched card, PO-X antidote, bandage"] },
      { title: "Vest / bag", items: ["AK drum, M14 mag, bandage, epoxy", "Spare filter, duct tape, field shovel, rangefinder"] },
    ],
  },
  builder_1: {
    blurb: "Fortify the front line. Builder1 is tools and kits, not a rifleman.",
    sections: [
      { title: "Tools", items: ["Shovel, pickaxe, hammer, pliers", "2x whetstone"] },
      { title: "Build kits", items: ["Fence kit + rope, watchtower kit + rope", "Barbed wire, metal wire, combination lock", "6x nails, wooden log, plank"] },
      { title: "Clothing", items: ["SSH-68 helmet, beige work gloves/boots", "TTsKO jacket + pants, Smersh vest"] },
      { title: "Carry", items: ["Full canteen on belt", "Full water bottle in vest", "Alice bag camo in hands"] },
    ],
  },
  desert_ops: {
    blurb: "Arid-terrain kit. DesertOps holds the sand with SCAR, DMR, and Saiga.",
    sections: [
      { title: "Weapons", items: ["SCAR — 20rd, M4 holo + 9V", "M14 — 20rd, green MK4 + 9V, improvised suppressor", "Saiga + stock + 20rd in coyote bag"] },
      { title: "Mags / ammo", items: ["5x SCAR mags in shirt", "5x M14 mags in bag", "3x Vaiga 20rd in pants", "4x .308 20rd boxes"] },
      { title: "Vest", items: ["2x RGD-5, M68 flashbang, green smoke", "2 improvised suppressors, cleaning kit, 9V"] },
      { title: "Bag / belt", items: ["Coyote brown bag: land mine, bacon, Fronta, meds, sewing kit", "Canteen + combat knife", "Tan shirt, beige cargo/gloves/boots"] },
    ],
  },
  contractor: {
    blurb: "Winter contractor. Surgical M4 + SVD kit for high-risk night work.",
    sections: [
      { title: "Weapons", items: ["M4A1 Black — 60rd STANAG, Baraka, suppressor, CQB stock, MP handguard", "SVD — 10rd VSD, PSO-6, AK suppressor"] },
      { title: "Armor", items: ["Navy ballistic helmet, black-skull balaclava", "NVG strap + goggles + 9V", "Winter plate + pouches"] },
      { title: "Coat / legs", items: ["Dark winter coat: 3x 60rd STANAG, cleaning kit", "Improvised legs: 2 bandage, epoxy", "Black leather gloves, black boots + hunting knife"] },
      { title: "Winter assault bag", items: ["Field shovel, rangefinder, green candycane", "Cola, tetracycline, codeine, 2 morphine", "1PN51 optic + 9V, 3 VSD mags, 7.62x54 box"] },
    ],
  },
  bush_walker: {
    blurb: "Woodland ghillie. Bush Walker stays unseen and shoots first.",
    sections: [
      { title: "Weapons", items: ["M14 — 20rd, green MK4 + 9V, improvised suppressor", "M4A1 Green — 60rd, green OE stock/handguard, reflex + 9V, suppressor", "Combat knife in leather sheath"] },
      { title: "Camo", items: ["Woodland ghillie suit + hood", "BDU balaclava, black eye mask, green tactical gloves"] },
      { title: "Vest", items: ["Green plate + pouches", "2x RGD-5, 2x M68", "2 improvised suppressors, M4 suppressor, cleaning kit"] },
      { title: "Pockets", items: ["Sweater: 3x 60rd STANAG, sewing kit", "Green cargo: 2x .308 TR boxes, 4x M14 mags", "Rangefinder, full canteen, 2 bandage, morphine, epoxy"] },
    ],
  },
};
