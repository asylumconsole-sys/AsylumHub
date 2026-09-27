import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { IconSearch } from "@/components/ui-custom/CustomIcon";
import { ITEM_CATALOG, ITEM_FILTERS, imageCandidates, type ShopItem } from "@/lib/item-shop-catalog";
import { DAYZ_SERVERS, type DayZServerId } from "@/lib/dayz/servers";

export function ItemShop() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof ITEM_FILTERS)[number]>("All");
  const [selected, setSelected] = useState<ShopItem | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [credits, setCredits] = useState(50_000);
  const [cart, setCart] = useState<Array<{ item: ShopItem; quantity: number }>>([]);
  const [imageAttempt, setImageAttempt] = useState<Record<string, number>>({});
  const [deliveryServer, setDeliveryServer] = useState<DayZServerId>(DAYZ_SERVERS[0].id);
  const [coordX, setCoordX] = useState("");
  const [coordZ, setCoordZ] = useState("");

  const nextImageAttempt = (entry: ShopItem) => {
    const attempt = imageAttempt[entry.id] ?? 0;
    const candidates = imageCandidates(entry);
    if (attempt + 1 < candidates.length) setImageAttempt((c) => ({ ...c, [entry.id]: attempt + 1 }));
  };

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ITEM_CATALOG.filter((item) => {
      const catOk = filter === "All" || filter === "Name A-Z" || item.category === filter;
      const qOk = !q || item.name.toLowerCase().includes(q);
      return catOk && qOk;
    }).sort((a, b) => (filter === "Name A-Z" ? a.name.localeCompare(b.name) : 0));
  }, [query, filter]);

  const add = (item: ShopItem, count: number) => {
    setCart((c) => {
      const i = c.findIndex((x) => x.item.id === item.id);
      if (i >= 0) {
        const n = [...c];
        n[i] = { ...n[i], quantity: n[i].quantity + count };
        return n;
      }
      return [...c, { item, quantity: count }];
    });
    toast.success(`Added ${item.name}`);
  };

  return (
    <section className="shop-directory-wrap item-shop-catalog" aria-label="Item Shop catalog">
      <div className="shop-directory-shell space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-full border border-primary/20 bg-black px-3 py-2 text-sm">
            <IconSearch size={14} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search items" className="bg-transparent outline-none" />
          </div>
          <select value={filter} onChange={(e) => setFilter(e.target.value as (typeof ITEM_FILTERS)[number])} className="rounded-full border border-primary/20 bg-black px-3 py-2 text-xs uppercase tracking-wider">
            {ITEM_FILTERS.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {visible.map((entry) => (
            <motion.article key={entry.id} className={`shop-card min-h-0 flex-col text-left ${selected?.id === entry.id ? "border-primary" : ""}`} whileHover={{ y: -3 }}>
              <button type="button" onClick={() => setSelected(entry)} className="w-full">
                <div className="shop-card-art relative flex h-32 w-full items-center justify-center overflow-hidden bg-black">
                  <img
                    src={imageCandidates(entry)[imageAttempt[entry.id] ?? 0]}
                    alt={entry.name}
                    className="max-h-full max-w-full object-contain p-2"
                    onError={() => nextImageAttempt(entry)}
                  />
                </div>
                <div className="shop-card-content text-left">
                  <div className="shop-card-title shop-medieval-title">{entry.name}</div>
                  <div className="shop-card-meta">{entry.category} · {entry.price.toLocaleString()} cr</div>
                </div>
              </button>
              <button type="button" onClick={() => add(entry, 1)} className="m-3 rounded-full bg-primary px-3 py-1.5 text-[11px] uppercase tracking-wider text-primary-foreground">Add</button>
            </motion.article>
          ))}
        </div>
        {selected && (
          <div className="rounded-2xl border border-primary/25 bg-black/40 p-4 text-sm">
            <div className="font-display text-2xl text-primary">{selected.name}</div>
            <p className="mt-1 text-zinc-400">{selected.detail}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <select value={deliveryServer} onChange={(e) => setDeliveryServer(e.target.value as DayZServerId)} className="rounded-full border border-primary/20 bg-black px-3 py-2 text-xs">
                {DAYZ_SERVERS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <input value={coordX} onChange={(e) => setCoordX(e.target.value)} placeholder="Y" className="w-24 rounded-full border border-primary/20 bg-black px-3 py-2 font-mono text-xs" />
              <input value={coordZ} onChange={(e) => setCoordZ(e.target.value)} placeholder="Z" className="w-24 rounded-full border border-primary/20 bg-black px-3 py-2 font-mono text-xs" />
              <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value) || 1)} className="w-20 rounded-full border border-primary/20 bg-black px-3 py-2 text-xs" />
              <button type="button" onClick={() => add(selected, quantity)} className="rounded-full bg-primary px-4 py-2 text-xs uppercase tracking-wider text-primary-foreground">Add to cart</button>
            </div>
          </div>
        )}
        <div className="text-xs text-muted-foreground">Cart {cart.reduce((n, x) => n + x.quantity, 0)} · {credits.toLocaleString()} cr on file</div>
      </div>
    </section>
  );
}
