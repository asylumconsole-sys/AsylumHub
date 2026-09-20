import { Link, useLocation } from "@tanstack/react-router";
import { IconHome, IconCampaign, IconWorkspace, IconSettings, IconBolt } from "@/components/ui-custom/CustomIcon";

const items = [
  { to: "/dashboard", label: "Home", Icon: IconHome },
  { to: "/tools", label: "Shop", Icon: IconCampaign },
  { to: "/tools", label: "Build", Icon: IconBolt, search: { focus: "pro-build" } },
  { to: "/tools/base-map-clicker", label: "Map", Icon: IconWorkspace },
  { to: "/account", label: "Account", Icon: IconSettings },
] as const;

export function BottomNav() {
  const loc = useLocation();
  const focus = String((loc.search as { focus?: string })?.focus || "");
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-glass-border bg-black/80 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-5">
        {items.map((it) => {
          const active =
            it.label === "Build"
              ? focus === "pro-build"
              : it.to === "/dashboard"
                ? loc.pathname === "/dashboard"
                : it.to === "/tools" && it.label === "Shop"
                  ? loc.pathname === "/tools" && focus !== "pro-build"
                  : loc.pathname === it.to || loc.pathname.startsWith(`${it.to}/`);
          return (
            <Link
              key={it.label}
              to={it.to}
              search={"search" in it && it.search ? (it.search as never) : ({} as never)}
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
