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
import { BRAND } from "@/lib/brand";

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



/** Add more NPCs to this list later — shop UI is catalog-driven. */
const NPCS: NPC[] = [
  {
    id: "the_beamer",
    name: "The Beamer",
    role: "Elite Operator",
    category: "Combat",
    price: 2500,
    description: "Deployable operator with M14, M4A1, armor, medical, and field kit.",
    cfgSpawnabletypes: THE_BEAMER_CFG_SPAWNABLETYPES,
  },
];

function WarRoomBackdrop() {
  return (
    <>
      <style>{`
        @keyframes warroom-scan { 0% { transform: translateY(-100%); } 100% { transform: translateY(100%); } }
        @keyframes warroom-flicker { 0%, 100% { opacity: 1; } 42% { opacity: 1; } 43% { opacity: 0.72; } 44% { opacity: 1; } 71% { opacity: 1; } 72% { opacity: 0.8; } 73% { opacity: 1; } }
        @keyframes warroom-shine { 0% { transform: translateX(-140%) skewX(-20deg); } 100% { transform: translateX(240%) skewX(-20deg); } }
      `}</style>
      <motion.div
        className="pointer-events-none absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_50%_20%,color-mix(in_oklab,var(--primary)_25%,transparent),transparent_60%)]"
        animate={{ opacity: [0.28, 0.5, 0.28] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="pointer-events-none absolute inset-0 opacity-0 [background-image:radial-gradient(circle_at_80%_80%,color-mix(in_oklab,var(--primary)_20%,transparent),transparent_55%)]"
        animate={{ opacity: [0, 0.35, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1.2 }}
      />
      <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(135deg,transparent_0%,transparent_48%,color-mix(in_oklab,var(--primary)_18%,transparent)_49%,transparent_50%)] [background-size:46px_46px]" />
      <div
        className="pointer-events-none absolute inset-x-0 h-40 opacity-[0.06]"
        style={{
          background: "linear-gradient(180deg, transparent, color-mix(in oklab, var(--primary) 90%, white), transparent)",
          animation: "warroom-scan 6s linear infinite",
        }}
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-6 sm:inset-10" style={{ animation: "warroom-flicker 7s ease-in-out infinite" }} aria-hidden>
        {(["top-4 left-4 border-l border-t", "top-4 right-4 border-r border-t", "bottom-4 left-4 border-l border-b", "bottom-4 right-4 border-r border-b"] as const).map((pos) => (
          <span key={pos} className={`absolute size-8 sm:size-12 border-primary/40 ${pos}`} />
        ))}
      </div>
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {Array.from({ length: 34 }, (_, index) => (
          <motion.span
            key={index}
            className="absolute bottom-0 rounded-full bg-primary/70"
            style={{
              left: `${(index * 12.1) % 100}%`,
              width: 1.5 + (index % 4),
              height: 1.5 + (index % 4),
              boxShadow: "0 0 10px color-mix(in oklab, var(--primary) 80%, transparent)",
            }}
            animate={{ y: [0, -420 - (index % 5) * 60], x: [0, ((index % 3) - 1) * 30], opacity: [0, 1, 0] }}
            transition={{ duration: 5 + (index % 7), repeat: Infinity, delay: (index % 11) * 0.35, ease: "easeOut" }}
          />
        ))}
      </div>
    </>
  );
}

export function NPCShopContent() {
  const { session, user } = useAuth();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState(NPCS[0]?.id ?? "");
  const selected = NPCS.find((npc) => npc.id === selectedId) ?? NPCS[0];
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
  const isOwned = selected ? owned.includes(selected.id) : false;
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
    if (!selected) return;
    if (!isOwned) return toast.error(`Buy ${selected.name} first`);

    let position = { x: Number(y), z: Number(z) };

    if (placementMode === "gamertag") {
      if (!matchedPlayer) {
        return toast.error("Gamertag not online on 101x", {
          description: "Use the exact in-game name, or switch to Z / Y / map.",
        });
      }
      if (!Number.isFinite(matchedPlayer.x) || !Number.isFinite(matchedPlayer.z)) {
        return toast.error("Live position unavailable", {
          description: "Online, but no coordinates in the latest logs yet. Use Z / Y or Choose on map.",
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
          description: `Via ${result.adapter} · Y ${Math.round(position.x)} / Z ${Math.round(position.z)}`,
        });
      } else {
        toast.warning("Live spawn unavailable", { description: result.reason });
        toast.success(`${selected.name} queued on ${server.label}`, {
          description: !result.restarted
            ? "Already loaded on the server — CE is managing it."
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
    { id: "map", label: "1. Choose on map", detail: "Open the map selector and drop a pin" },
    { id: "zy", label: "2. Z or Y", detail: "Enter DayZ world Y / Z manually" },
    { id: "gamertag", label: "3. Spawn at my gamertag", detail: "Use linked online player position" },
  ];

  return (
    <div className="relative min-h-[calc(100vh-3rem)] overflow-hidden bg-black px-4 py-8 text-zinc-100">
      <WarRoomBackdrop />

      <div className="relative mx-auto max-w-6xl space-y-8">
        <header className="flex flex-wrap items-end justify-between gap-5 border-b border-primary/25 pb-6">
          <div>
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.3em] text-primary">
              <IconCampaign size={14} /> {BRAND.name} · NPC deploy
            </div>
            <motion.h1
              className="font-display mt-2 text-5xl text-primary sm:text-6xl"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              Operators
            </motion.h1>
            <p className="mt-3 max-w-xl text-sm text-zinc-400 sm:text-base">
              War Room deploy console. Only The Beamer is live — more operators slot into the roster later.
            </p>
          </div>
          <div className="rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-right backdrop-blur-sm">
            <div className="text-[10px] uppercase tracking-[0.2em] text-primary/80">Credits</div>
            <div className="mt-1 font-mono text-2xl text-white">{balanceQ.isLoading ? "…" : credits.toLocaleString()}</div>
            <div className="mt-1 max-w-[160px] truncate text-[10px] text-zinc-400">{displayName}</div>
          </div>
        </header>

        <div className="grid items-start gap-5 lg:grid-cols-[240px_minmax(0,1fr)_340px]">
          <aside className="space-y-2">
            <div className="text-[10px] uppercase tracking-[0.22em] text-primary/80">Roster · {NPCS.length}</div>
            <div className="space-y-2">
              {NPCS.map((npc) => {
                const npcOwned = owned.includes(npc.id);
                const active = selected?.id === npc.id;
                return (
                  <button
                    key={npc.id}
                    type="button"
                    onClick={() => setSelectedId(npc.id)}
                    className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                      active
                        ? "border-primary/50 bg-primary/15 shadow-[0_0_24px_color-mix(in_oklab,var(--primary)_25%,transparent)]"
                        : "border-primary/15 bg-white/[0.02] hover:border-primary/35"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium text-white">{npc.name}</span>
                      <span className="font-mono text-[10px] text-primary">{npc.price.toLocaleString()}</span>
                    </div>
                    <div className="mt-1 text-[10px] uppercase tracking-wide text-zinc-500">
                      {npc.role} · {npc.category}
                    </div>
                    {npcOwned ? <div className="mt-1 text-[10px] uppercase tracking-wide text-primary/90">Owned</div> : null}
                  </button>
                );
              })}
            </div>
            <div className="rounded-2xl border border-dashed border-primary/20 px-3 py-4 text-center text-[11px] text-zinc-600">
              More NPCs slot here
            </div>
          </aside>

          <motion.section
            className="overflow-hidden rounded-2xl border border-primary/25 bg-white/[0.02]"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          >
            {selected ? (
              <>
                <div className="relative flex h-52 items-center justify-center border-b border-primary/20 bg-black/40">
                  <div className="relative flex size-20 items-center justify-center">
                    <motion.span
                      className="absolute inset-0 rounded-full border border-primary/30 border-t-primary"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
                    />
                    <motion.span
                      className="absolute inset-1.5 rounded-full border border-dashed border-primary/20"
                      animate={{ rotate: -360 }}
                      transition={{ duration: 9, repeat: Infinity, ease: "linear" }}
                    />
                    <div className="relative flex size-14 items-center justify-center rounded-2xl border border-primary/40 bg-primary/10 text-primary">
                      <IconBot size={28} />
                    </div>
                  </div>
                  <div className="absolute bottom-3 left-0 right-0 text-center text-[10px] uppercase tracking-[0.24em] text-zinc-600">
                    Image placeholder
                  </div>
                </div>
                <div className="space-y-4 p-5 sm:p-6">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.22em] text-primary">Selected operator</div>
                    <h2 className="mt-1 font-display text-3xl text-primary">{selected.name}</h2>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-400">{selected.description}</p>
                    <div className="mt-3 font-mono text-sm text-primary">{selected.price.toLocaleString()} credits</div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[["Loadout", "M14 / M4"], ["Kit", "Armor + med"], ["Server", "101x"]].map(([label, value]) => (
                      <div key={label} className="rounded-xl border border-primary/15 bg-black/30 px-3 py-2">
                        <div className="text-[10px] uppercase tracking-wide text-primary/70">{label}</div>
                        <div className="mt-1 text-xs text-zinc-300">{value}</div>
                      </div>
                    ))}
                  </div>
                  <motion.button
                    type="button"
                    onClick={() => !isOwned && buyMut.mutate(selected)}
                    disabled={isOwned || buyMut.isPending}
                    className="relative w-full overflow-hidden rounded-full bg-primary px-5 py-3.5 text-sm font-semibold uppercase tracking-[0.18em] text-primary-foreground disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
                    whileHover={isOwned || buyMut.isPending ? undefined : { scale: 1.02, boxShadow: "0 0 40px color-mix(in oklab, var(--primary) 60%, transparent)" }}
                    whileTap={isOwned || buyMut.isPending ? undefined : { scale: 0.97 }}
                  >
                    <span
                      className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-white/40 blur-sm"
                      style={{ animation: "warroom-shine 2.6s ease-in-out infinite" }}
                      aria-hidden
                    />
                    <span className="relative">
                      {isOwned
                        ? "Owned — ready to deploy"
                        : buyMut.isPending
                          ? "Purchasing…"
                          : `Buy · ${selected.price.toLocaleString()} cr`}
                    </span>
                  </motion.button>
                </div>
              </>
            ) : (
              <div className="p-8 text-center text-sm text-zinc-500">Select an NPC from the roster.</div>
            )}
          </motion.section>

          <motion.section
            className="rounded-2xl border border-primary/25 bg-white/[0.02] p-5"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="text-[10px] uppercase tracking-[0.22em] text-primary">Deploy · 101x</div>
            <div className="mt-4 space-y-2">
              {modes.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setPlacementMode(mode.id)}
                  className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                    placementMode === mode.id
                      ? "border-primary/50 bg-primary/15"
                      : "border-primary/15 hover:border-primary/35"
                  }`}
                >
                  <div className="text-sm text-white">{mode.label}</div>
                  <div className="mt-0.5 text-xs text-zinc-500">{mode.detail}</div>
                </button>
              ))}
            </div>

            <div className="mt-5 border-t border-primary/20 pt-5">
              {placementMode === "map" && (
                <div className="space-y-3">
                  <p className="text-xs text-zinc-500">Opens the map tool so you can pick coordinates.</p>
                  <button
                    type="button"
                    disabled={!isOwned || !selected}
                    onClick={() =>
                      selected &&
                      window.open(
                        `/tools/npc-map-clicker?npcId=${encodeURIComponent(selected.id)}`,
                        "_blank",
                        "noopener,noreferrer",
                      )
                    }
                    className="flex w-full items-center justify-center gap-2 rounded-full border border-primary/40 px-4 py-3 text-sm uppercase tracking-[0.14em] text-primary transition hover:bg-primary/10 disabled:opacity-40"
                  >
                    Choose on map <IconArrowRight size={14} />
                  </button>
                </div>
              )}

              {placementMode === "zy" && (
                <div className="space-y-3">
                  <p className="text-xs text-zinc-500">
                    <span className="text-primary">Y</span> = east/west (X). <span className="text-primary">Z</span> = north/south.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-[10px] uppercase tracking-wide text-zinc-500">
                      Y
                      <input
                        value={y}
                        onChange={(e) => setY(e.target.value)}
                        inputMode="numeric"
                        className="mt-1 w-full rounded-xl border border-primary/20 bg-black/50 px-3 py-2 font-mono text-sm text-white outline-none focus:border-primary"
                      />
                    </label>
                    <label className="text-[10px] uppercase tracking-wide text-zinc-500">
                      Z
                      <input
                        value={z}
                        onChange={(e) => setZ(e.target.value)}
                        inputMode="numeric"
                        className="mt-1 w-full rounded-xl border border-primary/20 bg-black/50 px-3 py-2 font-mono text-sm text-white outline-none focus:border-primary"
                      />
                    </label>
                  </div>
                  <motion.button
                    type="button"
                    disabled={!isOwned || spawning}
                    onClick={spawn}
                    className="relative w-full overflow-hidden rounded-full bg-primary px-4 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-primary-foreground disabled:opacity-40"
                    whileHover={!isOwned || spawning ? undefined : { scale: 1.02 }}
                    whileTap={!isOwned || spawning ? undefined : { scale: 0.97 }}
                  >
                    <span
                      className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-white/40 blur-sm"
                      style={{ animation: "warroom-shine 2.6s ease-in-out infinite" }}
                      aria-hidden
                    />
                    <span className="relative">{spawning ? "Deploying…" : "Deploy at Z / Y"}</span>
                  </motion.button>
                </div>
              )}

              {placementMode === "gamertag" && (
                <div className="space-y-3">
                  <label className="text-[10px] uppercase tracking-wide text-zinc-500">
                    My gamertag
                    <input
                      value={gamertag}
                      onChange={(e) => setGamertag(e.target.value)}
                      placeholder="Exact in-game name"
                      className="mt-1 w-full rounded-xl border border-primary/20 bg-black/50 px-3 py-2 text-sm text-white outline-none focus:border-primary"
                    />
                  </label>
                  <p className="text-xs leading-relaxed text-zinc-500">
                    Prefills from your hub account. Spawns at the latest logged position on 101x.{" "}
                    {playersQ.isFetching
                      ? "Refreshing roster…"
                      : matchedPlayer
                        ? `Online on ${matchedPlayer.server}${
                            Number.isFinite(matchedPlayer.x)
                              ? ` · Y ${Math.round(matchedPlayer.x!)} / Z ${Math.round(matchedPlayer.z!)}`
                              : " · waiting for coordinates"
                          }`
                        : "Not seen online yet."}
                  </p>
                  <motion.button
                    type="button"
                    disabled={!isOwned || spawning}
                    onClick={spawn}
                    className="relative w-full overflow-hidden rounded-full bg-primary px-4 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-primary-foreground disabled:opacity-40"
                    whileHover={!isOwned || spawning ? undefined : { scale: 1.02 }}
                    whileTap={!isOwned || spawning ? undefined : { scale: 0.97 }}
                  >
                    <span
                      className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-white/40 blur-sm"
                      style={{ animation: "warroom-shine 2.6s ease-in-out infinite" }}
                      aria-hidden
                    />
                    <span className="relative">{spawning ? "Deploying…" : "Spawn at my gamertag"}</span>
                  </motion.button>
                </div>
              )}
            </div>
          </motion.section>
        </div>
      </div>
    </div>
  );
}
