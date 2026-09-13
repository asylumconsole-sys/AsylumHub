import { createFileRoute, Link } from "@tanstack/react-router";
import { GlassPanel } from "@/components/ui-custom/GlassPanel";
import { DayZPageHeader } from "@/components/dayz/DayZPageHeader";
import { IconCampaign, IconImport, IconUtm, IconSpark, IconTemplate, IconCalendar } from "@/components/ui-custom/CustomIcon";

export const Route = createFileRoute("/_app/tools/")({
    component: ServerShopHome,
});

const TILES = [
  { to: "/tools/npc-shop", label: "NPC Shop", desc: "Buy NPCs and spawn them on the server.", Icon: IconImport },
  { to: "/tools/item-shop", label: "Item Shop", desc: "Weapons, gear, medical, and supplies.", Icon: IconTemplate },
  { to: "/tools/all-utms", label: "UAV", desc: "Buy UAV, Advanced UAV, and Counter UAV.", Icon: IconUtm },
  { to: "/tools/events", label: "Events", desc: "Start/stop Nitrado events mirrored to Discord.", Icon: IconCalendar },
  { to: "/tools/base-map-clicker", label: "Map", desc: "Chernarus and Livonia satellite map.", Icon: IconCampaign },
  { to: "/operations", label: "Operations", desc: "Rotating field contracts every 5 hours.", Icon: IconSpark },
  ] as const;

function ServerShopHome() {
    return (
          <div className="mx-auto max-w-5xl px-4 py-8">
                <DayZPageHeader title="Server shop" subtitle="NPC shop, item shop, UAV packages, map, and operations" icon={<IconImport size={16} />} hue={32} />
                <div className="grid gap-4 sm:grid-cols-2">
                  {TILES.map((tile) => (
                      <Link key={tile.to} to={tile.to} className="block">
                                  <GlassPanel className="h-full p-5 transition hover:-translate-y-0.5 hover:border-primary/40">
                                                <tile.Icon size={20} className="text-primary" />
                                                <div className="mt-3 font-display text-xl">{tile.label}</div>div>
                                                <p className="mt-1 text-sm text-muted-foreground">{tile.desc}</p>p>
                                  </GlassPanel>GlassPanel>
                      </Link>Link>
                    ))}
                </div>div>
          </div>div>
        );
}
</div>
