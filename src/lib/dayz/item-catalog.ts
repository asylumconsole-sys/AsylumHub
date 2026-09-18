import part00 from "./catalog-parts/part-00.json";
import part01 from "./catalog-parts/part-01.json";
import part02 from "./catalog-parts/part-02.json";
import part03 from "./catalog-parts/part-03.json";

export type ShopCatalogItem = {
  id: string;
  classname: string;
  name: string;
  category: string;
  price: number;
  image: string;
  description: string;
};

/** Full CE catalog (1679 items). Data split under catalog-parts/; item-catalog.json is the same dataset. */
export const ITEM_CATALOG: ShopCatalogItem[] = [
  ...(part00 as ShopCatalogItem[]),
  ...(part01 as ShopCatalogItem[]),
  ...(part02 as ShopCatalogItem[]),
  ...(part03 as ShopCatalogItem[]),
];

const CATEGORY_ORDER = [
  "Weapons",
  "Medical",
  "Tools",
  "Building",
  "Food & Drink",
  "Ammo & Mags",
  "Clothing",
  "Containers",
  "Explosives",
  "Misc",
];

export const ITEM_CATEGORIES: string[] = (() => {
  const present = new Set(ITEM_CATALOG.map((item) => item.category));
  const ordered = CATEGORY_ORDER.filter((c) => present.has(c));
  for (const c of present) {
    if (!ordered.includes(c)) ordered.push(c);
  }
  return ordered;
})();

export function getCatalogItem(id: string): ShopCatalogItem | undefined {
  return ITEM_CATALOG.find((item) => item.id === id);
}
