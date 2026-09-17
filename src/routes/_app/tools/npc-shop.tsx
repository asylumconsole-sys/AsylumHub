import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { GlassPanel } from "@/components/ui-custom/GlassPanel";
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
          playerId,
          displayName,
          npcId: npc.id,
          npcName: npc.name,
          price: npc.price,
          serverId: "101",
        },
      }),
    onSuccess: (res, npc) => {
      toast.success(res.alreadyOwned ? `${npc.name} already owned` : `${npc.name} purchased`);
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
    <div className="relative min-h-[calc(100vh-3rem)] space-y-6 overflow-hidden bg-black px-4 py-8">
      <style>{`@keyframes npc-scan { 0% { transform: translateY(-120%); } 100% { transform: translateY(120%); } }`}</style>
      <div className="pointer-events-none absolute inset-0 opacity-25 [background-image:radial-gradient(circle_at_50%_0%,color-mix(in_oklab,var(--primary)_22%,transparent),transparent_55%)]" />
      <div className="pointer-events-none absolute inset-6 border border-primary/15" />
      <div className="pointer-events-none absolute inset-x-0 h-32 bg-primary/10 blur-xl" style={{ animation: "npc-scan 6s linear infinite" }} />
      <header className="relative mx-auto flex max-w-5xl flex-wrap items-end justify-between gap-5 border-b border-primary/25 pb-6">
        <div>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.3em] text-primary"><IconCampaign size={14} /> 101x deployment terminal</div>
          <h1 className="font-display mt-3 text-5xl text-primary sm:text-6xl">NPC Command</h1>
          <p className="mt-3 max-w-xl text-sm text-zinc-400">Deploy TheBeamer through the live adapter or the Central Economy restart queue.</p>
        </div>
        <div className="border border-primary/30 bg-primary/10 px-4 py-3 text-right">
          <div className="text-[10px] uppercase tracking-[0.2em] text-primary/80">Available credits</div>
          <div className="mt-1 font-mono text-xl text-primary">{balanceQ.isLoading ? "..." : credits.toLocaleString()}</div>
        </div>
      </header>

      <div className="relative mx-auto grid max-w-5xl items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-3">
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
            <GlassPanel className="border border-primary/40 bg-black/95 p-5 shadow-xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-primary"><IconBot size={14} /> Selected asset</div>
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
                <div className="border-y border-primary/20 py-3">
                  <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Deployment location · 101x</div>
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
                        className={`border px-2 py-2 text-[10px] uppercase tracking-wide transition ${placementMode === mode ? "border-primary bg-primary/15 text-primary" : "border-white/10 text-muted-foreground hover:border-primary/35"}`}
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
                  className="w-full rounded-lg border border-primary/40 px-4 py-2.5 text-sm text-primary hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {spawning ? "Deploying…" : placementMode === "map" ? "Choose a map point first" : "Deploy TheBeamer on 101x"}
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