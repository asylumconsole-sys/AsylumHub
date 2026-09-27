import { ITEM_CATALOG_COMPACT_0 } from "./item-catalog-data-0";
import { ITEM_CATALOG_COMPACT_1 } from "./item-catalog-data-1";
import { ITEM_CATALOG_COMPACT_2 } from "./item-catalog-data-2";
import { ITEM_CATALOG_COMPACT_3 } from "./item-catalog-data-3";
import { ITEM_CATALOG_COMPACT_4 } from "./item-catalog-data-4";
import { ITEM_CATALOG_COMPACT_5 } from "./item-catalog-data-5";
import { ITEM_CATALOG_COMPACT_6 } from "./item-catalog-data-6";
import { ITEM_CATALOG_COMPACT_7 } from "./item-catalog-data-7";
import { ITEM_CATALOG_COMPACT_8 } from "./item-catalog-data-8";
import { ITEM_CATALOG_COMPACT_9 } from "./item-catalog-data-9";
import { ITEM_CATALOG_COMPACT_10 } from "./item-catalog-data-10";
import { ITEM_CATALOG_COMPACT_11 } from "./item-catalog-data-11";
import { ITEM_CATALOG_COMPACT_12 } from "./item-catalog-data-12";
import { ITEM_CATALOG_COMPACT_13 } from "./item-catalog-data-13";
import { ITEM_CATALOG_COMPACT_14 } from "./item-catalog-data-14";
import { ITEM_CATALOG_COMPACT_15 } from "./item-catalog-data-15";

const CATEGORY_BY_INDEX = [
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
] as const;

export type ShopCatalogItem = {
  id: string;
  classname: string;
  name: string;
  category: string;
  price: number;
  image: string;
  images: string[];
  description: string;
};

const SEP = "\u001f";

function imageList(classname: string, _name: string) {
  // Locally hosted icon (see /api/item-image); falls back to a clean placeholder.
  return [`/api/item-image/${encodeURIComponent(classname)}`];
}

function parseCompact(block: string): ShopCatalogItem[] {
  return block.split("\n").filter(Boolean).map((line) => {
    const [classname, name, priceStr, catIdx] = line.split(SEP);
    const category = CATEGORY_BY_INDEX[Number(catIdx)] ?? "Misc";
    const images = imageList(classname, name);
    return {
      id: classname,
      classname,
      name,
      category,
      price: Number(priceStr),
      image: images[0],
      images,
      description: category,
    };
  });
}

export const ITEM_CATALOG: ShopCatalogItem[] = [
  ...parseCompact(ITEM_CATALOG_COMPACT_0),
  ...parseCompact(ITEM_CATALOG_COMPACT_1),
  ...parseCompact(ITEM_CATALOG_COMPACT_2),
  ...parseCompact(ITEM_CATALOG_COMPACT_3),
  ...parseCompact(ITEM_CATALOG_COMPACT_4),
  ...parseCompact(ITEM_CATALOG_COMPACT_5),
  ...parseCompact(ITEM_CATALOG_COMPACT_6),
  ...parseCompact(ITEM_CATALOG_COMPACT_7),
  ...parseCompact(ITEM_CATALOG_COMPACT_8),
  ...parseCompact(ITEM_CATALOG_COMPACT_9),
  ...parseCompact(ITEM_CATALOG_COMPACT_10),
  ...parseCompact(ITEM_CATALOG_COMPACT_11),
  ...parseCompact(ITEM_CATALOG_COMPACT_12),
  ...parseCompact(ITEM_CATALOG_COMPACT_13),
  ...parseCompact(ITEM_CATALOG_COMPACT_14),
  ...parseCompact(ITEM_CATALOG_COMPACT_15),
];

export const ITEM_CATEGORIES: string[] = [...CATEGORY_BY_INDEX];

export function getCatalogItem(id: string): ShopCatalogItem | undefined {
  return ITEM_CATALOG.find((item) => item.id === id);
}
