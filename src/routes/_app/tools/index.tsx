import { createFileRoute, useNavigate } from "@tanstack/react-router";
import "@/server-shop.css";
import { useCallback, useState } from "react";
import { z } from "zod";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { IconArrowRight, IconBolt } from "@/components/ui-custom/CustomIcon";
import { PageHexBadge } from "@/components/app/PageHexBadge";
import { FocusedToolPanel } from "@/components/tools/FocusedToolPanel";
import { FadeInUp } from "@/components/motion/WordStagger";
import { BRAND } from "@/lib/brand";
import { ADDON_GROUPS, SERVICE_GROUPS, type ShopGroup } from "@/lib/shop-service-groups";
import { ItemShop } from "@/routes/_app/tools/ItemShop";
import { DonatorShop } from "@/routes/_app/tools/DonatorShop";
import { getFocusedTool } from "@/components/tools/focused-tools";

const searchSchema = z.object({
  focus: z.string().optional(),
  workspace: z.string().optional(),
});

export const Route = createFileRoute("/_app/tools/")({
  component: ToolsHub,
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: `Shop — ${BRAND.name}` }] }),
});

type ShopTab = "server" | "items" | "donator" | "addons";

const TABS: Array<[ShopTab, string]> = [
  ["server", "Services"],
  ["items", "Item Shop"],
  ["donator", "Donator Shop"],
  ["addons", "Addons"],
];

function ToolsHub() {
  const { focus, workspace } = Route.useSearch();
  const navigate = useNavigate();
  const [shopTab, setShopTab] = useState<ShopTab>("server");
  const tool = getFocusedTool(focus);
  const handleClose = useCallback(() => {
    navigate({ to: "/tools", search: { focus: undefined, workspace }, replace: false });
  }, [navigate, workspace]);

  return (
    <div className="relative flex min-h-[calc(100vh-3rem)] flex-col overflow-x-hidden pb-10">
      <style>{`
        @keyframes shop-tab-shine { 0% { transform: translateX(-130%) skewX(-18deg); } 100% { transform: translateX(230%) skewX(-18deg); } }
        @keyframes shop-tab-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(212,168,75,0.35); } 50% { box-shadow: 0 0 22px 2px rgba(212,168,75,0.45); } }
      `}</style>
      <header className="relative z-10 px-4 pb-4 pt-2 sm:px-6">
        <FadeInUp>
          <div className="flex flex-col items-center text-center">
            <div className="flex items-center gap-3">
              <PageHexBadge hue={88} size={26} icon={<IconBolt size={22} />} aria-label="Shop" />
              <h1 className="font-display text-3xl sm:text-5xl">Shop</h1>
            </div>
            <div className="relative mt-5 inline-flex flex-wrap justify-center gap-1 rounded-full border border-[#d4a84b]/35 bg-black/70 p-1.5 shadow-[0_0_30px_rgba(212,168,75,0.12)]">
              {TABS.map(([id, label]) => {
                const on = shopTab === id;
                return (
                  <motion.button
                    key={id}
                    type="button"
                    onClick={() => setShopTab(id)}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    className={`relative overflow-hidden rounded-full px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] transition ${
                      on ? "bg-[#d4a84b] text-black" : "text-zinc-400 hover:text-[#e8c56a]"
                    }`}
                    style={on ? { animation: "shop-tab-pulse 2.4s ease-in-out infinite" } : undefined}
                  >
                    {on ? (
                      <span className="pointer-events-none absolute inset-y-0 w-10 bg-white/35" style={{ animation: "shop-tab-shine 2.2s linear infinite" }} />
                    ) : null}
                    <span className="relative">{label}</span>
                  </motion.button>
                );
              })}
            </div>
          </div>
        </FadeInUp>
      </header>
      <div className={tool ? "relative z-10 flex min-h-[calc(100vh-13rem)] flex-1 flex-col" : "relative z-10"}>
        {!tool && (shopTab === "server" ? (
          <ServiceDirectory
            groups={SERVICE_GROUPS}
            onOpen={(next) => navigate({ to: "/tools", search: { focus: next, workspace } })}
            onOpenFull={(path) => navigate({ to: path })}
          />
        ) : shopTab === "items" ? (
          <ItemShop />
        ) : shopTab === "addons" ? (
          <ServiceDirectory
            groups={ADDON_GROUPS}
            onOpen={(next) => navigate({ to: "/tools", search: { focus: next, workspace } })}
            onOpenFull={(path) => navigate({ to: path })}
          />
        ) : (
          <DonatorShop />
        ))}
        <FocusedToolPanel tool={tool} onClose={handleClose} />
      </div>
    </div>
  );
}

function ServiceDirectory({
  groups,
  onOpen,
  onOpenFull,
}: {
  groups: ShopGroup[];
  onOpen: (focus: string) => void;
  onOpenFull: (path: string) => void;
}) {
  return (
    <section className="shop-directory-wrap" aria-label="Shop services">
      <div className="shop-directory-shell">
        <div className="shop-directory-grid">
          {groups.map((group, index) => (
            <motion.button
              key={group.name}
              type="button"
              className="shop-card group"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
              whileHover={{ y: -3 }}
              onClick={() => {
                if (group.name === "NPC Maker") {
                  toast.message("NPC Maker — Coming soon");
                  return;
                }
                if (group.name === "Combat & Intel") return onOpenFull("/tools/uav");
                if (group.name === "Vehicle Shop") return onOpenFull("/tools/vehicle-shop");
                if (group.name === "NPC Shop") return onOpenFull("/tools/npc-shop");
                if (group.name === "Boosts") return onOpen("boosts");
                if (group.name === "Priority Queue") return onOpen(group.items[0]?.focus ?? "priority-queue");
                if (group.name === "Base Ops") return onOpen("campaign");
                if (group.items[0]) onOpen(group.items[0].focus);
              }}
            >
              <span className="shop-card-art" aria-hidden>
                <img src={group.image} alt="" />
              </span>
              <span className="shop-card-content">
                <span className="shop-card-title">{group.name}</span>
                <span className="shop-card-meta">{group.name === "NPC Maker" ? "Coming soon" : group.description}</span>
              </span>
              <IconArrowRight size={14} className="ml-auto mt-auto text-muted-foreground" />
            </motion.button>
          ))}
        </div>
      </div>
    </section>
  );
}
