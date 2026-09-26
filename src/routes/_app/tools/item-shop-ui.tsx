import { useState } from "react";

export const CATEGORY_PLACEHOLDER: Record<string, string> = {
  Weapons: "W",
  Medical: "M",
  Tools: "T",
  Building: "B",
  "Food & Drink": "F",
  "Ammo & Mags": "P",
  Clothing: "C",
  Containers: "K",
  Explosives: "E",
  Misc: "P",
};

export function ItemImage({
  src,
  srcs,
  alt,
  category,
  className,
}: {
  src: string;
  srcs?: string[];
  alt: string;
  category: string;
  className?: string;
}) {
  const list = (srcs && srcs.length ? srcs : [src]).filter(Boolean);
  const [i, setI] = useState(0);
  const current = list[i];
  if (!current) {
    return (
      <div className={`grid place-items-center bg-black/40 text-2xl text-muted-foreground ${className ?? ""}`} aria-label={alt}>
        {CATEGORY_PLACEHOLDER[category] ?? "P"}
      </div>
    );
  }
  return (
    <img
      src={current}
      alt={alt}
      loading="lazy"
      className={`object-contain ${className ?? ""}`}
      onError={() => setI((n) => n + 1)}
    />
  );
}
