import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { GlassPanel } from "@/components/ui-custom/GlassPanel";
import { IconBot, IconSearch } from "@/components/ui-custom/CustomIcon";
import { toast } from "sonner";
import { spawnNpc } from "@/lib/dayz-spawn.functions";
import { DAYZ_SERVERS, resolveServiceId, type DayZServerId } from "@/lib/dayz/servers";
import { listAsylumServiceIds } from "@/lib/dayz/server-status.functions";
import { getEconomyBalance, getOwnedNpcs, purchaseNpc } from "@/lib/economy.functions";

const FALLBACK_SPAWN_POS = { x: 7500, z: 7500, a: 0 };

export const Route = createFileRoute("/_app/tools/npc-shop")({
  component: NPCShopContent,
});

type NPC = { id: string; name: string; role: string; category: string; price: number; description: string; cfgSpawnabletypes?: string };

const THE_BEAMER_CFG_SPAWNABLETYPES = `<type name="TheBeamer">
  <attachments>
    <item name="HandcuffsLocked"/>
  </attachments>
  <attachments>
    <item name="M14">
      <attachments>
        <item name="Mag_DMR_20Rnd"/>
        <item name="MK4Optic_Green"/>
        <item name="ImprovisedSuppressor"/>
      </attachments>
    </item>
  </attachments>
  <attachments>
    <item name="M4A1_Green">
      <attachments>
        <item name="Mag_STANAG_60Rnd"/>
        <item name="BarakaOptic"/>
        <item name="M4_Suppressor"/>
        <item name="M4_CQBBttstck_Green"/>
        <item name="M4_PlasticHndgrd_Green"/>
      </attachments>
    </item>
  </attachments>
  <attachments>
    <item name="Mich2001Helmet">
      <attachments>
        <item name="NVGHeadstrap"/>
        <item name="Battery9V"/>
      </attachments>
    </item>
  </attachments>
  <attachments>
    <item name="HockeyMask"/>
  </attachments>
  <attachments>
    <item name="PlateCarrierVest_Green">
      <attachments>
        <item name="PlateCarrierPouches_Green">
          <cargo>
            <item name="Mag_STANAG_60Rnd"/>
            <item name="Mag_STANAG_60Rnd"/>
            <item name="ImprovisedSuppressor"/>
          </cargo>
        </item>
        <item name="RGD5Grenade"/>
        <item name="RGD5Grenade"/>
        <item name="M84Flashbang"/>
        <item name="M84Flashbang"/>
      </attachments>
    </item>
  </attachments>
  <attachments>
    <item name="TShirt_White"/>
  </attachments>
  <attachments>
    <item name="WoolGlovesFingerless_ColorBase"/>
  </attachments>
  <attachments>
    <item name="GorkaPants_Autumn">
      <cargo>
        <item name="Box_308WINTR_20rnd"/>
        <item name="Box_308WINTR_20rnd"/>
        <item name="Mag_STANAG_60Rnd"/>
        <item name="Mag_STANAG_60Rnd"/>
        <item name="SewingKit"/>
        <item name="Mag_STANAG_60Rnd"/>
        <item name="SewingKit"/>
        <item name="Box_556x45Tracer_20rnd"/>
        <item name="Box_556x45Tracer_20rnd"/>
        <item name="Bandage"/>
      </cargo>
    </item>
  </attachments>
  <attachments>
    <item name="CanvasShoes_Red"/>
  </attachments>
  <attachments>
    <item name="HipPack_Medical">
      <attachments>
        <item name="Canteen" quantityMin="1.0" quantityMax="1.0"/>
        <cargo>
          <item name="CodeinePills"/>
          <item name="TetracyclinePills"/>
          <item name="Morphine"/>
        </cargo>
      </attachments>
    </item>
  </attachments>
  <attachments>
    <item name="AssaultBag_Green">
      <attachments>
        <item name="FieldShovel"/>
        <item name="XmasLights_Red"/>
        <item name="Rangefinder">
          <attachments>
            <item name="Battery9V"/>
          </attachments>
        </item>
      </attachments>
      <cargo>
        <item name="WaterBottle" quantityMin="1.0" quantityMax="1.0"/>
        <item name="PeachesCan"/>
        <item name="PeachesCan"/>
        <item name="LandMine"/>
        <item name="LandMine"/>
        <item name="CombatKnife"/>
        <item name="Bandage"/>
        <item name="WeaponCleaningKit"/>
      </cargo>
    </item>
  </attachments>
</type>`;

