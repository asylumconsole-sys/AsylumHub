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
/** Catalog capacity for the gold deploy bay. */
const ROSTER_SLOTS = 20;

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


/** Add more NPCs here — UI is built for up to ROSTER_SLOTS. */
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

const emptySlots = Math.max(0, ROSTER_SLOTS - NPCS.length);

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
    { id: "map", label: "1. Choose on map", detail: "Drop a pin on the map tool" },
    { id: "zy", label: "2. Z or Y", detail: "Enter DayZ world Y / Z" },
    { id: "gamertag", label: "3. Spawn at my gamertag", detail: "Use live player position" },
  ];

  return (
    <div className="relative min-h-[calc(100vh-3rem)] overflow-hidden bg-[#050505] px-3 py-6 text-zinc-100 sm:px-5">
      <style>{`
        @keyframes gold-scan { 0% { transform: translateY(-100%); } 100% { transform: translateY(120%); } }
        @keyframes gold-shine { 0% { transform: translateX(-140%) skewX(-18deg); } 100% { transform: translateX(240%) skewX(-18deg); } }
        @keyframes gold-pulse { 0%,100% { opacity: .35 } 50% { opacity: .7 } }
      `}</style>

      {/* Gold ambient only */}
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          backgroundImage:
            "radial-gradient(circle at 50% 0%, rgba(212,168,75,0.22), transparent 55%), radial-gradient(circle at 90% 80%, rgba(180,130,40,0.12), transparent 45%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            "linear-gradient(135deg, transparent 0%, transparent 48%, rgba(212,168,75,0.35) 49%, transparent 50%)",
          backgroundSize: "42px 42px",
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 h-36 opacity-[0.07]"
        style={{
          background: "linear-gradient(180deg, transparent, rgba(255,214,120,0.9), transparent)",
          animation: "gold-scan 7s linear infinite",
        }}
        aria-hidden
      />

      <div className="relative mx-auto max-w-7xl space-y-5">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[#d4a84b]/30 pb-4">
          <div>
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-[#d4a84b]">
              <IconCampaign size={14} /> {BRAND.name} · Gold bay
            </div>
            <h1 className="font-display mt-1 text-4xl text-[#e8c56a] sm:text-5xl">Operators</h1>
            <p className="mt-2 max-w-2xl text-sm text-zinc-400">
              Deploy bay for up to {ROSTER_SLOTS} operators. Only The Beamer is live — empty slots stay locked until you add more.
            </p>
          </div>
          <div className="rounded-xl border border-[#d4a84b]/40 bg-[#d4a84b]/10 px-4 py-3 text-right">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#d4a84b]/80">Credits</div>
            <div className="mt-1 font-mono text-2xl text-[#f5e6c0]">
              {balanceQ.isLoading ? "…" : credits.toLocaleString()}
            </div>
            <div className="mt-1 max-w-[160px] truncate text-[10px] text-zinc-500">{displayName}</div>
          </div>
        </header>

        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          {/* Dense roster — sized for 20 */}
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[10px] uppercase tracking-[0.22em] text-[#d4a84b]/80">
                Roster · {NPCS.length}/{ROSTER_SLOTS}
              </div>
              <div className="text-[10px] uppercase tracking-wide text-zinc-600">Tap a card to select</div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {NPCS.map((npc) => {
                const npcOwned = owned.includes(npc.id);
                const active = selected?.id === npc.id;
                return (
                  <button
                    key={npc.id}
                    type="button"
                    onClick={() => setSelectedId(npc.id)}
                    className={`group relative flex min-h-[132px] flex-col rounded-xl border p-3 text-left transition ${
                      active
                        ? "border-[#e8c56a] bg-[#d4a84b]/15 shadow-[0_0_28px_rgba(212,168,75,0.25)]"
                        : "border-[#d4a84b]/20 bg-black/40 hover:border-[#d4a84b]/45"
                    }`}
                  >
                    <div className="mb-2 flex h-12 items-center justify-center rounded-lg border border-[#d4a84b]/20 bg-[#0c0c0c]">
                      <span className="text-[#d4a84b]"><IconBot size={22} /></span>
                    </div>
                    <div className="line-clamp-1 text-sm font-medium text-[#f5e6c0]">{npc.name}</div>
                    <div className="mt-0.5 line-clamp-1 text-[10px] uppercase tracking-wide text-zinc-500">
                      {npc.role}
                    </div>
                    <div className="mt-auto flex items-center justify-between pt-2">
                      <span className="font-mono text-[11px] text-[#e8c56a]">{npc.price.toLocaleString()} cr</span>
                      {npcOwned ? (
                        <span className="text-[9px] uppercase tracking-wide text-[#d4a84b]">Owned</span>
                      ) : null}
                    </div>
                  </button>
                );
              })}

              {Array.from({ length: emptySlots }, (_, i) => (
                <div
                  key={`slot-${i}`}
                  className="flex min-h-[132px] flex-col items-center justify-center rounded-xl border border-dashed border-[#d4a84b]/15 bg-black/20 px-2 text-center"
                >
                  <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-600">Slot {NPCS.length + i + 1}</div>
                  <div className="mt-1 text-[11px] text-zinc-700">Locked</div>
                </div>
              ))}
            </div>

            {/* Selected detail strip */}
            {selected ? (
              <motion.div
                className="rounded-2xl border border-[#d4a84b]/30 bg-black/50 p-4 sm:p-5"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] uppercase tracking-[0.22em] text-[#d4a84b]">Selected</div>
                    <h2 className="font-display mt-1 text-3xl text-[#e8c56a]">{selected.name}</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">{selected.description}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {[
                        ["Loadout", "M14 / M4"],
                        ["Kit", "Armor + med"],
                        ["Server", "101x"],
                        ["Price", `${selected.price.toLocaleString()} cr`],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-lg border border-[#d4a84b]/20 bg-[#0a0a0a] px-3 py-1.5">
                          <div className="text-[9px] uppercase tracking-wide text-[#d4a84b]/70">{label}</div>
                          <div className="text-xs text-zinc-300">{value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <motion.button
                    type="button"
                    onClick={() => !isOwned && buyMut.mutate(selected)}
                    disabled={isOwned || buyMut.isPending}
                    className="relative min-w-[180px] overflow-hidden rounded-full bg-[#d4a84b] px-5 py-3 text-sm font-semibold uppercase tracking-[0.16em] text-[#1a1205] disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
                    whileHover={isOwned || buyMut.isPending ? undefined : { scale: 1.03, boxShadow: "0 0 36px rgba(212,168,75,0.45)" }}
                    whileTap={isOwned || buyMut.isPending ? undefined : { scale: 0.97 }}
                  >
                    <span
                      className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-white/35 blur-sm"
                      style={{ animation: "gold-shine 2.8s ease-in-out infinite" }}
                      aria-hidden
                    />
                    <span className="relative">
                      {isOwned
                        ? "Owned"
                        : buyMut.isPending
                          ? "Purchasing…"
                          : `Buy · ${selected.price.toLocaleString()} cr`}
                    </span>
                  </motion.button>
                </div>
              </motion.div>
            ) : null}
          </section>

          {/* Deploy column */}
          <aside className="xl:sticky xl:top-4">
            <div className="rounded-2xl border border-[#d4a84b]/30 bg-black/50 p-4">
              <div className="text-[10px] uppercase tracking-[0.22em] text-[#d4a84b]">Deploy · 101x</div>
              <div className="mt-3 space-y-2">
                {modes.map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setPlacementMode(mode.id)}
                    className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${
                      placementMode === mode.id
                        ? "border-[#e8c56a] bg-[#d4a84b]/15"
                        : "border-[#d4a84b]/20 hover:border-[#d4a84b]/40"
                    }`}
                  >
                    <div className="text-sm text-[#f5e6c0]">{mode.label}</div>
                    <div className="mt-0.5 text-xs text-zinc-500">{mode.detail}</div>
                  </button>
                ))}
              </div>

              <div className="mt-4 border-t border-[#d4a84b]/20 pt-4">
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
                      className="flex w-full items-center justify-center gap-2 rounded-full border border-[#d4a84b]/50 px-4 py-2.5 text-sm uppercase tracking-[0.14em] text-[#e8c56a] transition hover:bg-[#d4a84b]/10 disabled:opacity-40"
                    >
                      Choose on map <IconArrowRight size={14} />
                    </button>
                  </div>
                )}

                {placementMode === "zy" && (
                  <div className="space-y-3">
                    <p className="text-xs text-zinc-500">
                      <span className="text-[#d4a84b]">Y</span> = east/west (X).{" "}
                      <span className="text-[#d4a84b]">Z</span> = north/south.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-[10px] uppercase tracking-wide text-zinc-500">
                        Y
                        <input
                          value={y}
                          onChange={(e) => setY(e.target.value)}
                          inputMode="numeric"
                          className="mt-1 w-full rounded-lg border border-[#d4a84b]/25 bg-black px-3 py-2 font-mono text-sm text-[#f5e6c0] outline-none focus:border-[#d4a84b]"
                        />
                      </label>
                      <label className="text-[10px] uppercase tracking-wide text-zinc-500">
                        Z
                        <input
                          value={z}
                          onChange={(e) => setZ(e.target.value)}
                          inputMode="numeric"
                          className="mt-1 w-full rounded-lg border border-[#d4a84b]/25 bg-black px-3 py-2 font-mono text-sm text-[#f5e6c0] outline-none focus:border-[#d4a84b]"
                        />
                      </label>
                    </div>
                    <button
                      type="button"
                      disabled={!isOwned || spawning}
                      onClick={spawn}
                      className="relative w-full overflow-hidden rounded-full bg-[#d4a84b] px-4 py-2.5 text-sm font-semibold uppercase tracking-[0.14em] text-[#1a1205] disabled:opacity-40"
                    >
                      <span
                        className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-white/35 blur-sm"
                        style={{ animation: "gold-shine 2.8s ease-in-out infinite" }}
                        aria-hidden
                      />
                      <span className="relative">{spawning ? "Deploying…" : "Deploy at Z / Y"}</span>
                    </button>
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
                        className="mt-1 w-full rounded-lg border border-[#d4a84b]/25 bg-black px-3 py-2 text-sm text-[#f5e6c0] outline-none focus:border-[#d4a84b]"
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
                    <button
                      type="button"
                      disabled={!isOwned || spawning}
                      onClick={spawn}
                      className="relative w-full overflow-hidden rounded-full bg-[#d4a84b] px-4 py-2.5 text-sm font-semibold uppercase tracking-[0.14em] text-[#1a1205] disabled:opacity-40"
                    >
                      <span
                        className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-white/35 blur-sm"
                        style={{ animation: "gold-shine 2.8s ease-in-out infinite" }}
                        aria-hidden
                      />
                      <span className="relative">{spawning ? "Deploying…" : "Spawn at my gamertag"}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
