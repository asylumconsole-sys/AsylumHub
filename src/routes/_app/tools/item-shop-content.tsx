import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { GlassPanel } from "@/components/ui-custom/GlassPanel";
import { PageHexBadge } from "@/components/app/PageHexBadge";
import { IconSearch, IconTemplate } from "@/components/ui-custom/CustomIcon";
import { toast } from "sonner";
import { creditPlayer, getEconomyBalance, purchaseShopItem } from "@/lib/economy.functions";
import { useAuth } from "@/contexts/AuthContext";
import { ITEM_CATALOG, ITEM_CATEGORIES, type ShopCatalogItem } from "@/lib/dayz/item-catalog";
import { spawnShopItem } from "@/lib/dayz-item-delivery.functions";
import { DAYZ_SERVERS } from "@/lib/dayz/servers";
import { listAsylumServiceIds } from "@/lib/dayz/server-status.functions";
import { getOnlinePlayers } from "@/lib/online-players.functions";
import { accountLinksComplete, readAccountLinks } from "@/lib/account-links";
import { ItemImage } from "./item-shop-ui";

const SID = "101x";
const PAGE = 60;
type Mode = "map" | "zy" | "gamertag";

export function ItemShopContent() {
  const { session, user } = useAuth();
  const qc = useQueryClient();
  const playerId = user?.id || "demo-user";
  const displayName =
    (typeof user?.user_metadata?.name === "string" && user.user_metadata.name) ||
    user?.email ||
    playerId;
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<ShopCatalogItem | null>(null);
  const [mode, setMode] = useState<Mode>("map");
  const [y, setY] = useState("7500");
  const [z, setZ] = useState("7500");
  const [gamertag, setGamertag] = useState("");
  const [busy, setBusy] = useState(false);
  const [linkedDone, setLinkedDone] = useState(false);

  useEffect(() => {
    if (!gamertag && displayName && displayName !== "demo-user") setGamertag(displayName);
  }, [displayName, gamertag]);

  const balanceQ = useQuery({
    queryKey: ["economy-balance", playerId],
    queryFn: () => getEconomyBalance({ data: { playerId } }),
  });
  const servicesQ = useQuery({ queryKey: ["asylum-services"], queryFn: () => listAsylumServiceIds() });
  const playersQ = useQuery({
    queryKey: ["online-players", SID],
    queryFn: () => getOnlinePlayers({ data: { accessToken: session?.access_token } }),
    enabled: Boolean(session?.access_token),
    refetchInterval: mode === "gamertag" ? 15_000 : false,
  });

  const credits = balanceQ.data?.balance ?? 0;
  const server = DAYZ_SERVERS.find((s) => s.id === SID) ?? DAYZ_SERVERS[0];
  const serviceId = servicesQ.data?.find((s) => s.id === SID)?.serviceId ?? server.fallbackServiceId;
  const categories = useMemo(() => ["All", ...ITEM_CATEGORIES], []);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ITEM_CATALOG.filter((item) => {
      if (category !== "All" && item.category !== category) return false;
      if (!q) return true;
      return [item.name, item.classname, item.description, item.category].some((s) =>
        s.toLowerCase().includes(q),
      );
    }).sort((a, b) => a.price - b.price || a.name.localeCompare(b.name));
  }, [category, query]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const safePage = Math.min(page, pages - 1);
  const pageItems = filtered.slice(safePage * PAGE, safePage * PAGE + PAGE);
  useEffect(() => setPage(0), [category, query]);

  const matched = useMemo(() => {
    const t = gamertag.trim().toLocaleLowerCase();
    if (!t) return null;
    return playersQ.data?.players.find((p) => p.name.toLocaleLowerCase() === t) ?? null;
  }, [gamertag, playersQ.data?.players]);

  useEffect(() => {
    if (linkedDone || !playersQ.data) return;
    const links = readAccountLinks();
    if (!accountLinksComplete(links)) {
      setLinkedDone(true);
      return;
    }
    const t = (gamertag || displayName).trim().toLocaleLowerCase();
    const match =
      playersQ.data.players.find((p) => p.name.toLocaleLowerCase() === t) ??
      playersQ.data.players.find(
        (p) => Number.isFinite(p.x) && Number.isFinite(p.z) && p.server === SID,
      );
    if (match && Number.isFinite(match.x) && Number.isFinite(match.z)) {
      setMode("gamertag");
      setGamertag(match.name);
      setY(String(Math.round(match.x as number)));
      setZ(String(Math.round(match.z as number)));
    }
    setLinkedDone(true);
  }, [playersQ.data, gamertag, displayName, linkedDone]);

  const resolvePos = (): { x: number; z: number } | null => {
    if (mode === "gamertag") {
      if (!matched) {
        toast.error("Gamertag not online on 101x");
        return null;
      }
      if (!Number.isFinite(matched.x) || !Number.isFinite(matched.z)) {
        toast.error("No live coords — use Z/Y or map");
        return null;
      }
      return { x: matched.x as number, z: matched.z as number };
    }
    const pos = { x: Number(y), z: Number(z) };
    if (!Number.isFinite(pos.x) || !Number.isFinite(pos.z) || pos.x < 0 || pos.z < 0) {
      toast.error("Invalid Y/Z");
      return null;
    }
    return pos;
  };

  const buyAndSpawn = async () => {
    if (!selected || busy) return;
    const pos = resolvePos();
    if (!pos) return;
    setBusy(true);
    let charged = false;
    try {
      await purchaseShopItem({
        data: {
          playerId,
          displayName,
          itemId: selected.id,
          itemName: selected.name,
          price: selected.price,
          category: "item",
          allowRepeat: true,
          serverId: "101",
        },
      });
      charged = true;
      qc.invalidateQueries({ queryKey: ["economy-balance", playerId] });
      qc.invalidateQueries({ queryKey: ["economy-board"] });
      qc.invalidateQueries({ queryKey: ["economy-tx"] });
      const result = await spawnShopItem({
        data: {
          serviceId,
          serverId: SID,
          classname: selected.classname,
          x: Math.round(pos.x),
          z: Math.round(pos.z),
          a: 0,
          playerId,
          playerName: displayName,
          itemId: selected.id,
        },
      });
      if (result.mode === "live") {
        toast.success(`${selected.name} spawned live`, {
          description: `${result.adapter} · Y ${Math.round(pos.x)} / Z ${Math.round(pos.z)}`,
        });
      } else {
        toast.success(`${selected.name} queued`, {
          description: result.restarted
            ? `${result.eventName} — restarting`
            : `${result.eventName} already loaded`,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Buy & spawn failed";
      if (charged) {
        try {
          await creditPlayer({
            data: { playerId, amount: selected.price, note: `Refund: spawn failed (${selected.id})` },
          });
          qc.invalidateQueries({ queryKey: ["economy-balance", playerId] });
          toast.error(message, { description: `${selected.price.toLocaleString()} refunded` });
        } catch {
          toast.error(message, { description: "Charged — ask staff for refund" });
        }
      } else toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const modes: { id: Mode; label: string }[] = [
    { id: "map", label: "1. Map" },
    { id: "zy", label: "2. Z/Y" },
    { id: "gamertag", label: "3. Gamertag" },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <PageHexBadge hue={32} icon={<IconTemplate size={26} />} aria-label="Item Shop" />
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Server shop</div>
            <h1 className="mt-1 font-display text-3xl md:text-4xl">Item Shop</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Full CE catalog ({ITEM_CATALOG.length.toLocaleString()} items). Buy & spawn on 101x.
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
            placeholder="Search…"
            className="w-full bg-transparent py-2 text-sm outline-none"
          />
        </div>
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={`rounded-full border px-3 py-1 text-xs ${
              category === c
                ? "border-primary/50 bg-primary/15 text-primary"
                : "border-glass-border text-muted-foreground"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {pageItems.length}/{filtered.length.toLocaleString()}
        </span>
        <div className="flex gap-2">
          <button type="button" disabled={safePage <= 0} onClick={() => setPage((p) => p - 1)} className="rounded border border-glass-border px-2 py-1 disabled:opacity-40">
            Prev
          </button>
          <span className="font-mono">
            {safePage + 1}/{pages}
          </span>
          <button type="button" disabled={safePage >= pages - 1} onClick={() => setPage((p) => p + 1)} className="rounded border border-glass-border px-2 py-1 disabled:opacity-40">
            Next
          </button>
        </div>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {pageItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelected(item)}
              className={`rounded-lg border p-2 text-left ${
                selected?.id === item.id ? "border-primary bg-primary/10" : "border-glass-border bg-black/25"
              }`}
            >
              <div className="mb-2 flex h-16 items-center justify-center rounded-md border border-glass-border bg-black/40">
                <ItemImage src={item.image} alt={item.name} category={item.category} className="h-14 w-14" />
              </div>
              <div className="flex justify-between gap-2">
                <span className="line-clamp-2 text-sm font-medium">{item.name}</span>
                <span className="font-mono text-[10px] text-primary">{item.price.toLocaleString()}</span>
              </div>
              <div className="mt-1 text-[10px] text-muted-foreground">{item.category}</div>
            </button>
          ))}
        </div>

        <div className="lg:sticky lg:top-24">
          {selected ? (
            <GlassPanel className="space-y-4 border-primary/40 bg-black/95 p-5">
              <div className="flex h-28 items-center justify-center rounded-lg border border-glass-border bg-black/50">
                <ItemImage src={selected.image} alt={selected.name} category={selected.category} className="h-24 w-24" />
              </div>
              <div>
                <h2 className="font-display text-2xl">{selected.name}</h2>
                <p className="font-mono text-[11px] text-muted-foreground">{selected.classname}</p>
                <div className="mt-2 font-mono text-sm text-primary">{selected.price.toLocaleString()} credits</div>
              </div>
              <div className="space-y-2 border-t border-glass-border pt-4">
                {modes.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMode(m.id)}
                    className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                      mode === m.id ? "border-primary bg-primary/15" : "border-glass-border"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              {(mode === "map" || mode === "zy") && (
                <div className="space-y-2">
                  {mode === "map" && (
                    <button type="button" className="text-xs text-primary underline" onClick={() => window.open("/tools/npc-map-clicker", "_blank")}>
                      Open map
                    </button>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-[10px] text-muted-foreground">
                      Y
                      <input value={y} onChange={(e) => setY(e.target.value)} className="mt-1 w-full rounded-lg border border-glass-border bg-black px-3 py-2 font-mono text-sm" />
                    </label>
                    <label className="text-[10px] text-muted-foreground">
                      Z
                      <input value={z} onChange={(e) => setZ(e.target.value)} className="mt-1 w-full rounded-lg border border-glass-border bg-black px-3 py-2 font-mono text-sm" />
                    </label>
                  </div>
                </div>
              )}
              {mode === "gamertag" && (
                <label className="text-[10px] text-muted-foreground">
                  Gamertag
                  <input value={gamertag} onChange={(e) => setGamertag(e.target.value)} className="mt-1 w-full rounded-lg border border-glass-border bg-black px-3 py-2 text-sm" />
                </label>
              )}
              <button
                type="button"
                onClick={buyAndSpawn}
                disabled={busy || credits < selected.price}
                className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {busy ? "…" : credits < selected.price ? "Need credits" : `Buy & spawn · ${selected.price.toLocaleString()}`}
              </button>
            </GlassPanel>
          ) : (
            <div className="rounded-xl border border-dashed border-glass-border p-6 text-center text-sm text-muted-foreground">
              Select an item.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
