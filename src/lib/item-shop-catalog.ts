import { getItemImageUrls } from "@/lib/item-shop-images";

export type ItemCategory = "Handgun" | "Rifle" | "Sniper Rifle" | "SMG" | "Shotgun" | "Ammo" | "Medical" | "Food" | "Clothing" | "Backpack" | "Attachments" | "Explosives" | "Tools" | "Vehicle" | "Survival" | "Base Building";
export type ShopItem = { id: string; name: string; category: ItemCategory; price: number; detail: string; image: string };

const wikiImage = (file: string) => `/api/wiki-image?file=${encodeURIComponent(file)}`;

const RAW = `glock19|Glock 19|Handgun|1800|Glock 19.png
deagle|Desert Eagle|Handgun|4200|Desert Eagle.png
fnx45|FNX45|Handgun|3600|FNX-45.png
mk-ii|MK II|Handgun|2400|MK II.png
m4a1|M4-A1|Rifle|12500|M4-A1.png
akm|AKM|Rifle|10800|AKM.png
ak74|AK-74|Rifle|9400|AK-74.png
aug|AUG A1|Rifle|11400|AUG A1.png
lar|FAL|Rifle|15200|FAL.png
mosin|Mosin 9130|Sniper Rifle|8500|Mosin 9130.png
svd|SVD|Sniper Rifle|17800|SVD.png
vss|VSS|Sniper Rifle|16400|VSS.png
win70|Winchester 70|Sniper Rifle|9800|Winchester 70.png
mp5|USG-45|SMG|7200|USG-45.png
scorpion|Scorpion EVO 3|SMG|7600|Scorpion EVO 3.png
mp133|BK-133|Shotgun|4600|BK-133.png
doublebarrel|BK-43|Shotgun|3900|BK-43.png
ij70|IJ-70|Handgun|1300|IJ-70.png
ammo-556|5.56x45mm Box|Ammo|900|5.56x45mm Rounds.png
ammo-762|7.62x39mm Box|Ammo|1100|7.62x39mm Rounds.png
ammo-308|.308 Winchester Box|Ammo|1400|.308 Winchester Rounds.png
ammo-9mm|9x19mm Box|Ammo|700|9x19mm Rounds.png
bandage|Bandage|Medical|350|Bandage.png
saline|Saline Bag|Medical|1200|Saline Bag.png
morphine|Morphine Auto-Injector|Medical|950|Morphine Auto-Injector.png
charcoal|Charcoal Tablets|Medical|500|Charcoal Tablets.png
canned|Canned Bacon|Food|260|Canned Bacon.png
water|Canteen|Food|450|Canteen.png
rice|Rice|Food|380|Rice.png
plate|Plate Carrier|Clothing|6800|Plate Carrier.png
ghillie|Ghillie Suit|Clothing|5900|Ghillie Suit.png
helmet|Assault Helmet|Clothing|3200|Assault Helmet.png
knife|Combat Knife|Tools|900|Combat Knife.png
hatchet|Hatchet|Tools|1250|Hatchet.png
lockpick|Lockpick|Tools|2100|Lockpick.png
repair|Weapon Cleaning Kit|Tools|1800|Weapon Cleaning Kit.png
bicycle|Bicycle|Vehicle|6200|Bicycle.png
tent|Medium Tent|Survival|2800|Medium Tent.png
cooking|Cooking Pot|Survival|800|Cooking Pot.png
radio|Field Transceiver|Survival|1700|Field Transceiver.png
m79|M79|Rifle|13200|M79.png
bizon|PP-19 Bizon|SMG|6900|PP-19 Bizon.png
repeater|Repeater Carbine|Rifle|5200|Repeater.png
cr527|CR-527|Rifle|6100|CR-527.png
sks|SK 59/66|Rifle|7300|SK 59-66.png
saiga|Vaiga|Shotgun|8800|Vaiga.png
pioneer|Pioneer|Sniper Rifle|7600|Pioneer.png
bk18|BK-18|Rifle|2800|BK-18.png
nvgoggles|NVGoggles|Attachments|8600|NV-Goggles.png
binoculars|Binoculars|Survival|1600|Binoculars.png
rangefinder|Rangefinder|Survival|2400|Rangefinder.png`;

export const ITEM_CATALOG: ShopItem[] = RAW.trim().split("\n").map((line) => {
  const [id, name, category, price, file] = line.split("|");
  return { id, name, category: category as ItemCategory, price: Number(price), detail: name, image: wikiImage(file) };
});

export const ITEM_FILTERS = ["All", "Name A-Z", "Handgun", "Rifle", "Sniper Rifle", "SMG", "Shotgun", "Ammo", "Medical", "Food", "Clothing", "Backpack", "Attachments", "Explosives", "Tools", "Vehicle", "Survival", "Base Building"] as const;

export function imageCandidates(entry: ShopItem): string[] {
  return getItemImageUrls(entry);
}
