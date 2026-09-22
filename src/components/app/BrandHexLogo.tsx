import { BRAND } from "@/lib/brand";

interface BrandHexLogoProps {
  size?: number;
  className?: string;
}

export function BrandHexLogo({ size = 42, className }: BrandHexLogoProps) {
  return (
    <span
      className={`group relative grid place-items-center shrink-0${className ? ` ${className}` : ""}`}
      style={{ height: size, width: size }}
    >
      <span
        aria-hidden
        className="absolute inset-[-18%] rounded-full opacity-70 blur-md transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: "radial-gradient(circle, rgba(212,168,75,0.45), transparent 70%)" }}
      />
      <img
        src="/pro-ai.jpg"
        alt={`${BRAND.name} emblem`}
        className="relative h-full w-full object-contain drop-shadow-[0_0_12px_rgba(212,168,75,0.35)]"
        draggable={false}
      />
    </span>
  );
}
