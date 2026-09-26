import { readFile } from "node:fs/promises";
import path from "node:path";
import { IMAGE_DIR, catalog, findItem, shopData } from "./catalog.server";

const LETTER: Record<string, string> = { Weapons: "W", Medical: "+", Tools: "T", Building: "B", "Food & Drink": "F", "Ammo & Mags": "A", Clothing: "C", Containers: "K", Explosives: "E" };

function placeholder(label: string, category: string) {
  const l = (LETTER[category] || label.charAt(0) || "?").toUpperCase().replace(/[<&>"]/g, "");
  const name = label.replace(/[<&>"]/g, "").slice(0, 22);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1b1b1b"/><stop offset="1" stop-color="#0b0b0b"/></linearGradient></defs><rect width="160" height="160" rx="14" fill="url(#g)"/><rect x="6" y="6" width="148" height="148" rx="10" fill="none" stroke="#d4a84b" stroke-opacity=".35" stroke-dasharray="4 4"/><text x="80" y="92" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-size="54" fill="#d4a84b" fill-opacity=".8">${l}</text><text x="80" y="136" text-anchor="middle" font-family="Arial,sans-serif" font-size="11" fill="#9a9a9a">${name}</text></svg>`;
}

export async function itemImageResponse(classname: string) {
  const cls = String(classname || "").replace(/\.(webp|png|svg)$/i, "");
  if (!/^[A-Za-z0-9_\-]{1,80}$/.test(cls)) return new Response("bad classname", { status: 400 });
  const d = await shopData();
  const blob = d.images[cls] || Object.entries(d.images).find(([k]) => k.toLowerCase() === cls.toLowerCase())?.[1];
  if (blob && /^[a-f0-9]{8,40}\.webp$/.test(blob)) {
    const buf = await readFile(path.join(IMAGE_DIR, blob)).catch(() => null);
    if (buf) return new Response(new Uint8Array(buf), { headers: { "content-type": "image/webp", "cache-control": "public, max-age=604800, immutable" } });
  }
  const it = await findItem(cls);
  return new Response(placeholder(it?.name || cls, it?.category || ""), {
    headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "public, max-age=3600", "x-image-fallback": "1" },
  });
}

/** Legacy /api/wiki-image?file=Name.png: resolve to a local icon by classname or item name (no external fetch). */
export async function legacyWikiImage(file: string) {
  const stem = String(file || "").replace(/\.(png|jpe?g|webp|gif)$/i, "").trim();
  const direct = await findItem(stem.replace(/\s+/g, "_"));
  if (direct) return itemImageResponse(direct.classname);
  const n = stem.toLowerCase().replace(/[^a-z0-9]/g, "");
  const hit = (await catalog()).items.find((i) => i.name.toLowerCase().replace(/[^a-z0-9]/g, "") === n);
  if (hit) return itemImageResponse(hit.classname);
  return itemImageResponse(/^[A-Za-z0-9_\-]{1,80}$/.test(stem) ? stem : "Unknown");
}
