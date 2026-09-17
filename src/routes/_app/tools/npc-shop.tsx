import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { IconArrowRight, IconBot, IconCampaign } from "@/components/ui-custom/CustomIcon";
import { toast } from "sonner";
import { spawnNpc } from "@/lib/dayz-spawn.functions";
import { DAYZ_SERVERS } from "@/lib/dayz/servers";
import { listAsylumServiceIds } from "@/lib/dayz/server-status.functions";
import { getEconomyBalance, getNpcInventory, purchaseNpc } from "@/lib/economy.functions";
import { useAuth } from "@/contexts/AuthContext";
import { getOnlinePlayers } from "@/lib/online-players.functions";

const PRIMARY_SERVER_ID = "101x";
const DEFAULT_SPAWN_POSITION = { x: 7500, z: 7500, a: 0 };

export const Route = createFileRoute("/_app/tools/npc-shop")({
  component: NPCShopContent,
});

type NPC = { id: string; name: string; role: string; category: string; price: number; description: string; cfgSpawnabletypes?: string };
type PlacementMode = "coordinates" | "gamertag" | "map";

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
  const { session, user } = useAuth();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<NPC | null>(NPCS[0]);
  const [placementMode, setPlacementMode] = useState<PlacementMode>("coordinates");
  const [x, setX] = useState(String(DEFAULT_SPAWN_POSITION.x));
  const [z, setZ] = useState(String(DEFAULT_SPAWN_POSITION.z));
  const [gamertag, setGamertag] = useState("");
  const [spawning, setSpawning] = useState(false);
  const playerId = user?.id || "demo-user";
  const displayName =
    (typeof user?.user_metadata?.name === "string" && user.user_metadata.name) ||
    user?.email ||
    playerId;

  const balanceQ = useQuery({
    queryKey: ["economy-balance", playerId],
    queryFn: () => getEconomyBalance({ data: { playerId, displayName } }),
  });
  const ownedQ = useQuery({
    queryKey: ["npc-inventory", playerId],
    queryFn: () => getNpcInventory({ data: { playerId } }),
  });
  const catalogQ = useQuery({
    queryKey: ["asylum-services"],
    queryFn: () => listAsylumServiceIds(),
  });
  const playersQ = useQuery({
    queryKey: ["online-players", PRIMARY_SERVER_ID],
    queryFn: () => getOnlinePlayers({ data: { accessToken: session?.access_token } }),
    enabled: Boolean(session?.access_token),
  });

  const credits = balanceQ.data?.balance ?? 0;
  const owned = ownedQ.data?.owned ?? [];
  const server = DAYZ_SERVERS.find((s) => s.id === PRIMARY_SERVER_ID) ?? DAYZ_SERVERS[0];
  const serviceId =
    catalogQ.data?.find((s) => s.id === PRIMARY_SERVER_ID)?.serviceId ?? server.fallbackServiceId;

  const buyMut = useMutation({
    mutationFn: (npc: NPC) =>
      purchaseNpc({
        data: {
          npcId: npc.id,
          npcName: npc.name,
          price: npc.price,
        },
      }),
    onSuccess: (res, npc) => {
      toast.success(res.owned.includes(npc.id) ? `${npc.name} purchased` : `${npc.name} already owned`);
      qc.invalidateQueries({ queryKey: ["economy-balance", playerId] });
      qc.invalidateQueries({ queryKey: ["npc-inventory", playerId] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Purchase failed"),
  });

  const spawn = async () => {
    if (!selected || !owned.includes(selected.id)) return toast.error("Buy this NPC first");
    const manualX = Number(x);
    const manualZ = Number(z);
    let position = { x: manualX, z: manualZ };
    if (placementMode === "gamertag") {
      const target = gamertag.trim().toLocaleLowerCase();
      const player = playersQ.data?.players.find((entry) => entry.name.toLocaleLowerCase() === target);
      if (!player || !Number.isFinite(player.x) || !Number.isFinite(player.z)) {
        return toast.error("Gamertag location unavailable", { description: "Enter the name exactly as it appears online, or choose a map position." });
      }
      position = { x: player.x, z: player.z };
    }
    if (!Number.isFinite(position.x) || !Number.isFinite(position.z) || position.x < 0 || position.z < 0) {
      return toast.error("Enter valid X and Z coordinates");
    }
    setSpawning(true);
    try {
      const result = await spawnNpc({
        data: { serviceId, serverId: PRIMARY_SERVER_ID, npcId: selected.id, x: Math.round(position.x), z: Math.round(position.z), a: 0 },
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
              ? `Spawn request set to X ${Math.round(position.x)} / Z ${Math.round(position.z)}. Server is restarting to load it — after that it respawns every ${result.restockSeconds}s on its own.`
              : `Spawn request set to X ${Math.round(position.x)} / Z ${Math.round(position.z)}. Server is restarting to load it.`,
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
    <div className="relative min-h-[calc(100vh-3rem)] overflow-hidden bg-[#08090c] px-4 py-8 text-zinc-100">
      <style>{`@keyframes npc-scan { 0% { transform: translateY(-120%); } 100% { transform: translateY(120%); } } @keyframes npc-pulse { 0%,100% { opacity:.25 } 50% { opacity:.75 } }`}</style>
      <img src="/factions.jpg" alt="DayZ operators" className="pointer-events-none absolute inset-x-0 top-0 h-[31rem] w-full object-cover object-center opacity-35" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[31rem] bg-gradient-to-b from-black/10 via-[#08090c]/55 to-[#08090c]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-orange-400/80" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-orange-500/10 blur-2xl" style={{ animation: "npc-scan 7s linear infinite" }} />
      <header className="relative mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-5 border-b border-orange-300/30 pb-6 pt-8">
        <div>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.3em] text-orange-300"><IconCampaign size={14} /> 101x live deployment</div>
          <h1 className="font-display mt-3 text-5xl text-white sm:text-6xl">TheBeamer</h1>
          <p className="mt-3 max-w-xl text-sm text-zinc-300">Lock a drop point, install the loadout on Nitrado, and deploy the operator.</p>
        </div>
        <div className="border-l border-orange-300/60 pl-4 text-right">
          <div className="text-[10px] uppercase tracking-[0.2em] text-orange-200/80">Available credits</div>
          <div className="mt-1 font-mono text-2xl text-white">{balanceQ.isLoading ? "..." : credits.toLocaleString()}</div>
        </div>
      </header>

      <div className="relative mx-auto grid max-w-6xl items-start gap-5 pt-10 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="hidden">
          {NPCS.map((npc) => (
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
            <section className="relative overflow-hidden border-y border-orange-300/40 bg-black/55 p-6 backdrop-blur-sm">
              <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,.12)_1px,transparent_1px)] [background-size:100%_5px]" style={{ animation: "npc-pulse 2.5s ease-in-out infinite" }} />
              <div className="relative">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-orange-300"><IconBot size={14} /> Operator manifest</div>
                  <h2 className="mt-1 font-display text-3xl text-white">{selected.name}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-300">{selected.description}</p>
                  <div className="mt-3 font-mono text-sm text-orange-200">{selected.price.toLocaleString()} credits</div>
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
                  className="w-full bg-orange-400 px-4 py-3 text-sm font-semibold text-black transition hover:bg-orange-300 disabled:bg-zinc-700 disabled:text-zinc-400"
                >
                  {owned.includes(selected.id)
                    ? "Owned"
                    : buyMut.isPending
                      ? "Buying…"
                      : `Buy NPC · ${selected.price.toLocaleString()}`}
                </button>
                <div className="border-y border-orange-300/25 py-4">
                  <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-400">Deployment location · 101x</div>
                  <div className="mt-3 grid grid-cols-3 gap-1">
                    {([
                      ["coordinates", "X / Z"],
                      ["gamertag", "Gamertag"],
                      ["map", "Map"],
                    ] as const).map(([mode, label]) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setPlacementMode(mode)}
                        className={`border px-2 py-2 text-[10px] uppercase tracking-wide transition ${placementMode === mode ? "border-orange-300 bg-orange-300/15 text-orange-200" : "border-white/10 text-zinc-400 hover:border-orange-300/50"}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {placementMode === "coordinates" && (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <label className="text-[10px] uppercase tracking-wide text-muted-foreground">X<input value={x} onChange={(event) => setX(event.target.value)} inputMode="numeric" className="mt-1 w-full border border-glass-border bg-black/40 px-2 py-2 font-mono text-sm text-foreground outline-none focus:border-primary" /></label>
                      <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Z<input value={z} onChange={(event) => setZ(event.target.value)} inputMode="numeric" className="mt-1 w-full border border-glass-border bg-black/40 px-2 py-2 font-mono text-sm text-foreground outline-none focus:border-primary" /></label>
                    </div>
                  )}
                  {placementMode === "gamertag" && (
                    <div className="mt-3">
                      <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Online gamertag<input value={gamertag} onChange={(event) => setGamertag(event.target.value)} placeholder="Exact in-game name" className="mt-1 w-full border border-glass-border bg-black/40 px-2 py-2 text-sm text-foreground outline-none focus:border-primary" /></label>
                      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">Uses the latest logged position on 101x. {playersQ.isFetching ? "Checking player logs..." : ""}</p>
                    </div>
                  )}
                  {placementMode === "map" && (
                    <button type="button" onClick={() => window.open(`/tools/npc-map-clicker?npcId=${encodeURIComponent(selected.id)}`, "_blank", "noopener,noreferrer")} className="mt-3 flex w-full items-center justify-center gap-2 border border-primary/40 px-3 py-2.5 text-xs uppercase tracking-wide text-primary transition hover:bg-primary/10">
                      Choose on map <IconArrowRight size={14} />
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  disabled={!owned.includes(selected.id) || spawning || placementMode === "map"}
                  onClick={spawn}
                  className="w-full border border-orange-300/60 px-4 py-3 text-sm font-medium text-orange-100 transition hover:bg-orange-300/15 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {spawning ? "Deploying…" : placementMode === "map" ? "Choose a map point first" : "Deploy TheBeamer on 101x"}
                </button>
              </div>
              </div>
            </section>
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