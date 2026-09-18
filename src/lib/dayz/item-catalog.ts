import part00 from "./catalog-parts/part-00.json";
import part01 from "./catalog-parts/part-01.json";
import part02 from "./catalog-parts/part-02.json";
import part03 from "./catalog-parts/part-03.json";
import part04 from "./catalog-parts/part-04.json";
import part05 from "./catalog-parts/part-05.json";
import part06 from "./catalog-parts/part-06.json";
import part07 from "./catalog-parts/part-07.json";
import part08 from "./catalog-parts/part-08.json";

export type ShopCatalogItem = {
  id: string;
  classname: string;
  name: string;
  category: string;
  price: number;
  image: string;
  description: string;
};

/** Full CE catalog (1679 items). Parts under catalog-parts/; item-catalog.json mirrors the full dataset. */
export const ITEM_CATALOG: ShopCatalogItem[] = [
  ...(part00 as ShopCatalogItem[]),
  ...(part01 as ShopCatalogItem[]),
  ...(part02 as ShopCatalogItem[]),
  ...(part03 as ShopCatalogItem[]),
  ...(part04 as ShopCatalogItem[]),
  ...(part05 as ShopCatalogItem[]),
  ...(part06 as ShopCatalogItem[]),
  ...(part07 as ShopCatalogItem[]),
  ...(part08 as ShopCatalogItem[]),
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
