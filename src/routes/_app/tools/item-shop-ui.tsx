import { useState } from "react";
export const CATEGORY_PLACEHOLDER: Record<string, string> = {
Weapons: "W", Medical: "M", Tools: "T", Building: "B",
"Food & Drink": "F", "Ammo & Mags": "P", Clothing: "C", Containers: "K",
Explosives: "E", Misc: "P",
};
export function ItemImage({ src, alt, category, className }: { src: string; alt: string; category: string; className?: string }) {
const [failed, setFailed] = useState(false);
if (failed) {
return (
<div className={`grid place-items-center bg-black/40 text-2xl text-muted-foreground ${className ?? ""}`} aria-label={alt}>
{CATEGORY_PLACEHOLDER[category] ?? "P"}
</div>
);
}
return (
<img src={src} alt={alt} loading="lazy" className={`object-contain ${className ?? ""}`} onError={() => setFailed(true)} />
);
}
