/** Official survivor skins. Portraits resolve through DayZ Fandom FilePath. */
export const FANDOM = "https://dayz.fandom.com/wiki/Special:FilePath";

export type SurvivorSkin = {
  id: string;
  classname: string;
  name: string;
  sex: "M" | "F";
  file: string;
};

export const SURVIVOR_SKINS: SurvivorSkin[] = [
  { id: "mirek", classname: "SurvivorM_Mirek", name: "Mirek", sex: "M", file: "DayZ_Survivor_Mirek.png" },
  { id: "denis", classname: "SurvivorM_Denis", name: "Denis", sex: "M", file: "DayZ_Survivor_Denis.png" },
  { id: "boris", classname: "SurvivorM_Boris", name: "Boris", sex: "M", file: "DayZ_Survivor_Boris.png" },
  { id: "cyril", classname: "SurvivorM_Cyril", name: "Cyril", sex: "M", file: "DayZ_Survivor_Cyril.png" },
  { id: "elias", classname: "SurvivorM_Elias", name: "Elias", sex: "M", file: "DayZ_Survivor_Elias.png" },
  { id: "francis", classname: "SurvivorM_Francis", name: "Francis", sex: "M", file: "DayZ_Survivor_Francis.png" },
  { id: "guo", classname: "SurvivorM_Guo", name: "Guo", sex: "M", file: "DayZ_Survivor_Guo.png" },
  { id: "hassan", classname: "SurvivorM_Hassan", name: "Hassan", sex: "M", file: "DayZ_Survivor_Hassan.png" },
  { id: "indar", classname: "SurvivorM_Indar", name: "Indar", sex: "M", file: "DayZ_Survivor_Indar.png" },
  { id: "jose", classname: "SurvivorM_Jose", name: "Jose", sex: "M", file: "DayZ_Survivor_Jose.png" },
  { id: "kaito", classname: "SurvivorM_Kaito", name: "Kaito", sex: "M", file: "DayZ_Survivor_Kaito.png" },
  { id: "lewis", classname: "SurvivorM_Lewis", name: "Lewis", sex: "M", file: "DayZ_Survivor_Lewis.png" },
  { id: "oliver", classname: "SurvivorM_Oliver", name: "Oliver", sex: "M", file: "DayZ_Survivor_Oliver.png" },
  { id: "peter", classname: "SurvivorM_Peter", name: "Peter", sex: "M", file: "DayZ_Survivor_Peter.png" },
  { id: "eva", classname: "SurvivorF_Eva", name: "Eva", sex: "F", file: "DayZ_Survivor_Eva.png" },
  { id: "frida", classname: "SurvivorF_Frida", name: "Frida", sex: "F", file: "DayZ_Survivor_Frida.png" },
  { id: "gabi", classname: "SurvivorF_Gabi", name: "Gabi", sex: "F", file: "DayZ_Survivor_Gabi.png" },
  { id: "helga", classname: "SurvivorF_Helga", name: "Helga", sex: "F", file: "DayZ_Survivor_Helga.png" },
  { id: "irena", classname: "SurvivorF_Irena", name: "Irena", sex: "F", file: "DayZ_Survivor_Irena.png" },
  { id: "judy", classname: "SurvivorF_Judy", name: "Judy", sex: "F", file: "DayZ_Survivor_Judy.png" },
  { id: "keiko", classname: "SurvivorF_Keiko", name: "Keiko", sex: "F", file: "DayZ_Survivor_Keiko.png" },
  { id: "linda", classname: "SurvivorF_Linda", name: "Linda", sex: "F", file: "DayZ_Survivor_Linda.png" },
  { id: "maria", classname: "SurvivorF_Maria", name: "Maria", sex: "F", file: "DayZ_Survivor_Maria.png" },
  { id: "naomi", classname: "SurvivorF_Naomi", name: "Naomi", sex: "F", file: "DayZ_Survivor_Naomi.png" },
];

export function survivorPortrait(skin: SurvivorSkin) {
  return `${FANDOM}/${encodeURIComponent(skin.file)}`;
}

export type GearSlot =
  | "hands"
  | "shoulder"
  | "melee"
  | "head"
  | "mask"
  | "eyes"
  | "vest"
  | "jacket"
  | "shirt"
  | "pants"
  | "shoes"
  | "backpack"
  | "gloves"
  | "armband";

export const GEAR_SLOTS: Array<{ id: GearSlot; label: string }> = [
  { id: "hands", label: "Hands" },
  { id: "shoulder", label: "Shoulders" },
  { id: "melee", label: "Melee" },
  { id: "head", label: "Head" },
  { id: "mask", label: "Mask" },
  { id: "eyes", label: "Eyes" },
  { id: "vest", label: "Vest" },
  { id: "jacket", label: "Jacket" },
  { id: "shirt", label: "Shirt" },
  { id: "pants", label: "Pants" },
  { id: "shoes", label: "Shoes" },
  { id: "backpack", label: "Backpack" },
  { id: "gloves", label: "Gloves" },
  { id: "armband", label: "Armband" },
];

export type CatalogItem = {
  classname: string;
  name: string;
  slot: GearSlot | "cargo" | "attach";
  kind: "weapon" | "clothing" | "attach" | "cargo";
};

