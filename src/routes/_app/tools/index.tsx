import { createFileRoute, useNavigate } from "@tanstack/react-router";
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

const SHOP_CSS = `
.server-shop-root { position: relative; min-height: calc(100vh - 3rem); color: #f5e6c8; }
.shop-directory-wrap { position: relative; z-index: 1; width: min(1380px, calc(100% - 32px)); margin: 26px auto 0; }
.shop-directory-shell { border: 1px solid rgba(231, 170, 86, 0.26); border-radius: 28px; background: rgba(16, 11, 9, 0.8); overflow: hidden; }
.shop-directory-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; padding: 18px; }
.shop-card { position: relative; display: flex; align-items: stretch; gap: 14px; min-height: 145px; width: 100%; border: 1px solid rgba(224, 162, 77, 0.2); border-radius: 18px; background: linear-gradient(180deg, rgba(32, 18, 12, 0.88), rgba(15, 11, 9, 0.96)); padding: 16px; text-align: left; overflow: hidden; cursor: pointer; }
.shop-card-art { position: relative; display: grid; place-items: center; width: 78px; height: 78px; flex-shrink: 0; border-radius: 16px; overflow: hidden; border: 1px solid rgba(244, 189, 108, 0.28); background: #050505; }
.shop-card-art img { width: 100%; height: 100%; object-fit: cover; }
.shop-card-content { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 6px; }
.shop-card-title { display: block; font-family: Acme, sans-serif; font-size: 1.15rem; line-height: 1.1; color: #f6de9a; }
.shop-card-meta { display: block; font-size: 12px; line-height: 1.35; color: rgba(245, 230, 200, 0.62); }
.shop-card-pills { display: flex; flex-wrap: wrap; gap: 6px; }
.shop-card-pill { display: inline-flex; border-radius: 999px; border: 1px solid rgba(246, 190, 88, 0.28); padding: 3px 8px; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: #f6de9a; }
@media (max-width: 980px) { .shop-directory-grid { grid-template-columns: 1fr 1fr; } }
@media (max-width: 640px) { .shop-directory-grid { grid-template-columns: 1fr; } }
`;

function ToolsHub() {
  const { focus, workspace } = Route.useSearch();
  const navigate = useNavigate();
  const [shopTab, setShopTab] = useState<"server" | "items">("server");
  const tool = getFocusedTool(focus);
  const handleClose = useCallback(() => {
    navigate({ to: "/tools", search: { focus: undefined, workspace }, replace: false });
  }, [navigate, workspace]);

  return (
    <div className="server-shop-root relative flex min-h-[calc(100vh-3rem)] flex-col overflow-x-hidden pb-10">
      <style>{SHOP_CSS}</style>
      <header className="relative z-10 px-4 pb-4 pt-2 sm:px-6">
        <FadeInUp>
          <div className="flex items-center gap-3">
            <PageHexBadge hue={88} size={26} icon={<IconBolt size={22} />} aria-label="Server shop" />
            <h1 className="font-display text-3xl text-primary sm:text-5xl">Server shop</h1>
          </div>
          <div className="mt-4 inline-flex rounded-full border border-primary/25 bg-black/40 p-1">
            {(["server", "items"] as const).map((id) => (
              <button key={id} type="button" onClick={() => setShopTab(id)} className={`rounded-full px-5 py-2 text-xs uppercase tracking-[0.18em] ${shopTab === id ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                {id === "server" ? "Services" : "Item Shop"}
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
            <motion.div key={group.name} className="shop-card group" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }} whileHover={{ y: -3 }}>
              <button type="button" className="flex min-w-0 flex-1 items-stretch gap-3 text-left" onClick={() => {
                if (group.name === "Combat & Intel") return onOpenFull("/tools/uav");
                if (group.name === "Vehicle Shop") return onOpen("vehicle-shop");
                if (group.name === "Boosts") return onOpen("boosts");
                if (group.name === "Base Ops") return onOpen("campaign");
                if (group.items[0]) onOpen(group.items[0].focus);
              }}>
                <span className="shop-card-art" aria-hidden>
                  {group.name === "Base Ops" && <img src="/baseops.jpg" alt="" />}
                  {group.name === "Zombie Hordes" && <img src="/zombie.jpg" alt="" />}
                  {group.name === "Vehicle Shop" && <img src="/vehicles/ada-4x4.png" alt="" />}
                  {group.name !== "Base Ops" && group.name !== "Zombie Hordes" && group.name !== "Vehicle Shop" && (
                    <span className="inline-flex size-full items-center justify-center" style={{ background: `oklch(0.28 0.12 ${group.hue} / 0.55)`, color: `oklch(0.9 0.12 ${group.hue})` }}>{group.icon}</span>
                  )}
                </span>
                <span className="shop-card-content">
                  <span className="shop-card-title">{group.name}</span>
                  <span className="shop-card-meta">{group.items.length} services · {group.description}</span>
                  <span className="shop-card-pills">
                    {group.items.slice(0, 4).map((item) => (
                      <span key={item.label} className="shop-card-pill" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onOpen(item.focus); }}>
                        {item.label}
                      </span>
                    ))}
                  </span>
                </span>
              </button>
              <IconArrowRight size={14} className="mt-1 shrink-0 text-muted-foreground" />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
