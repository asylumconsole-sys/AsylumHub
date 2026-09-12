import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { GlassPanel } from "@/components/ui-custom/GlassPanel";
import { IconSearch } from "@/components/ui-custom/CustomIcon";
import { toast } from "sonner";
import { spawnNpc } from "@/lib/dayz-spawn.functions";

const TEST_SERVICE_ID = "19773616";
const FALLBACK_SPAWN_POS = { x: 7500, z: 7500, a: 0 };

export const Route = createFileRoute("/_app/tools/npc-shop")({
  component: NPCShopContent,
});

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
].map(([id, name, role, category, price, description]) => ({ id, name, role, category, price, description } as NPC));

export function NPCShopContent() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [sort, setSort] = useState<"price" | "name">("price");
  const [selected, setSelected] = useState<NPC | null>(null);
  const [credits, setCredits] = useState(50_000);
  const [owned, setOwned] = useState<string[]>([]);
  const [spawning, setSpawning] = useState(false);

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

  const spawn = async (location: string) => {
    if (!selected || !owned.includes(selected.id)) return toast.error("Buy this NPC first");
    setSpawning(true);
    try {
      const result = await spawnNpc({
        data: { serviceId: TEST_SERVICE_ID, npcId: selected.id, ...FALLBACK_SPAWN_POS },
      });
      if (result.mode === "live") {
        toast.success(`${selected.name} spawned live`, { description: `No restart \u2014 via ${result.adapter}.` });
      } else {
        toast.warning("Live spawn unavailable", { description: result.reason });
        toast.success(`${selected.name} queued`, { description: `Spawn request set to ${location}.` });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to queue spawn");
    } finally {
      setSpawning(false);
    }
  };

  const buySelected = () => {
    if (!selected || owned.includes(selected.id)) return;
    if (credits < selected.price) return toast.error("Not enough credits");
    setCredits((value) => value - selected.price);
    setOwned((current) => [...current, selected.id]);
    toast.success(`${selected.name} purchased`);
  };

  return (
    <div className="space-y-8">
      <GlassPanel tier="strong" glow className="overflow-hidden border border-glass-border/80 p-0">
        <div className="px-6 py-6 md:px-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-amber-100/80">
            Server shop
          </div>
          <h1 className="mt-4 font-display text-5xl tracking-tight text-foreground">NPC Shop</h1>
          <p className="mt-3 max-w-lg text-sm text-muted-foreground">Recruit characters for patrols, bases, factions, and battlepass progression.</p>
          <div className="mt-4 rounded-full border border-amber-300/30 bg-amber-400/10 px-3 py-2 text-sm font-semibold text-amber-50 inline-block">
            {credits.toLocaleString()} cr
          </div>
        </div>
      </GlassPanel>

      <GlassPanel className="p-3">
        <div className="flex min-w-[220px] items-center gap-2 rounded-lg border border-glass-border bg-black/30 px-3">
          <IconSearch size={14} className="text-muted-foreground" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search NPCs..." className="w-full bg-transparent py-2 text-sm outline-none" />
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {categories.map((item) => (
            <button key={item} type="button" onClick={() => setCategory(item)} className={`rounded-lg border px-3 py-1.5 text-sm ${category === item ? "border-primary bg-primary/15 text-foreground" : "border-glass-border text-muted-foreground"}`}>
              {item}
            </button>
          ))}
        </div>
      </GlassPanel>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((npc) => (
            <motion.button
              key={npc.id}
              type="button"
              onClick={() => setSelected(npc)}
              whileHover={{ y: -3 }}
              className={`overflow-hidden rounded-lg border text-left ${selected?.id === npc.id ? "border-primary bg-primary/10" : "border-glass-border bg-black/25"}`}
            >
              <img src={`https://picsum.photos/seed/asylum-npc-${npc.id}/320/180`} alt={npc.name} className="aspect-[16/8] w-full object-cover" />
              <div className="p-2">
                <div className="flex items-start justify-between gap-1">
                  <span className="truncate text-sm font-medium">{npc.name}</span>
                  <span className="shrink-0 font-mono text-[10px] text-primary">{npc.price.toLocaleString()}</span>
                </div>
                <div className="mt-1 text-[10px] text-muted-foreground">{npc.role} \u00b7 {npc.category}</div>
                {owned.includes(npc.id) && <div className="mt-1 text-[10px] uppercase tracking-wider text-emerald-300">Owned</div>}
              </div>
            </motion.button>
          ))}
        </div>
        <div className="lg:sticky lg:top-24">
          {selected ? (
            <GlassPanel className="border-primary/40 bg-black/95 p-5">
              <div className="text-xs uppercase tracking-[0.18em] text-primary">Selected NPC</div>
              <h2 className="mt-1 font-display text-2xl">{selected.name}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{selected.description}</p>
              <div className="mt-3 font-mono text-sm text-primary">{selected.price.toLocaleString()} credits</div>
              <div className="mt-5 flex flex-col gap-2">
                <button type="button" onClick={buySelected} disabled={owned.includes(selected.id)} className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:bg-emerald-500/20 disabled:text-emerald-300">
                  {owned.includes(selected.id) ? "Owned" : `Buy NPC \u00b7 ${selected.price.toLocaleString()}`}
                </button>
                <button type="button" disabled={!owned.includes(selected.id)} onClick={() => window.open(`/tools/npc-map-clicker?npcId=${encodeURIComponent(selected.id)}`, "_blank", "noopener,noreferrer")} className="w-full rounded-lg border border-glass-border px-4 py-2.5 text-sm text-muted-foreground disabled:opacity-40">
                  Choose on map
                </button>
                <button type="button" disabled={!owned.includes(selected.id) || spawning} onClick={() => spawn("your current location")} className="w-full rounded-lg border border-primary/40 px-4 py-2.5 text-sm text-primary disabled:opacity-40">
                  {spawning ? "Queuing\u2026" : "Spawn at my location"}
                </button>
              </div>
            </GlassPanel>
          ) : (
            <div className="rounded-xl border border-dashed border-glass-border p-6 text-center text-sm text-muted-foreground">Select an NPC to view purchase and spawn options.</div>
          )}
        </div>
      </div>
    </div>
  );
}
