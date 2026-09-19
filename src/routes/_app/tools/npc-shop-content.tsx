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
import { SPAWN_PACKS, type SpawnPack } from "@/lib/npc/spawn-packs";
import { THE_BEAMER_CFG_SPAWNABLETYPES } from "@/lib/npc/the-beamer-cfg";
import { BeamerInventoryModal } from "@/lib/npc/beamer-inventory-modal";

const PRIMARY_SERVER_ID = "101x";
const DEFAULT_SPAWN_POSITION = { x: 7500, z: 7500, a: 0 };
const ROSTER_SLOTS = 20;

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
  const [packId, setPackId] = useState(SPAWN_PACKS[1]?.id ?? SPAWN_PACKS[0].id);
  const [invOpen, setInvOpen] = useState(false);
  const selectedPack: SpawnPack = SPAWN_PACKS.find((p) => p.id === packId) ?? SPAWN_PACKS[1] ?? SPAWN_PACKS[0];

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
    queryFn: () => getEconomyBalance({ data: { playerId } }),
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
  const chargesMap = ownedQ.data?.charges ?? {};
  const chargesLeft = selected ? (chargesMap[selected.id] ?? 0) : 0;
  const canDeploy = chargesLeft > 0;
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
          price: selectedPack.price,
          spawns: selectedPack.spawns,
        },
      }),
    onSuccess: (res, npc) => {
      toast.success(`${npc.name} \u00b7 ${selectedPack.label} +${res.spawnsAdded} charges`);
      qc.invalidateQueries({ queryKey: ["economy-balance", playerId] });
      qc.invalidateQueries({ queryKey: ["npc-inventory", playerId] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Purchase failed"),
  });

  const spawn = async () => {
    if (!selected) return;
    if (!canDeploy) return toast.error(`No charges left \u2014 buy a pack for ${selected.name}`);
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
          description: `Via ${result.adapter} \u00b7 Y ${Math.round(position.x)} / Z ${Math.round(position.z)}`,
        });
      } else {
        toast.warning("Live spawn unavailable", { description: result.reason });
        toast.success(`${selected.name} queued on ${server.label}`, {
          description: !result.restarted
            ? "Already loaded on the server \u2014 CE is managing it."
            : result.restockSeconds > 0
              ? `Set to Y ${Math.round(position.x)} / Z ${Math.round(position.z)}. Restarting, then respawns every ${result.restockSeconds}s.`
              : `Set to Y ${Math.round(position.x)} / Z ${Math.round(position.z)}. Server restarting to load it.`,
        });
      }
      qc.invalidateQueries({ queryKey: ["npc-inventory", playerId] });
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
      <div className="relative mx-auto max-w-7xl space-y-5">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[#d4a84b]/30 pb-4">
          <div>
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-[#d4a84b]">
              <IconCampaign size={14} /> {BRAND.name} \u00b7 Gold bay
            </div>
            <h1 className="font-display mt-1 text-4xl text-[#e8c56a] sm:text-5xl">Operators</h1>
            <p className="mt-2 max-w-2xl text-sm text-zinc-400">
              Buy consumable spawn packs, then deploy. One charge burns per successful spawn. Only The Beamer is live.
            </p>
          </div>
          <div className="rounded-xl border border-[#d4a84b]/40 bg-[#d4a84b]/10 px-4 py-3 text-right">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#d4a84b]/80">Credits</div>
            <div className="mt-1 font-mono text-2xl text-[#f5e6c0]">
              {balanceQ.isLoading ? "\u2026" : credits.toLocaleString()}
            </div>
            <div className="mt-1 max-w-[160px] truncate text-[10px] text-zinc-500">{displayName}</div>
          </div>
        </header>
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <section className="space-y-4">
            <div className="text-[10px] uppercase tracking-[0.22em] text-[#d4a84b]/80">Roster \u00b7 {NPCS.length}/{ROSTER_SLOTS}</div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {NPCS.map((npc) => {
                const left = chargesMap[npc.id] ?? 0;
                const active = selected?.id === npc.id;
                return (
                  <button key={npc.id} type="button" onClick={() => setSelectedId(npc.id)} className={`group relative flex min-h-[132px] flex-col rounded-xl border p-3 text-left transition ${active ? "border-[#e8c56a] bg-[#d4a84b]/15" : "border-[#d4a84b]/20 bg-black/40 hover:border-[#d4a84b]/45"}`}>
                    <div className="mb-2 flex h-12 items-center justify-center rounded-lg border border-[#d4a84b]/20 bg-[#0c0c0c]"><span className="text-[#d4a84b]"><IconBot size={22} /></span></div>
                    <div className="line-clamp-1 text-sm font-medium text-[#f5e6c0]">{npc.name}</div>
                    <div className="mt-0.5 line-clamp-1 text-[10px] uppercase tracking-wide text-zinc-500">{npc.role}</div>
                    <div className="mt-auto flex items-center justify-between pt-2">
                      <span className="font-mono text-[11px] text-[#e8c56a]">{left} left</span>
                      {left > 0 ? <span className="text-[9px] uppercase tracking-wide text-[#d4a84b]">{left} charges</span> : <span className="text-[9px] uppercase tracking-wide text-zinc-600">No pack</span>}
                    </div>
                  </button>
                );
              })}
              {Array.from({ length: emptySlots }, (_, i) => (
                <div key={`slot-${i}`} className="flex min-h-[132px] flex-col items-center justify-center rounded-xl border border-dashed border-[#d4a84b]/15 bg-black/20 px-2 text-center">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-600">Slot {NPCS.length + i + 1}</div>
                  <div className="mt-1 text-[11px] text-zinc-700">Locked</div>
                </div>
              ))}
            </div>
            {selected ? (
              <motion.div className="rounded-2xl border border-[#d4a84b]/30 bg-black/50 p-4 sm:p-5" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] uppercase tracking-[0.22em] text-[#d4a84b]">Selected</div>
                    <h2 className="font-display mt-1 text-3xl text-[#e8c56a]">{selected.name}</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">{selected.description}</p>
                  </div>
                  <div className="flex min-w-[220px] flex-col gap-2">
                    <div className="grid grid-cols-2 gap-1.5">
                      {SPAWN_PACKS.map((pack) => (
                        <button key={pack.id} type="button" onClick={() => setPackId(pack.id)} className={`rounded-lg border px-2 py-1.5 text-left ${selectedPack.id === pack.id ? "border-[#e8c56a] bg-[#d4a84b]/20" : "border-[#d4a84b]/20 hover:border-[#d4a84b]/40"}`}>
                          <div className="text-[10px] uppercase tracking-wide text-[#e8c56a]">{pack.label}</div>
                          <div className="font-mono text-[11px] text-zinc-300">{pack.price.toLocaleString()} \u00b7 {pack.spawns}</div>
                        </button>
                      ))}
                    </div>
                    <motion.button type="button" onClick={() => buyMut.mutate(selected)} disabled={buyMut.isPending || credits < selectedPack.price} className="relative min-w-[180px] overflow-hidden rounded-full bg-[#d4a84b] px-5 py-3 text-sm font-semibold uppercase tracking-[0.16em] text-[#1a1205] disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400">
                      <span className="relative">{buyMut.isPending ? "Purchasing\u2026" : `Buy ${selectedPack.label} \u00b7 ${selectedPack.price.toLocaleString()} cr`}</span>
                    </motion.button>
                    {selected.id === "the_beamer" ? (
                      <button type="button" onClick={() => setInvOpen(true)} className="rounded-full border border-[#d4a84b]/40 px-4 py-2 text-xs uppercase tracking-[0.14em] text-[#e8c56a] hover:bg-[#d4a84b]/10">View inventory</button>
                    ) : null}
                    <div className="text-center text-[11px] text-zinc-500">{chargesLeft} charges left</div>
                  </div>
                </div>
              </motion.div>
            ) : null}
          </section>
          <aside className="xl:sticky xl:top-4">
            <div className="rounded-2xl border border-[#d4a84b]/30 bg-black/50 p-4">
              <div className="text-[10px] uppercase tracking-[0.22em] text-[#d4a84b]">Deploy \u00b7 101x</div>
              <div className="mt-3 space-y-2">
                {modes.map((mode) => (
                  <button key={mode.id} type="button" onClick={() => setPlacementMode(mode.id)} className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${placementMode === mode.id ? "border-[#e8c56a] bg-[#d4a84b]/15" : "border-[#d4a84b]/20 hover:border-[#d4a84b]/40"}`}>
                    <div className="text-sm text-[#f5e6c0]">{mode.label}</div>
                    <div className="mt-0.5 text-xs text-zinc-500">{mode.detail}</div>
                  </button>
                ))}
              </div>
              <div className="mt-4 border-t border-[#d4a84b]/20 pt-4">
                {placementMode === "map" && (
                  <div className="space-y-3">
                    <p className="text-xs text-zinc-500">Opens the map tool so you can pick coordinates.</p>
                    <button type="button" disabled={!canDeploy || !selected} onClick={() => selected && window.open(`/tools/npc-map-clicker?npcId=${encodeURIComponent(selected.id)}`, "_blank", "noopener,noreferrer")} className="flex w-full items-center justify-center gap-2 rounded-full border border-[#d4a84b]/50 px-4 py-2.5 text-sm uppercase tracking-[0.14em] text-[#e8c56a] transition hover:bg-[#d4a84b]/10 disabled:opacity-40">Choose on map <IconArrowRight size={14} /></button>
                  </div>
                )}
                {placementMode === "zy" && (
                  <div className="space-y-3">
                    <p className="text-xs text-zinc-500"><span className="text-[#d4a84b]">Y</span> = east/west (X). <span className="text-[#d4a84b]">Z</span> = north/south.</p>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-[10px] uppercase tracking-wide text-zinc-500">Y<input value={y} onChange={(e) => setY(e.target.value)} inputMode="numeric" className="mt-1 w-full rounded-lg border border-[#d4a84b]/25 bg-black px-3 py-2 font-mono text-sm text-[#f5e6c0] outline-none focus:border-[#d4a84b]" /></label>
                      <label className="text-[10px] uppercase tracking-wide text-zinc-500">Z<input value={z} onChange={(e) => setZ(e.target.value)} inputMode="numeric" className="mt-1 w-full rounded-lg border border-[#d4a84b]/25 bg-black px-3 py-2 font-mono text-sm text-[#f5e6c0] outline-none focus:border-[#d4a84b]" /></label>
                    </div>
                    <button type="button" disabled={!canDeploy || spawning} onClick={spawn} className="relative w-full overflow-hidden rounded-full bg-[#d4a84b] px-4 py-2.5 text-sm font-semibold uppercase tracking-[0.14em] text-[#1a1205] disabled:opacity-40"><span className="relative">{spawning ? "Deploying\u2026" : "Deploy at Z / Y"}</span></button>
                  </div>
                )}
                {placementMode === "gamertag" && (
                  <div className="space-y-3">
                    <label className="text-[10px] uppercase tracking-wide text-zinc-500">My gamertag<input value={gamertag} onChange={(e) => setGamertag(e.target.value)} placeholder="Exact in-game name" className="mt-1 w-full rounded-lg border border-[#d4a84b]/25 bg-black px-3 py-2 text-sm text-[#f5e6c0] outline-none focus:border-[#d4a84b]" /></label>
                    <p className="text-xs leading-relaxed text-zinc-500">Prefills from your hub account. Spawns at the latest logged position on 101x.</p>
                    <button type="button" disabled={!canDeploy || spawning} onClick={spawn} className="relative w-full overflow-hidden rounded-full bg-[#d4a84b] px-4 py-2.5 text-sm font-semibold uppercase tracking-[0.14em] text-[#1a1205] disabled:opacity-40"><span className="relative">{spawning ? "Deploying\u2026" : "Spawn at my gamertag"}</span></button>
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>
      {invOpen && selected?.id === "the_beamer" ? (
        <BeamerInventoryModal onClose={() => setInvOpen(false)} />
      ) : null}
    </div>
  );
}