export const CATALOG: CatalogItem[] = [
  { classname: "M4A1", name: "M4-A1", slot: "hands", kind: "weapon" },
  { classname: "AKM", name: "AKM", slot: "hands", kind: "weapon" },
  { classname: "Winchester70", name: "Winchester 70", slot: "hands", kind: "weapon" },
  { classname: "CZ75", name: "CZ75", slot: "hands", kind: "weapon" },
  { classname: "MP5K", name: "MP5-K", slot: "hands", kind: "weapon" },
  { classname: "SVD", name: "SVD", slot: "shoulder", kind: "weapon" },
  { classname: "SKS", name: "SKS", slot: "shoulder", kind: "weapon" },
  { classname: "Mosim9130", name: "Mosin 91/30", slot: "shoulder", kind: "weapon" },
  { classname: "FirefighterAxe", name: "Fire axe", slot: "melee", kind: "weapon" },
  { classname: "CombatKnife", name: "Combat knife", slot: "melee", kind: "weapon" },
  { classname: "BallisticHelmet_Black", name: "Ballistic helmet", slot: "head", kind: "clothing" },
  { classname: "GorkaHelmet", name: "Gorka helmet", slot: "head", kind: "clothing" },
  { classname: "BalaclavaMask_Blackskull", name: "Skull balaclava", slot: "mask", kind: "clothing" },
  { classname: "GasMask", name: "Gas mask", slot: "mask", kind: "clothing" },
  { classname: "TacticalGoggles", name: "Tactical goggles", slot: "eyes", kind: "clothing" },
  { classname: "PlateCarrierVest", name: "Plate carrier", slot: "vest", kind: "clothing" },
  { classname: "UKAssVest_Black", name: "UK assault vest", slot: "vest", kind: "clothing" },
  { classname: "M65Jacket_Black", name: "M65 jacket", slot: "jacket", kind: "clothing" },
  { classname: "TTsKOJacket_Camo", name: "TTsKO jacket", slot: "jacket", kind: "clothing" },
  { classname: "TacticalShirt_Black", name: "Tactical shirt", slot: "shirt", kind: "clothing" },
  { classname: "CargoPants_Black", name: "Cargo pants", slot: "pants", kind: "clothing" },
  { classname: "GorkaPants_Flat", name: "Gorka pants", slot: "pants", kind: "clothing" },
  { classname: "MilitaryBoots_Black", name: "Military boots", slot: "shoes", kind: "clothing" },
  { classname: "CombatBoots_Black", name: "Combat boots", slot: "shoes", kind: "clothing" },
  { classname: "CoyoteBag_Brown", name: "Coyote bag", slot: "backpack", kind: "clothing" },
  { classname: "MountainBag_Red", name: "Mountain bag", slot: "backpack", kind: "clothing" },
  { classname: "TacticalGloves_Black", name: "Tactical gloves", slot: "gloves", kind: "clothing" },
  { classname: "Armband_Black", name: "Black armband", slot: "armband", kind: "clothing" },
  { classname: "M4_OEBttstck", name: "M4 stock", slot: "attach", kind: "attach" },
  { classname: "M4_Suppressor", name: "M4 suppressor", slot: "attach", kind: "attach" },
  { classname: "ACOGOptic", name: "ACOG", slot: "attach", kind: "attach" },
  { classname: "M68Optic", name: "M68 CCO", slot: "attach", kind: "attach" },
  { classname: "Mag_STANAG_30Rnd", name: "STANAG 30", slot: "attach", kind: "attach" },
  { classname: "AK_Suppressor", name: "AK suppressor", slot: "attach", kind: "attach" },
  { classname: "PSO1Optic", name: "PSO-1", slot: "attach", kind: "attach" },
  { classname: "Mag_AKM_30Rnd", name: "AKM 30", slot: "attach", kind: "attach" },
  { classname: "BandageDressing", name: "Bandage", slot: "cargo", kind: "cargo" },
  { classname: "Canteen", name: "Canteen", slot: "cargo", kind: "cargo" },
  { classname: "AmmoBox_556x45_20Rnd", name: "5.56 box", slot: "cargo", kind: "cargo" },
  { classname: "AmmoBox_762x39_20Rnd", name: "7.62 box", slot: "cargo", kind: "cargo" },
  { classname: "TacticalBaconCan", name: "Tactical bacon", slot: "cargo", kind: "cargo" },
  { classname: "Morphine", name: "Morphine", slot: "cargo", kind: "cargo" },
  { classname: "Handcuffs", name: "Handcuffs", slot: "cargo", kind: "cargo" },
  { classname: "HandcuffKeys", name: "Handcuff keys", slot: "cargo", kind: "cargo" },
];

export type Equipped = {
  classname: string;
  name: string;
  attachments: string[];
  cargo: string[];
};

export type BuilderDraft = {
  name: string;
  skinId: string;
  slots: Partial<Record<GearSlot, Equipped>>;
  handcuffed: boolean;
};

export function emptyDraft(): BuilderDraft {
  return { name: "", skinId: "mirek", slots: {}, handcuffed: false };
}
