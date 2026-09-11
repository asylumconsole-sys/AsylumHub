import type { ReactNode } from "react";
import { PageHexBadge } from "@/components/app/PageHexBadge";

export function DayZPageHeader({
  title,
  subtitle,
  icon,
  hue = 12,
  actions,
}: {
  title: string;
  subtitle?: string;
  icon: ReactNode;
  hue?: number;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-center gap-3">
        <PageHexBadge icon={icon} hue={hue} aria-label={title} />
        <div>
          <h1 className="text-xl font-semibold">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {actions}
    </div>
  );
}