const NPCS: NPC[] = [
  {
    id: "the_beamer",
    name: "TheBeamer NPC",
    role: "Elite Operator",
    category: "Combat",
    price: 10000,
    description: "Beam down the competition with an M14, M4A1 Green, armored kit, medical supplies, and field gear.",
    cfgSpawnabletypes: THE_BEAMER_CFG_SPAWNABLETYPES,
  },
];

export function NPCShopContent() {
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [sort, setSort] = useState<"price" | "name">("price");
  const [selected, setSelected] = useState<NPC | null>(null);
  const [openMenu, setOpenMenu] = useState<"category" | "sort" | null>(null);
  const [serverId, setServerId] = useState<DayZServerId>("101x");
  const [spawning, setSpawning] = useState(false);

  const balanceQ = useQuery({
    queryKey: ["economy-balance"],
    queryFn: () => getEconomyBalance({ data: {} }),
  });
  const ownedQ = useQuery({
    queryKey: ["npc-owned"],
    queryFn: () => getOwnedNpcs(),
  });
  const catalogQ = useQuery({
    queryKey: ["asylum-services"],
    queryFn: () => listAsylumServiceIds(),
  });

  const credits = balanceQ.data?.balance ?? 0;
  const owned = ownedQ.data ?? [];
  const server = useMemo(() => DAYZ_SERVERS.find((s) => s.id === serverId) ?? DAYZ_SERVERS[0], [serverId]);
  const serviceId =
    catalogQ.data?.find((s) => s.id === serverId)?.serviceId ?? resolveServiceId(server);

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
    mutationFn: (npc: NPC) => purchaseNpc({ data: { npcId: npc.id, price: npc.price, name: npc.name } }),
    onSuccess: (res, npc) => {
      toast.success(`${npc.name} purchased`, { description: "The NPC is now ready to spawn." });
      qc.setQueryData(["npc-owned"], res.owned);
      qc.setQueryData(["economy-balance"], res.account);
      qc.invalidateQueries({ queryKey: ["economy-balance"] });
      qc.invalidateQueries({ queryKey: ["npc-owned"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Purchase failed"),
  });

  const spawn = async () => {
    if (!selected || !owned.includes(selected.id)) return toast.error("Buy this NPC first");
    setSpawning(true);
    try {
      const result = await spawnNpc({
        data: { serviceId, serverId, npcId: selected.id, ...FALLBACK_SPAWN_POS },
      });
      if (result.mode === "live") {
        toast.success(`${selected.name} spawned live on ${server.label}`, {
          description: `Via ${result.adapter}.`,
        });
      } else {
        toast.warning("Live spawn unavailable", { description: result.reason });
        toast.success(`${selected.name} queued on ${server.label}`, {
          description: !result.restarted
            ? "Already loaded on the server — no restart needed, CE is managing it."
            : result.restockSeconds > 0
              ? `Spawn request set to X ${FALLBACK_SPAWN_POS.x} / Z ${FALLBACK_SPAWN_POS.z}. Server is restarting to load it — after that it respawns every ${result.restockSeconds}s on its own.`
              : `Spawn request set to X ${FALLBACK_SPAWN_POS.x} / Z ${FALLBACK_SPAWN_POS.z}. Server is restarting to load it.`,
        });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to queue spawn");
    } finally {
      setSpawning(false);
    }
  };

  const buySelected = () => {
    if (!selected || owned.includes(selected.id) || buyMut.isPending) return;
    buyMut.mutate(selected);
  };

  return (
    <div className="space-y-8">
      <GlassPanel tier="strong" glow className="overflow-hidden border border-glass-border/80 p-0">
        <div className="grid gap-0 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="relative overflow-hidden border-b border-glass-border/70 px-6 py-6 md:px-8 lg:border-b-0 lg:border-r">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.16),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(251,191,36,0.08),transparent_26%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent)]" />
            <div className="relative z-10 flex h-full flex-col justify-between gap-8">
              <div className="space-y-5">
                <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-amber-100/80">
                  <IconBot size={12} />
                  Server shop
                  <span className="h-1 w-1 rounded-full bg-amber-200/80" />
                  NPC roster
                </div>
                <div className="max-w-xl space-y-4">
                  <div className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground">
                    Recruitment / patrol / support / combat / survivors
                  </div>
                  <h1 className="font-display text-5xl leading-[0.92] tracking-tight text-foreground md:text-6xl">
                    NPC Shop
                  </h1>
                  <p className="max-w-lg text-sm leading-relaxed text-muted-foreground md:text-base">
                    Recruit characters for patrols, bases, factions, and battlepass progression. Survivors use
                    confirmed SurvivorM_* CE kits.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  ["Search", "Filter by role"],
                  ["Buy", "Spend credits"],
                  ["Spawn", "Deploy to server"],
                ].map(([label, detail]) => (
                  <div key={label} className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3 backdrop-blur-sm">
                    <div className="text-[10px] uppercase tracking-[0.22em] text-amber-100/70">{label}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{detail}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-0 px-6 py-6 md:px-8">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-glass-border/70 pb-4">
              <div>
                <div className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Status</div>
                <div className="mt-1 text-sm text-foreground/85">{selected ? selected.name : "Choose an NPC"}</div>
              </div>
              <div className="rounded-full border border-amber-300/30 bg-amber-400/10 px-3 py-2 text-sm font-semibold text-amber-50">
                {balanceQ.isLoading ? "…" : `${credits.toLocaleString()} cr`}
              </div>
            </div>
            <div className="pt-4">
              <div className="mb-2 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Spawn server</div>
              <div className="flex flex-wrap gap-2">
                {DAYZ_SERVERS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setServerId(s.id)}
                    className={`rounded-full border px-3 py-1.5 text-xs uppercase tracking-wider ${
                      serverId === s.id
                        ? "border-primary/50 bg-primary/15 text-primary"
                        : "border-glass-border text-muted-foreground hover:border-primary/30"
                    }`}
                  >
                    {s.id}
                  </button>
                ))}
              </div>
              <div className="mt-2 font-mono text-[10px] text-muted-foreground">service {serviceId}</div>
            </div>
          </div>
        </div>
      </GlassPanel>

      <GlassPanel className="p-3">
        <div className="flex flex-wrap gap-2">
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
                    className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${category === item ? "bg-white text-black" : "text-white/70 hover:bg-white/10 hover:text-white"}`}
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
                  className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${sort === "price" ? "bg-white text-black" : "text-white/70 hover:bg-white/10 hover:text-white"}`}
                >
                  Price
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSort("name");
                    setOpenMenu(null);
                  }}
                  className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${sort === "name" ? "bg-white text-black" : "text-white/70 hover:bg-white/10 hover:text-white"}`}
                >
                  Name
                </button>
              </div>
            )}
          </div>
        </div>
      </GlassPanel>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((npc) => (
            <motion.button
              key={npc.id}
              type="button"
              onClick={() => setSelected(npc)}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.98 }}
              className={`overflow-hidden rounded-lg border text-left transition hover:border-primary/60 ${selected?.id === npc.id ? "border-primary bg-primary/10" : "border-glass-border bg-black/25"}`}
            >
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
            </motion.button>
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
                  <div className="mt-3 font-mono text-sm text-primary">{selected.price.toLocaleString()} credits</div>
                </div>
                <button type="button" onClick={() => setSelected(null)} className="text-xs text-muted-foreground hover:text-foreground">
                  Close
                </button>
              </div>
              <div className="mt-5 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={buySelected}
                  disabled={owned.includes(selected.id) || buyMut.isPending}
                  className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:bg-emerald-500/20 disabled:text-emerald-300"
                >
                  {owned.includes(selected.id)
                    ? "Owned"
                    : buyMut.isPending
                      ? "Buying…"
                      : `Buy NPC · ${selected.price.toLocaleString()}`}
                </button>
                <button
                  type="button"
                  disabled={!owned.includes(selected.id) || spawning}
                  onClick={spawn}
                  className="w-full rounded-lg border border-primary/40 px-4 py-2.5 text-sm text-primary hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {spawning ? "Deploying…" : `Spawn on ${serverId} · X ${FALLBACK_SPAWN_POS.x} / Z ${FALLBACK_SPAWN_POS.z}`}
                </button>
              </div>
              {selected.cfgSpawnabletypes && (
                <div className="mt-5 border-t border-glass-border pt-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-primary">Nitrado cfgspawnabletypes.xml</div>
                  <pre className="mt-2 max-h-64 overflow-auto rounded-lg border border-glass-border bg-black/40 p-3 text-xs leading-relaxed text-muted-foreground">
                    <code>{selected.cfgSpawnabletypes}</code>
                  </pre>
                </div>
              )}
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