import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GlassPanel } from "@/components/ui-custom/GlassPanel";
import { PageHexBadge } from "@/components/app/PageHexBadge";
import { IconBot, IconSearch } from "@/components/ui-custom/CustomIcon";
import { toast } from "sonner";
import { spawnNpc } from "@/lib/dayz-spawn.functions";
import { DAYZ_SERVERS, type DayZServerId } from "@/lib/dayz/servers";
import { listAsylumServiceIds } from "@/lib/dayz/server-status.functions";
import {
  getEconomyBalance,
  getNpcInventory,
  purchaseNpc,
} from "@/lib/economy.functions";
import { useAuth } from "@/contexts/AuthContext";

const FALLBACK_SPAWN_POS = { x: 7500, z: 7500, a: 0 };

export const Route = createFileRoute("/_app/tools/npc-shop")({ component: NPCShopContent });

type NPC = { id: string; name: string; role: string; category: string; price: number; description: string };

const NPCS: NPC[] = [
  ["scavenger", "Wasteland Scavenger", "Trader", "Civilian", 2000, "A sharp-eyed scavenger who trades salvage and rumors."],
  ["medic", "Field Medic", "Medic", "Support", 2500, "Keeps your crew alive when the fighting gets close."],
  ["mechanic", "Roadside Mechanic", "Mechanic", "Support", 3000, "Repairs vehicles and keeps your convoy moving."],
  ["hunter", "Silent Hunter", "Scout", "Combat", 3500, "Tracks movement and watches the tree line."],
  ["guard", "Gate Guard", "Guard", "Combat", 4000, "Holds a position and challenges unknown players."],
  ["farmer", "Greenhouse Keeper", "Farmer", "Civilian", 4200, "Maintains crops and protects your food supply."],
  ["radio", "Radio Operator", "Intel", "Support", 4500, "Broadcasts faction messages and monitors channels."],
  ["quartermaster", "Quartermaster", "Logistics", "Support", 4800, "Organizes supplies, ammunition, and storage."],
  ["sniper", "Overwatch Sniper", "Overwatch", "Combat", 5200, "Provides long-range cover from elevated positions."],
  ["engineer", "Combat Engineer", "Engineer", "Combat", 5500, "Builds defenses and reinforces your perimeter."],
  ["smuggler", "Black Market Smuggler", "Dealer", "Civilian", 5800, "Moves restricted goods through dangerous routes."],
  ["tracker", "Bloodhound Tracker", "Tracker", "Combat", 6100, "Follows trails and identifies recent movement."],
  ["pilot", "Helicopter Pilot", "Pilot", "Support", 6500, "Coordinates transport and aerial resupply."],
  ["commander", "Faction Commander", "Commander", "Faction", 7000, "Coordinates squads and issues faction orders."],
  ["armorer", "Arms Dealer", "Armorer", "Civilian", 7200, "Maintains weapon stock and manages crate deliveries."],
  ["recon", "Recon Specialist", "Recon", "Combat", 7500, "Maps hostile positions and marks points of interest."],
  ["bunker", "Bunker Warden", "Warden", "Combat", 7800, "Guards high-value locations and secured storage."],
  ["diplomat", "Faction Diplomat", "Diplomat", "Faction", 8200, "Handles negotiations, alliances, and ceasefires."],
  ["commando", "Wasteland Commando", "Elite", "Combat", 8600, "A veteran operator for high-risk deployments."],
  ["ai", "Tactical AI Core", "Coordinator", "Faction", 9000, "Plans patrols, alerts, and coordinated defenses."],
  // Survivors — confirmed SurvivorM_* classnames
  ["survivor_boris", "Survivor Boris", "Survivor", "Survivors", 1500, "Confirmed CE kit SurvivorM_Boris."],
  ["survivor_cyril", "Survivor Cyril", "Survivor", "Survivors", 1500, "Confirmed CE kit SurvivorM_Cyril."],
  ["survivor_denis", "Survivor Denis", "Survivor", "Survivors", 1500, "Confirmed CE kit SurvivorM_Denis."],
  ["survivor_elias", "Survivor Elias", "Survivor", "Survivors", 1500, "Confirmed CE kit SurvivorM_Elias."],
  // Labeled female-style extras — spawn via confirmed male classnames until verified
  ["survivor_recruit_f", "Survivor Recruit (F kit → Boris)", "Survivor", "Survivors", 1600, "Female-labeled recruit; spawns as SurvivorM_Boris (confirmed)."],
  ["survivor_medic_f", "Survivor Medic (F kit → Cyril)", "Survivor", "Survivors", 1700, "Female-labeled medic; spawns as SurvivorM_Cyril (confirmed)."],
  ["survivor_scout_f", "Survivor Scout (F kit → Denis)", "Survivor", "Survivors", 1800, "Female-labeled scout; spawns as SurvivorM_Denis (confirmed)."],
  ["survivor_guard_f", "Survivor Guard (F kit → Elias)", "Survivor", "Survivors", 2000, "Female-labeled guard; spawns as SurvivorM_Elias (confirmed, restock on)."],
].map(([id, name, role, category, price, description]) => ({
  id: id as string,
  name: name as string,
  role: role as string,
  category: category as string,
  price: price as number,
  description: description as string,
}));

