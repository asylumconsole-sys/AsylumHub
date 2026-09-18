import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

    let position = {
      x: Number(y),
      z: Number(z),
    };

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
    <div className="min-h-[calc(100vh-3rem)] bg-[#0a0a0b] px-4 py-8 text-zinc-100">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-zinc-500">
              <IconCampaign size={14} /> NPC Shop template
            </div>
            <h1 className="font-display mt-2 text-4xl text-white sm:text-5xl">Operators</h1>
            <p className="mt-2 max-w-xl text-sm text-zinc-400">
              Catalog is ready for more NPCs. Only The Beamer is listed for now.
            </p>
          </div>
          <div className="border border-white/10 bg-white/[0.03] px-4 py-3 text-right">
            <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Credits</div>
            <div className="mt-1 font-mono text-2xl text-white">{balanceQ.isLoading ? "…" : credits.toLocaleString()}</div>
            <div className="mt-1 max-w-[160px] truncate text-[10px] text-zinc-500">{displayName}</div>
          </div>
        </header>

        <div className="grid items-start gap-6 lg:grid-cols-[240px_minmax(0,1fr)_320px]">
          <aside className="space-y-2">
            <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Roster · {NPCS.length}</div>
            <div className="space-y-2">
              {NPCS.map((npc) => {
                const npcOwned = owned.includes(npc.id);
                const active = selected?.id === npc.id;
                return (
                  <button
                    key={npc.id}
                    type="button"
                    onClick={() => setSelectedId(npc.id)}
                    className={`w-full border px-3 py-3 text-left transition ${
                      active ? "border-white/40 bg-white/10" : "border-white/10 bg-white/[0.02] hover:border-white/25"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium text-white">{npc.name}</span>
                      <span className="font-mono text-[10px] text-zinc-400">{npc.price.toLocaleString()}</span>
                    </div>
                    <div className="mt-1 text-[10px] uppercase tracking-wide text-zinc-500">
                      {npc.role} · {npc.category}
                    </div>
                    {npcOwned ? <div className="mt-1 text-[10px] uppercase tracking-wide text-zinc-300">Owned</div> : null}
                  </button>
                );
              })}
            </div>
            <div className="border border-dashed border-white/10 px-3 py-4 text-center text-[11px] text-zinc-600">
              More NPCs slot here
            </div>
          </aside>

          <section className="border border-white/10 bg-white/[0.03]">
            {selected ? (
              <>
                <div className="flex h-48 items-center justify-center border-b border-white/10 bg-[#111113]">
                  <div className="text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center border border-white/20 text-zinc-400">
                      <IconBot size={26} />
                    </div>
                    <div className="mt-3 text-[10px] uppercase tracking-[0.24em] text-zinc-600">Image placeholder</div>
                  </div>
                </div>
                <div className="space-y-4 p-5">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Selected operator</div>
                    <h2 className="mt-1 font-display text-3xl text-white">{selected.name}</h2>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-400">{selected.description}</p>
                    <div className="mt-3 font-mono text-sm text-zinc-200">{selected.price.toLocaleString()} credits</div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[["Loadout", "M14 / M4"], ["Kit", "Armor + med"], ["Server", "101x"]].map(([label, value]) => (
                      <div key={label} className="border border-white/10 bg-black/40 px-3 py-2">
                        <div className="text-[10px] uppercase tracking-wide text-zinc-600">{label}</div>
                        <div className="mt-1 text-xs text-zinc-300">{value}</div>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => !isOwned && buyMut.mutate(selected)}
                    disabled={isOwned || buyMut.isPending}
                    className="w-full border border-white/25 bg-white px-4 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-zinc-800 disabled:text-zinc-500"
                  >
                    {isOwned
                      ? "Owned — ready to deploy"
                      : buyMut.isPending
                        ? "Purchasing…"
                        : `Buy · ${selected.price.toLocaleString()} cr`}
                  </button>
                </div>
              </>
            ) : (
              <div className="p-8 text-center text-sm text-zinc-500">Select an NPC from the roster.</div>
            )}
          </section>

          <section className="border border-white/10 bg-white/[0.03] p-5">
            <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Deploy · 101x</div>
            <div className="mt-4 space-y-2">
              {modes.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setPlacementMode(mode.id)}
                  className={`w-full border px-3 py-3 text-left transition ${
                    placementMode === mode.id
                      ? "border-white/35 bg-white/10"
                      : "border-white/10 hover:border-white/25"
                  }`}
                >
                  <div className="text-sm text-white">{mode.label}</div>
                  <div className="mt-0.5 text-xs text-zinc-500">{mode.detail}</div>
                </button>
              ))}
            </div>

            <div className="mt-5 border-t border-white/10 pt-5">
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
                    className="flex w-full items-center justify-center gap-2 border border-white/25 px-4 py-3 text-sm uppercase tracking-[0.12em] text-white transition hover:bg-white/5 disabled:opacity-40"
                  >
                    Choose on map <IconArrowRight size={14} />
                  </button>
                </div>
              )}

              {placementMode === "zy" && (
                <div className="space-y-3">
                  <p className="text-xs text-zinc-500">Y = east/west (X). Z = north/south.</p>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-[10px] uppercase tracking-wide text-zinc-500">
                      Y
                      <input
                        value={y}
                        onChange={(e) => setY(e.target.value)}
                        inputMode="numeric"
                        className="mt-1 w-full border border-white/10 bg-black px-3 py-2 font-mono text-sm text-white outline-none focus:border-white/30"
                      />
                    </label>
                    <label className="text-[10px] uppercase tracking-wide text-zinc-500">
                      Z
                      <input
                        value={z}
                        onChange={(e) => setZ(e.target.value)}
                        inputMode="numeric"
                        className="mt-1 w-full border border-white/10 bg-black px-3 py-2 font-mono text-sm text-white outline-none focus:border-white/30"
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    disabled={!isOwned || spawning}
                    onClick={spawn}
                    className="w-full border border-white/25 bg-white px-4 py-3 text-sm font-semibold uppercase tracking-[0.12em] text-black disabled:opacity-40"
                  >
                    {spawning ? "Deploying…" : "Deploy at Z / Y"}
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
                      className="mt-1 w-full border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none focus:border-white/30"
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
                    className="w-full border border-white/25 bg-white px-4 py-3 text-sm font-semibold uppercase tracking-[0.12em] text-black disabled:opacity-40"
                  >
                    {spawning ? "Deploying…" : "Spawn at my gamertag"}
                  </button>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
