import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GlassPanel } from "@/components/ui-custom/GlassPanel";
import { PageHexBadge } from "@/components/app/PageHexBadge";
import { IconSearch, IconTemplate } from "@/components/ui-custom/CustomIcon";
import { toast } from "sonner";
import {
  getEconomyBalance,
  getShopInventory,
  purchaseShopItem,
} from "@/lib/economy.functions";
import { useAuth } from "@/contexts/AuthContext";

export const Route = createFileRoute("/_app/tools/item-shop")({
  component: ItemShopContent,
});

type ShopItem = {
  id: string;
  name: string;
  category: string;
  price: number;
  description: string;
};

const ITEMS: ShopItem[] = [
  { id: "akm", name: "AKM", category: "Weapons", price: 8500, description: "7.62 assault rifle for mid-range fights." },
  { id: "m4a1", name: "M4-A1", category: "Weapons", price: 12000, description: "5.56 platform with modular attachments." },
  { id: "mosin", name: "Mosin 9130", category: "Weapons", price: 6500, description: "Bolt-action rifle for long-range pressure." },
  { id: "plate_carrier", name: "Plate Carrier", category: "Gear", price: 7000, description: "Torso armor with pouch capacity." },
  { id: "tactical_helmet", name: "Tactical Helmet", category: "Gear", price: 4500, description: "Head protection for close combat." },
  { id: "assault_pack", name: "Assault Pack", category: "Gear", price: 3200, description: "Compact pack for fast loot runs." },
  { id: "saline_bag", name: "Saline Bag IV", category: "Medical", price: 1800, description: "Restores blood volume in the field." },
  { id: "morphine", name: "Morphine Auto-Injector", category: "Medical", price: 2200, description: "Stabilizes shock after heavy hits." },
  { id: "bandage_kit", name: "Field Bandage Kit", category: "Medical", price: 900, description: "Stops bleeding and patches cuts." },
  { id: "canned_bacon", name: "Canned Bacon", category: "Food", price: 600, description: "High-calorie canned meat." },
  { id: "purified_water", name: "Purified Water", category: "Food", price: 400, description: "Clean hydration for long ops." },
  { id: "energy_bar", name: "Energy Bar", category: "Food", price: 350, description: "Quick stamina food for pushes." },
  { id: "nvg", name: "NVG Headstrap", category: "Gear", price: 15000, description: "Night vision for dark raids." },
  { id: "suppressor_556", name: "5.56 Suppressor", category: "Weapons", price: 5000, description: "Quiets compatible carbines." },
  { id: "ammo_762_crate", name: "7.62 Ammo Crate", category: "Ammo", price: 2800, description: "Bulk rifle ammunition resupply." },
  { id: "ammo_556_crate", name: "5.56 Ammo Crate", category: "Ammo", price: 2600, description: "Bulk carbine ammunition resupply." },
];

export function ItemShopContent() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const playerId = user?.id || "demo-user";
  const displayName =
    (typeof user?.user_metadata?.name === "string" && user.user_metadata.name) ||
    user?.email ||
    playerId;

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [selected, setSelected] = useState<ShopItem | null>(null);

  const balanceQ = useQuery({
    queryKey: ["economy-balance", playerId],
    queryFn: () => getEconomyBalance({ data: { playerId } }),
  });
  const invQ = useQuery({
    queryKey: ["shop-inventory", playerId],
    queryFn: () => getShopInventory({ data: { playerId } }),
  });

  const owned = invQ.data?.owned ?? [];
  const credits = balanceQ.data?.balance ?? 0;
  const categories = ["All", ...Array.from(new Set(ITEMS.map((i) => i.category)))];
  const filtered = useMemo(
    () =>
      ITEMS.filter(
        (item) =>
          (category === "All" || item.category === category) &&
          `${item.name} ${item.description}`.toLowerCase().includes(query.toLowerCase()),
      ).sort((a, b) => a.price - b.price),
    [category, query],
  );

  const buyMut = useMutation({
    mutationFn: (item: ShopItem) =>
      purchaseShopItem({
        data: {
          playerId,
          displayName,
          itemId: item.id,
          itemName: item.name,
          price: item.price,
          category: "item",
        },
      }),
    onSuccess: (res, item) => {
      if (res.alreadyOwned) toast.message(`${item.name} already owned`);
      else {
        toast.success(`${item.name} purchased`, {
          description: `Debited ${item.price.toLocaleString()} credits.`,
        });
      }
      qc.invalidateQueries({ queryKey: ["economy-balance", playerId] });
      qc.invalidateQueries({ queryKey: ["shop-inventory", playerId] });
      qc.invalidateQueries({ queryKey: ["economy-board"] });
      qc.invalidateQueries({ queryKey: ["economy-tx"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Purchase failed"),
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <PageHexBadge hue={32} icon={<IconTemplate size={26} />} aria-label="Item Shop" />
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Server shop</div>
            <h1 className="mt-1 font-display text-3xl md:text-4xl">Item Shop</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Buy weapons, gear, medical, and supplies with credits. Purchases emit to Discord.
            </p>
          </div>
        </div>
        <div className="rounded-lg border border-glass-border bg-black/30 px-3 py-2 text-right">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Credits</div>
          <div className="font-mono text-sm text-primary">
            {balanceQ.isLoading ? "…" : credits.toLocaleString()}
          </div>
        </div>
      </header>

      <div className="flex flex-wrap gap-2 rounded-xl border border-glass-border bg-black/20 p-3">
        <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-glass-border bg-black/30 px-3">
          <IconSearch size={14} className="text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search items..."
            className="w-full bg-transparent py-2 text-sm outline-none"
          />
        </div>
        {categories.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setCategory(item)}
            className={`rounded-full border px-3 py-1 text-xs ${
              category === item
                ? "border-primary/50 bg-primary/15 text-primary"
                : "border-glass-border text-muted-foreground"
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelected(item)}
              className={`rounded-lg border p-3 text-left transition hover:border-primary/60 ${
                selected?.id === item.id ? "border-primary bg-primary/10" : "border-glass-border bg-black/25"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-medium">{item.name}</span>
                <span className="shrink-0 font-mono text-[10px] text-primary">{item.price.toLocaleString()}</span>
              </div>
              <div className="mt-1 text-[10px] text-muted-foreground">{item.category}</div>
              {owned.includes(item.id) && (
                <div className="mt-1 text-[10px] uppercase tracking-wider text-emerald-300">Owned</div>
              )}
            </button>
          ))}
        </div>
        <div className="lg:sticky lg:top-24">
          {selected ? (
            <GlassPanel className="border-primary/40 bg-black/95 p-5 shadow-xl">
              <div className="text-xs uppercase tracking-[0.18em] text-primary">Selected item</div>
              <h2 className="mt-1 font-display text-2xl">{selected.name}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{selected.description}</p>
              <div className="mt-3 font-mono text-sm text-primary">{selected.price.toLocaleString()} credits</div>
              <button
                type="button"
                onClick={() => buyMut.mutate(selected)}
                disabled={owned.includes(selected.id) || buyMut.isPending}
                className="mt-5 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:bg-emerald-500/20 disabled:text-emerald-300"
              >
                {owned.includes(selected.id)
                  ? "Owned"
                  : buyMut.isPending
                    ? "Purchasing…"
                    : `Buy · ${selected.price.toLocaleString()}`}
              </button>
            </GlassPanel>
          ) : (
            <div className="rounded-xl border border-dashed border-glass-border p-6 text-center text-sm text-muted-foreground">
              Select an item to purchase.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
