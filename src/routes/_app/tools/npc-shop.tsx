import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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

type NPC = {
  id: string;
  name: string;
  role: string;
  category: string;
  price: number;
  description: string;
  cfgSpawnabletypes?: string;
};
type PlacementMode = "map" | "zy" | "gamertag";

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
    name: "The Beamer",
    role: "Elite Operator",
    category: "Combat",
    price: 2500,
    description:
      "War-room deployable operator. M14 + M4A1 Green loadout, armor, medical, and field kit.",
    cfgSpawnabletypes: THE_BEAMER_CFG_SPAWNABLETYPES,
  },
];

export function NPCShopContent() {
  const { session, user } = useAuth();
  const qc = useQueryClient();
  const selected = NPCS[0];
  const [placementMode, setPlacementMode] = useState<PlacementMode>("map");
  const [y, setY] = useState(String(DEFAULT_SPAWN_POSITION.x));
  const [z, setZ] = useState(String(DEFAULT_SPAWN_POSITION.z));
  const [gamertag, setGamertag] = useState("");
  const [spawning, setSpawning] = useState(false);

  const playerId = user?.id || "demo-user";
  const displayName =
    (typeof user?.user_metadata?.name === "string" && user.user_metadata.name) ||
    user?.email ||
    playerId;

  useEffect(() => {
    if (!gamertag && displayName && displayName !== "demo-user") {
      setGamertag(displayName);
    }
  }, [displayName, gamertag]);

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
    refetchInterval: placementMode === "gamertag" ? 15_000 : false,
  });

  const credits = balanceQ.data?.balance ?? 0;
  const owned = ownedQ.data?.owned ?? [];
  const isOwned = owned.includes(selected.id);
  const server = DAYZ_SERVERS.find((s) => s.id === PRIMARY_SERVER_ID) ?? DAYZ_SERVERS[0];
  const serviceId =
    catalogQ.data?.find((s) => s.id === PRIMARY_SERVER_ID)?.serviceId ?? server.fallbackServiceId;

  const matchedPlayer = useMemo(() => {
    const target = gamertag.trim().toLocaleLowerCase();
    if (!target) return null;
    return playersQ.data?.players.find((entry) => entry.name.toLocaleLowerCase() === target) ?? null;
  }, [gamertag, playersQ.data?.players]);

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
    if (!isOwned) return toast.error("Buy The Beamer first");

    let position = {
      x: Number(y),
      z: Number(z),
    };

    if (placementMode === "gamertag") {
      if (!matchedPlayer) {
        return toast.error("Gamertag not online on 101x", {
          description: "Link/sign in with your exact in-game name, or use Z / Y / map.",
        });
      }
      if (!Number.isFinite(matchedPlayer.x) || !Number.isFinite(matchedPlayer.z)) {
        return toast.error("Live position unavailable", {
          description: "Your gamertag is online, but the latest log line has no coordinates yet. Use Z / Y or Choose on map.",
        });
      }
      position = { x: matchedPlayer.x as number, z: matchedPlayer.z as number };
    }

    if (placementMode === "zy") {
      if (!Number.isFinite(position.x) || !Number.isFinite(position.z) || position.x < 0 || position.z < 0) {
        return toast.error("Enter valid Y and Z coordinates");
      }
    }

    setSpawning(true);
    try {
      const result = await spawnNpc({
        data: {
          serviceId,
          npcId: selected.id,
          x: Math.round(position.x),
          z: Math.round(position.z),
          a: 0,
          playerId,
          playerName: displayName,
        },
      });
      if (result.mode === "live") {
        toast.success(`${selected.name} spawned live on ${server.label}`, {
          description: `Via ${result.adapter} Â· Y ${Math.round(position.x)} / Z ${Math.round(position.z)}`,
        });
      } else {
        toast.warning("Live spawn unavailable", { description: result.reason });
        toast.success(`${selected.name} queued on ${server.label}`, {
          description: !result.restarted
            ? "Already loaded on the server â€” CE is managing it."
            : result.restockSeconds > 0
              ? `Set to Y ${Math.round(position.x)} / Z ${Math.round(position.z)}. Restarting, then respawns every ${result.restockSeconds}s.`
              : `Set to Y ${Math.round(position.x)} / Z ${Math.round(position.z)}. Server restarting to load it.`,
        });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to queue spawn");
    } finally {
      setSpawning(false);
    }
  };

  const modes: { id: PlacementMode; label: string; detail: string }[] = [
    { id: "map", label: "1 Â· Choose on map", detail: "Drop a pin on Chernarus / Livonia" },
    { id: "zy", label: "2 Â· Z or Y", detail: "Manual DayZ world Y / Z entry" },
    { id: "gamertag", label: "3 Â· Spawn at my gamertag", detail: "Auto-resolve linked online position" },
  ];

  return (
    <div className="relative min-h-[calc(100vh-3rem)] overflow-hidden bg-black px-4 py-8 text-zinc-100">
      <style>{`@keyframes warroom-scan { 0% { transform: translateY(-100%); } 100% { transform: translateY(100%); } }
@keyframes warroom-flicker { 0%,100% { opacity:.35 } 40% { opacity:.85 } 60% { opacity:.2 } }
@keyframes npc-pulse { 0%,100% { opacity:.2 } 50% { opacity:.55 } }`}</style>

      <img
        src="/factions.jpg"
        alt="The Beamer war room"
        className="pointer-events-none absolute inset-x-0 top-0 h-[34rem] w-full object-cover object-center opacity-40"
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[34rem] bg-gradient-to-b from-black/20 via-black/70 to-black" />
      <motion.div
        className="pointer-events-none absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_50%_18%,color-mix(in_oklab,var(--primary)_28%,transparent),transparent_58%)]"
        animate={{ opacity: [0.25, 0.45, 0.25] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(135deg,transparent_0%,transparent_48%,color-mix(in_oklab,var(--primary)_18%,transparent)_49%,transparent_50%)] [background-size:46px_46px]" />
      <div
        className="pointer-events-none absolute inset-x-0 h-40 opacity-[0.07]"
        style={{
          background:
            "linear-gradient(180deg, transparent, color-mix(in oklab, var(--primary) 90%, white), transparent)",
          animation: "warroom-scan 6s linear infinite",
        }}
      />
      <div className="pointer-events-none absolute inset-6 sm:inset-10" style={{ animation: "warroom-flicker 7s ease-in-out infinite" }} aria-hidden>
        {["top-0 left-0 border-t border-l", "top-0 right-0 border-t border-r", "bottom-0 left-0 border-b border-l", "bottom-0 right-0 border-b border-r"].map((pos) => (
          <span key={pos} className={`absolute size-8 sm:size-12 border-primary/40 ${pos}`} />
        ))}
      </div>

      <div className="relative mx-auto max-w-6xl space-y-8 pt-4">
        <header className="flex flex-wrap items-end justify-between gap-5 border-b border-primary/30 pb-6">
          <div>
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.3em] text-primary">
              <IconCampaign size={14} /> War Room Â· NPC Deploy
            </div>
            <h1 className="font-display mt-3 text-5xl text-primary sm:text-6xl">The Beamer</h1>
            <p className="mt-3 max-w-2xl text-sm text-zinc-400 sm:text-base">
              Purchase once, then deploy with map pin, Z/Y coordinates, or your live gamertag position on 101x.
            </p>
          </div>
          <div className="rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-right backdrop-blur-sm">
            <div className="text-[10px] uppercase tracking-[0.2em] text-primary/80">Credits</div>
            <div className="mt-1 font-mono text-2xl text-white">{balanceQ.isLoading ? "â€¦" : credits.toLocaleString()}</div>
            <div className="mt-1 max-w-[180px] truncate text-[10px] text-zinc-400">{displayName}</div>
          </div>
        </header>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-3xl border border-primary/25 bg-black/55 shadow-[0_0_60px_rgba(245,158,11,0.08)] backdrop-blur-md"
          >
            <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,.12)_1px,transparent_1px)] [background-size:100%_5px]" style={{ animation: "npc-pulse 2.8s ease-in-out infinite" }} />
            <div className="relative">
              <div className="relative h-64 overflow-hidden sm:h-80">
                <img src="/factions.jpg" alt="Beamer operator" className="h-full w-full object-cover object-[center_20%]" />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                <div className="absolute bottom-4 left-4 right-4 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-primary">
                      <IconBot size={14} /> Operator manifest
                    </div>
                    <div className="mt-1 font-display text-3xl text-white">{selected.name}</div>
                    <div className="mt-1 text-xs text-zinc-300">{selected.role} Â· {selected.category}</div>
                  </div>
                  <div className="rounded-full border border-primary/40 bg-black/50 px-3 py-1 font-mono text-sm text-primary">
                    {selected.price.toLocaleString()} cr
                  </div>
                </div>
              </div>
              <div className="space-y-5 p-5 sm:p-6">
                <p className="text-sm leading-relaxed text-zinc-300">{selected.description}</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  {[["M14 + MK4", "Long range"], ["M4A1 Green", "CQB kit"], ["Plate + Med", "Survive"]].map(([title, detail]) => (
                    <div key={title} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                      <div className="text-[10px] uppercase tracking-[0.2em] text-primary/80">{title}</div>
                      <div className="mt-1 text-sm text-zinc-300">{detail}</div>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => !isOwned && buyMut.mutate(selected)}
                  disabled={isOwned || buyMut.isPending}
                  className="relative w-full overflow-hidden rounded-full bg-primary px-5 py-3.5 text-sm font-semibold uppercase tracking-[0.18em] text-primary-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
                >
                  {isOwned ? "Owned â€” ready to deploy" : buyMut.isPending ? "Purchasingâ€¦" : `Buy Beamer Â· ${selected.price.toLocaleString()} cr`}
                </button>
              </div>
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="rounded-3xl border border-primary/25 bg-black/70 p-5 backdrop-blur-md sm:p-6"
          >
            <div className="text-[10px] uppercase tracking-[0.28em] text-primary">Deployment options Â· 101x</div>
            <div className="mt-4 space-y-2">
              {modes.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setPlacementMode(mode.id)}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                    placementMode === mode.id
                      ? "border-primary/60 bg-primary/15 shadow-[0_0_24px_rgba(245,158,11,0.12)]"
                      : "border-white/10 bg-white/[0.03] hover:border-primary/35"
                  }`}
                >
                  <div className="text-sm font-medium text-white">{mode.label}</div>
                  <div className="mt-0.5 text-xs text-zinc-400">{mode.detail}</div>
                </button>
              ))}
            </div>

            <div className="mt-5 border-t border-white/10 pt-5">
              {placementMode === "map" && (
                <div className="space-y-3">
                  <p className="text-sm text-zinc-400">
                    Open the satellite map, drop a pin, then deploy from the map tool.
                  </p>
                  <button
                    type="button"
                    disabled={!isOwned}
                    onClick={() =>
                      window.open(
                        `/tools/npc-map-clicker?npcId=${encodeURIComponent(selected.id)}`,
                        "_blank",
                        "noopener,noreferrer",
                      )
                    }
                    className="flex w-full items-center justify-center gap-2 rounded-full border border-primary/50 px-4 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-primary transition hover:bg-primary/10 disabled:opacity-40"
                  >
                    Open map selector <IconArrowRight size={14} />
                  </button>
                </div>
              )}

              {placementMode === "zy" && (
                <div className="space-y-3">
                  <p className="text-xs text-zinc-400">
                    DayZ world plane: <span className="text-primary">Y</span> maps to east/west (X), 
                    <span className="text-primary">Z</span> maps to north/south.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="text-[10px] uppercase tracking-[0.18em] text-zinc-400">
                      Y
                      <input
                        value={y}
                        onChange={(event) => setY(event.target.value)}
                        inputMode="numeric"
                        className="mt-1 w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2.5 font-mono text-sm text-white outline-none focus:border-primary"
                      />
                    </label>
                    <label className="text-[10px] uppercase tracking-[0.18em] text-zinc-400">
                      Z
                      <input
                        value={z}
                        onChange={(event) => setZ(event.target.value)}
                        inputMode="numeric"
                        className="mt-1 w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2.5 font-mono text-sm text-white outline-none focus:border-primary"
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    disabled={!isOwned || spawning}
                    onClick={spawn}
                    className="w-full rounded-full bg-primary px-4 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-primary-foreground disabled:opacity-40"
                  >
                    {spawning ? "Deployingâ€¦" : "Deploy at Z / Y"}
                  </button>
                </div>
              )}

              {placementMode === "gamertag" && (
                <div className="space-y-3">
                  <label className="text-[10px] uppercase tracking-[0.18em] text-zinc-400">
                    My gamertag
                    <input
                      value={gamertag}
                      onChange={(event) => setGamertag(event.target.value)}
                      placeholder="Exact in-game name"
                      className="mt-1 w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2.5 text-sm text-white outline-none focus:border-primary"
                    />
                  </label>
                  <p className="text-xs leading-relaxed text-zinc-400">
                    Auto-filled from your hub account when available. Spawns at the latest logged live position for that name on 101x.
                    {" "}
                    {playersQ.isFetching
                      ? "Refreshing online rosterâ€¦"
                      : matchedPlayer
                        ? `Online on ${matchedPlayer.server}${Number.isFinite(matchedPlayer.x) ? ` Â· pos Y ${Math.round(matchedPlayer.x!)} / Z ${Math.round(matchedPlayer.z!)}` : " Â· waiting for coordinates"}`
                        : "Not seen online yet."}
                  </p>
                  <button
                    type="button"
                    disabled={!isOwned || spawning}
                    onClick={spawn}
                    className="w-full rounded-full bg-primary px-4 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-primary-foreground disabled:opacity-40"
                  >
                    {spawning ? "Deployingâ€¦" : "Spawn at my gamertag"}
                  </button>
                </div>
              )}
            </div>
          </motion.section>
        </div>
      </div>
    </div>
  );
}
