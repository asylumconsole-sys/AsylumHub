import { THE_BEAMER_CFG_SPAWNABLETYPES } from "@/lib/npc/the-beamer-cfg";
import { SKULL_HUNTER_CFG_SPAWNABLETYPES } from "@/lib/npc/skull-hunter-cfg";
import { THE_BEAMER_LOADOUT } from "@/lib/npc/the-beamer-loadout";
import { SKULL_HUNTER_LOADOUT } from "@/lib/npc/skull-hunter-loadout";
import { EXTRA_LOADOUTS, type NpcLoadoutCopy } from "@/lib/npc/extra-loadouts";

export type ShopNpc = {
  id: string;
  name: string;
  role: string;
  category: string;
  price: number;
  description: string;
  cfgSpawnabletypes?: string;
};

export const NPCS: ShopNpc[] = [
  { id: "the_beamer", name: "The Beamer", role: "Elite Operator", category: "Combat", price: 2500, description: "M14, M4A1, armor, medical, field kit.", cfgSpawnabletypes: THE_BEAMER_CFG_SPAWNABLETYPES },
  { id: "skull_hunter", name: "Skull Hunter", role: "Shadow Hunter", category: "Combat", price: 2500, description: "Suppressed SVD + PSO-6, drum AKM, engraved 1911, black plate, NVGs, PO-X.", cfgSpawnabletypes: SKULL_HUNTER_CFG_SPAWNABLETYPES },
  { id: "death_bloomz", name: "Death Bloomz", role: "Hazard Striker", category: "Combat", price: 2500, description: "CZ550 + hunting scope, suppressed AUG, M79, 40mm HE/chem, black plate." },
  { id: "raid_1", name: "Raid 1", role: "Breacher", category: "Raid", price: 2500, description: "Drum AKM, Winchester 70, M79, plastic explosive, 40mm, BDU kit." },
  { id: "raid_2", name: "Raid 2", role: "NBC Breacher", category: "Raid", price: 2500, description: "M14 + drum AKM, full gray NBC, punched card, remote charges, 40mm chem/HE." },
  { id: "builder_1", name: "Builder 1", role: "Fortify", category: "Support", price: 2500, description: "Shovel, pickaxe, fence + watchtower kits, nails, lock, Alice logs/planks." },
  { id: "desert_ops", name: "Desert Ops", role: "Sand Operator", category: "Combat", price: 2500, description: "SCAR + holo, suppressed M14, Saiga, coyote bag, tan plate." },
  { id: "contractor", name: "Contractor", role: "Night Contractor", category: "Combat", price: 2500, description: "Black M4A1 + SVD PSO-6, winter plate, NVGs, 1PN51." },
  { id: "bush_walker", name: "Bush Walker", role: "Ghillie", category: "Recon", price: 2500, description: "Woodland ghillie, suppressed M14 + green M4, green plate." },
];

export function loadoutFor(id: string): NpcLoadoutCopy | null {
  if (id === "the_beamer") return THE_BEAMER_LOADOUT;
  if (id === "skull_hunter") return SKULL_HUNTER_LOADOUT;
  return EXTRA_LOADOUTS[id] ?? null;
}