export function NPCShopContent() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const playerId = user?.id || "demo-user";
  const displayName =
    (typeof user?.user_metadata?.name === "string" && user.user_metadata.name) ||
    user?.email ||
    playerId;

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [sort, setSort] = useState<"price" | "name">("price");
  const [selected, setSelected] = useState<NPC | null>(null);
  const [openMenu, setOpenMenu] = useState<"category" | "sort" | null>(null);
  const [serverId, setServerId] = useState<DayZServerId>("101x");
  const [spawning, setSpawning] = useState(false);

  const balanceQ = useQuery({
    queryKey: ["economy-balance", playerId],
    queryFn: () => getEconomyBalance({ data: { playerId, displayName } }),
  });
  const invQ = useQuery({
    queryKey: ["npc-inventory", playerId],
    queryFn: () => getNpcInventory({ data: { playerId } }),
  });
  const catalogQ = useQuery({
    queryKey: ["asylum-services"],
    queryFn: () => listAsylumServiceIds(),
  });

  const owned = invQ.data?.owned ?? [];
  const credits = balanceQ.data?.balance ?? 0;
  const server = useMemo(
    () => DAYZ_SERVERS.find((s) => s.id === serverId) ?? DAYZ_SERVERS[0],
    [serverId],
  );
  const serviceId =
    catalogQ.data?.find((s) => s.id === serverId)?.serviceId ?? server.fallbackServiceId;

  const categories = ["All", ...Array.from(new Set(NPCS.map((npc) => npc.category)))];
  const filtered = useMemo(
    () =>
      NPCS.filter(
        (npc) =>
          (category === "All" || npc.category === category) &&
          `${npc.name} ${npc.role} ${npc.description}`.toLowerCase().includes(query.toLowerCase()),
      ).sort((a, b) => (sort === "price" ? a.price - b.price : a.name.localeCompare(b.name))),
    [category, query, sort],
  );

  const buyMut = useMutation({
    mutationFn: (npc: NPC) =>
      purchaseNpc({
        data: {
          playerId,
          displayName,
          npcId: npc.id,
          npcName: npc.name,
          price: npc.price,
          serverId: serverId.startsWith("102") ? "102" : "101",
        },
      }),
    onSuccess: (res, npc) => {
      if (res.alreadyOwned) {
        toast.message(`${npc.name} already owned`);
      } else {
        toast.success(`${npc.name} purchased`, {
          description: `Debited ${npc.price.toLocaleString()} credits.`,
        });
      }
      qc.invalidateQueries({ queryKey: ["economy-balance", playerId] });
      qc.invalidateQueries({ queryKey: ["npc-inventory", playerId] });
      qc.invalidateQueries({ queryKey: ["economy-board"] });
      qc.invalidateQueries({ queryKey: ["economy-tx"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Purchase failed"),
  });

  const spawn = async (location: string) => {
    if (!selected || !owned.includes(selected.id)) return toast.error("Buy this NPC first");
    setSpawning(true);
    try {
      const result = await spawnNpc({
        data: { serviceId, npcId: selected.id, ...FALLBACK_SPAWN_POS },
      });
      if (result.mode === "live") {
        toast.success(`${selected.name} spawned live`, {
          description: `${server.label} · via ${result.adapter}.`,
        });
      } else {
        toast.warning("Live spawn unavailable", { description: result.reason });
        toast.success(`${selected.name} queued`, {
          description: !result.restarted
            ? `Already loaded on ${server.label} — no restart needed, CE is managing it.`
            : result.restockSeconds > 0
              ? `Spawn set to ${location} on ${server.label}. Server restarting — then respawns every ${result.restockSeconds}s.`
              : `Spawn set to ${location} on ${server.label}. Server restarting to load it.`,
        });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to queue spawn");
    } finally {
      setSpawning(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <PageHexBadge hue={285} icon={<IconBot size={26} />} aria-label="NPC Shop" />
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Server shop</div>
            <h1 className="mt-1 font-display text-3xl md:text-4xl">NPC Shop</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Recruit characters for patrols, bases, factions, and battlepass progression.
            </p>
          </div>
        </div>
        <div className="rounded-lg border border-glass-border bg-black/30 px-3 py-2 text-right">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Credits</div>
          <div className="font-mono text-sm text-primary">
            {balanceQ.isLoading ? "…" : credits.toLocaleString()}
          </div>
          <div className="mt-0.5 text-[10px] text-muted-foreground truncate max-w-[140px]">{displayName}</div>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-glass-border bg-black/20 p-3">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Spawn server</span>
        {DAYZ_SERVERS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setServerId(s.id)}
            className={`rounded-full border px-3 py-1 text-xs uppercase ${
              serverId === s.id
                ? "border-primary/50 bg-primary/15 text-primary"
                : "border-glass-border text-muted-foreground"
            }`}
          >
            {s.id}
          </button>
        ))}
        <span className="text-[10px] text-muted-foreground font-mono">svc {serviceId}</span>
      </div>

      <div className="flex flex-wrap gap-2 rounded-xl border border-glass-border bg-black/20 p-3">
        <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-glass-border bg-black/30 px-3">
          <IconSearch size={14} className="text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search NPCs..."
            className="w-full bg-transparent py-2 text-sm outline-none"
          />
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpenMenu((value) => (value === "category" ? null : "category"))}
            className="rounded-lg border border-glass-border bg-black/50 px-3 py-2 text-sm text-foreground"
          >
            {category} ▾
          </button>
          {openMenu === "category" && (
            <div className="absolute right-0 top-11 z-30 min-w-40 rounded-xl border border-white/10 bg-[#101010] p-1.5 shadow-2xl">
              {categories.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    setCategory(item);
                    setOpenMenu(null);
                  }}
                  className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${
                    category === item ? "bg-white text-black" : "text-white/70 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpenMenu((value) => (value === "sort" ? null : "sort"))}
            className="rounded-lg border border-glass-border bg-black/50 px-3 py-2 text-sm text-foreground"
          >
            Sort: {sort === "price" ? "Price" : "Name"} ▾
          </button>
          {openMenu === "sort" && (
            <div className="absolute right-0 top-11 z-30 min-w-40 rounded-xl border border-white/10 bg-[#101010] p-1.5 shadow-2xl">
              <button
                type="button"
                onClick={() => {
                  setSort("price");
                  setOpenMenu(null);
                }}
                className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${
                  sort === "price" ? "bg-white text-black" : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                Price
              </button>
              <button
                type="button"
                onClick={() => {
                  setSort("name");
                  setOpenMenu(null);
                }}
                className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${
                  sort === "name" ? "bg-white text-black" : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                Name
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {categories.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setCategory(item)}
            className={`rounded-full border px-3 py-1 text-xs ${
              category === item
                ? "border-primary/50 bg-primary/15 text-primary"
                : "border-glass-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((npc) => (
            <button
              key={npc.id}
              type="button"
              onClick={() => setSelected(npc)}
              className={`overflow-hidden rounded-lg border text-left transition hover:border-primary/60 ${
                selected?.id === npc.id ? "border-primary bg-primary/10" : "border-glass-border bg-black/25"
              }`}
            >
              <img
                src={`https://picsum.photos/seed/asylum-npc-${npc.id}/320/180`}
                alt={npc.name}
                className="aspect-[16/8] w-full object-cover"
              />
              <div className="p-2">
                <div className="flex items-start justify-between gap-1">
                  <span className="truncate text-sm font-medium">{npc.name}</span>
                  <span className="shrink-0 font-mono text-[10px] text-primary">{npc.price.toLocaleString()}</span>
                </div>
                <div className="mt-1 text-[10px] text-muted-foreground">
                  {npc.role} · {npc.category}
                </div>
                {owned.includes(npc.id) && (
                  <div className="mt-1 text-[10px] uppercase tracking-wider text-emerald-300">Owned</div>
                )}
              </div>
            </button>
          ))}
        </div>
        <div className="lg:sticky lg:top-24">
          {selected ? (
            <GlassPanel className="border-primary/40 bg-black/95 p-5 shadow-xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-primary">Selected NPC</div>
                  <h2 className="mt-1 font-display text-2xl">{selected.name}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{selected.description}</p>
                  <div className="mt-3 font-mono text-sm text-primary">
                    {selected.price.toLocaleString()} credits
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Close
                </button>
              </div>
              <div className="mt-5 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => buyMut.mutate(selected)}
                  disabled={owned.includes(selected.id) || buyMut.isPending}
                  className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:bg-emerald-500/20 disabled:text-emerald-300"
                >
                  {owned.includes(selected.id)
                    ? "Owned"
                    : buyMut.isPending
                      ? "Purchasing…"
                      : `Buy NPC · ${selected.price.toLocaleString()}`}
                </button>
                <button
                  type="button"
                  disabled={!owned.includes(selected.id)}
                  onClick={() =>
                    window.open(
                      `/tools/npc-map-clicker?npcId=${encodeURIComponent(selected.id)}`,
                      "_blank",
                      "noopener,noreferrer",
                    )
                  }
                  className="w-full rounded-lg border border-glass-border px-4 py-2.5 text-sm text-muted-foreground hover:bg-glass/40 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Choose on map
                </button>
                <button
                  type="button"
                  disabled={!owned.includes(selected.id) || spawning}
                  onClick={() => spawn("your current location")}
                  className="w-full rounded-lg border border-primary/40 px-4 py-2.5 text-sm text-primary hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {spawning ? "Queuing…" : `Spawn on ${serverId}`}
                </button>
              </div>
            </GlassPanel>
          ) : (
            <div className="rounded-xl border border-dashed border-glass-border p-6 text-center text-sm text-muted-foreground">
              Select an NPC to view purchase and spawn options.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
