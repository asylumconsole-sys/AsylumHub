import { Link, useLocation } from "@tanstack/react-router";
import { IconHome, IconCampaign, IconWorkspace, IconSettings } from "@/components/ui-custom/CustomIcon";

const items = [
  { to: "/dashboard", label: "Home", Icon: IconHome },
  { to: "/tools/npc-shop", label: "Shop", Icon: IconCampaign },
  { to: "/tools/base-map-clicker", label: "Map", Icon: IconWorkspace },
  { to: "/account", label: "Account", Icon: IconSettings },
] as const;

export function BottomNav() {
  const loc = useLocation();
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-glass-border bg-black/80 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-4">
        {items.map((it) => {
          const active =
            it.to === "/dashboard"
              ? loc.pathname === "/dashboard"
              : loc.pathname === it.to || loc.pathname.startsWith(`${it.to}/`);
          return (
            <Link
              key={it.to}
              to={it.to}
              preload="intent"
              className={`flex min-h-12 flex-col items-center justify-center gap-0.5 py-2 text-[10px] uppercase tracking-wider ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <it.Icon size={20} />
              <span>{it.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
