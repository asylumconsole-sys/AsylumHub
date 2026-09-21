import { createFileRoute, useNavigate } from "@tanstack/react-router";
import "@/server-shop.css";
import { useCallback, useState } from "react";
import { z } from "zod";
import { motion } from "framer-motion";
import { IconArrowRight, IconBolt } from "@/components/ui-custom/CustomIcon";
import { PageHexBadge } from "@/components/app/PageHexBadge";
import { FocusedToolPanel } from "@/components/tools/FocusedToolPanel";
import { FadeInUp } from "@/components/motion/WordStagger";
import { BRAND } from "@/lib/brand";
import { SERVICE_GROUPS } from "@/lib/shop-service-groups";
import { ItemShop } from "@/routes/_app/tools/ItemShop";
import { getFocusedTool } from "@/components/tools/focused-tools";

const searchSchema = z.object({
  focus: z.string().optional(),
  workspace: z.string().optional(),
});

export const Route = createFileRoute("/_app/tools/")({
  component: ToolsHub,
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: `Server shop — ${BRAND.name}` }] }),
});

function ToolsHub() {
  const { focus, workspace } = Route.useSearch();
  const navigate = useNavigate();
  const [shopTab, setShopTab] = useState<"server" | "items">("server");
  const tool = getFocusedTool(focus);
  const handleClose = useCallback(() => {
    navigate({ to: "/tools", search: { focus: undefined, workspace }, replace: false });
  }, [navigate, workspace]);

  return (
    <div className="relative flex min-h-[calc(100vh-3rem)] flex-col overflow-x-hidden pb-10">
      <header className="relative z-10 px-4 pb-4 pt-2 sm:px-6">
        <FadeInUp>
          <div className="flex items-center gap-3">
            <PageHexBadge hue={88} size={26} icon={<IconBolt size={22} />} aria-label="Server shop" />
            <h1 className="font-display text-3xl sm:text-5xl">Server shop</h1>
          </div>
          <div className="mt-4 inline-flex rounded-full border border-glass-border p-1">
            {(["server", "items"] as const).map((id) => (
              <button key={id} type="button" onClick={() => setShopTab(id)} className={`rounded-full px-5 py-2 text-xs uppercase tracking-[0.18em] ${shopTab === id ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                {id === "server" ? "Server Shop" : "Item Shop"}
              </button>
            ))}
          </div>
        </FadeInUp>
      </header>
      <div className={tool ? "relative z-10 flex min-h-[calc(100vh-13rem)] flex-1 flex-col" : "relative z-10"}>
        {!tool && (shopTab === "server" ? (
          <ServiceDirectory onOpen={(next) => navigate({ to: "/tools", search: { focus: next, workspace } })} onOpenFull={(path) => navigate({ to: path })} />
        ) : (
          <ItemShop />
        ))}
        <FocusedToolPanel tool={tool} onClose={handleClose} />
      </div>
    </div>
  );
}

function ServiceDirectory({ onOpen, onOpenFull }: { onOpen: (focus: string) => void; onOpenFull: (path: string) => void }) {
  return (
    <section className="shop-directory-wrap" aria-label="Server service directory">
      <div className="shop-directory-shell">
        <div className="shop-directory-grid">
          {SERVICE_GROUPS.map((group, index) => (
            <motion.button
              key={group.name}
              type="button"
              className="shop-card group"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
              whileHover={{ y: -3 }}
              onClick={() => {
                if (group.name === "Combat & Intel") return onOpenFull("/tools/uav");
                if (group.name === "Vehicle Shop") return onOpenFull("/tools/vehicle-shop");
                if (group.name === "NPC Shop") return onOpenFull("/tools/npc-shop");
                if (group.name === "NPC Maker") return onOpenFull("/tools/npc-maker");
                if (group.name === "Boosts") return onOpen("boosts");
                if (group.name === "Base Ops") return onOpen("campaign");
                if (group.items[0]) onOpen(group.items[0].focus);
              }}
            >
              <span className="shop-card-art" aria-hidden>
                <img src={group.image} alt="" />
              </span>
              <span className="shop-card-content">
                <span className="shop-card-title">{group.name}</span>
                <span className="shop-card-meta">{group.description}</span>
              </span>
              <IconArrowRight size={14} className="ml-auto mt-auto text-muted-foreground" />
            </motion.button>
          ))}
        </div>
      </div>
    </section>
  );
}
