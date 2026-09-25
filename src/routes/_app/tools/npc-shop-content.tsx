import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { IconArrowRight, IconBot, IconCampaign } from "@/components/ui-custom/CustomIcon";
import { toast } from "sonner";
import { DAYZ_SERVERS } from "@/lib/dayz/servers";
import { listAsylumServiceIds } from "@/lib/dayz/server-status.functions";
import { getEconomyBalance, getNpcInventory, purchaseNpc } from "@/lib/economy.functions";
import { getMyLinkedPlayernames } from "@/lib/account-links.functions";
import { useAuth } from "@/contexts/AuthContext";
import { getOnlinePlayers } from "@/lib/online-players.functions";
import { BRAND } from "@/lib/brand";
import { SPAWN_PACKS, type SpawnPack } from "@/lib/npc/spawn-packs";
import { NpcInventoryModal } from "@/lib/npc/beamer-inventory-modal";
import { NPCS, loadoutFor, type ShopNpc } from "@/lib/npc/roster";
import { NpcBuilder } from "@/components/tools/NpcBuilder";

const PRIMARY_SERVER_ID = "101x";
const DEFAULT_SPAWN_POSITION = { x: 7500, z: 7500, a: 0 };
const ROSTER_SLOTS = 20;

type PlacementMode = "map" | "zy" | "gamertag";

export function NPCShopContent({ startOnBuilder = false }: { startOnBuilder?: boolean }) {
  const { session, user } = useAuth();
  const qc = useQueryClient();
  const [shopTab, setShopTab] = useState<"shop" | "builder">(startOnBuilder ? "builder" : "shop");
  const [selectedId, setSelectedId] = useState(NPCS[0]?.id ?? "");
  const selected = NPCS.find((npc) => npc.id === selectedId) ?? NPCS[0];
  const [placementMode, setPlacementMode] = useState<PlacementMode>("gamertag");
  const [y, setY] = useState(String(DEFAULT_SPAWN_POSITION.x));
  const [z, setZ] = useState(String(DEFAULT_SPAWN_POSITION.z));
  const [gamertag, setGamertag] = useState("");
  const [spawning, setSpawning] = useState(false);
  const [waveCount, setWaveCount] = useState(1);
  const [packId, setPackId] = useState(SPAWN_PACKS[0]?.id ?? "pack_15");
  const [invOpen, setInvOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const selectedPack: SpawnPack = SPAWN_PACKS.find((p) => p.id === packId) ?? SPAWN_PACKS[0];
  const selectedLoadout = selected ? loadoutFor(selected.id) : null;

  const playerId = user?.id || "demo-user";
  const displayName =
    (typeof user?.user_metadata?.name === "string" && user.user_metadata.name) ||
    user?.email ||
    playerId;

  const linksQ = useQuery({
    queryKey: ["linked-playernames", playerId],
    queryFn: () => getMyLinkedPlayernames(),
  });

  useEffect(() => {
    const linked = linksQ.data?.psn?.trim();
    if (linked) setGamertag(linked);
  }, [linksQ.data?.psn]);

  useEffect(() => {
    if (startOnBuilder) setShopTab("builder");
  }, [startOnBuilder]);

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
    refetchInterval: 15_000,
  });

  const credits = balanceQ.data?.balance ?? 0;
  const chargesMap = ownedQ.data?.charges ?? {};
  const chargesLeft = selected ? (chargesMap[selected.id] ?? 0) : 0;
  const canDeploy = chargesLeft > 0;
  const thisRestart = Math.max(1, Math.min(chargesLeft || 1, Number(waveCount) || 1));

  useEffect(() => {
    if (chargesLeft > 0) setWaveCount((n) => Math.max(1, Math.min(chargesLeft, n || chargesLeft)));
  }, [chargesLeft]);

  const server = DAYZ_SERVERS.find((s) => s.id === PRIMARY_SERVER_ID) ?? DAYZ_SERVERS[0];
  const serviceId =
    catalogQ.data?.find((s) => s.id === PRIMARY_SERVER_ID)?.serviceId ?? server.fallbackServiceId;

  const matchedPlayer = useMemo(() => {
    const target = gamertag.trim().toLocaleLowerCase();
    if (!target) return null;
    return playersQ.data?.players.find((entry) => entry.name.toLocaleLowerCase() === target) ?? null;
  }, [gamertag, playersQ.data?.players]);

  const buyMut = useMutation({
    mutationFn: (npc: ShopNpc) =>
      purchaseNpc({
        data: {
          playerId,
          displayName,
          npcId: npc.id,
          npcName: npc.name,
          price: selectedPack.price,
          spawns: selectedPack.spawns,
        },
      }),
    onSuccess: (res, npc) => {
      toast.success(`${npc.name} · +${res.spawnsAdded} charges`);
      qc.invalidateQueries({ queryKey: ["economy-balance", playerId] });
      qc.invalidateQueries({ queryKey: ["npc-inventory", playerId] });
      setWaveCount(res.spawnsAdded || selectedPack.spawns);
      setCheckoutOpen(true);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Purchase failed"),
  });

  const spawn = async () => {
    if (!selected) return;
    if (!canDeploy) return toast.error(`No charges left — buy a pack first`);
    let position = { x: Number(y), z: Number(z) };
    if (placementMode === "gamertag") {
      if (!gamertag.trim()) return toast.error("No linked PSN tag");
      if (matchedPlayer && Number.isFinite(matchedPlayer.x) && Number.isFinite(matchedPlayer.z)) {
        position = { x: matchedPlayer.x as number, z: matchedPlayer.z as number };
      }
    }
    if (placementMode === "zy") {
      if (!Number.isFinite(position.x) || !Number.isFinite(position.z) || position.x < 0 || position.z < 0) {
        return toast.error("Enter valid Y and Z");
      }
    }
    setSpawning(true);
    try {
      const res = await fetch("/api/npc/spawn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId,
          serverId: PRIMARY_SERVER_ID,
          npcId: selected.id,
          npcName: selected.name,
          x: Math.round(position.x),
          z: Math.round(position.z),
          a: 0,
          playerId,
          playerName: displayName,
          count: thisRestart,
        }),
      });
      const result = (await res.json()) as { error?: string; reason?: string };
      if (!res.ok || result.error) throw new Error(result.error || "Deploy failed");
      toast.success(
        thisRestart === 1
          ? `${selected.name} queued — 1 lands after the next restart.`
          : `${selected.name}: 1 lands after restart. After it is buried, the next one appears ~30s later until all ${thisRestart} uses are spent.`,
      );
      setCheckoutOpen(false);
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
    { id: "gamertag", label: "3. Spawn at my PSN", detail: linksQ.data?.psn ? `Linked: ${linksQ.data.psn}` : "Uses your linked PSN tag" },
  ];

  return (
    <div className="relative min-h-[calc(100vh-3rem)] overflow-hidden bg-[#050505] px-3 py-6 text-zinc-100 sm:px-5">
      <div className="relative mx-auto max-w-7xl space-y-5">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[#d4a84b]/30 pb-4">
          <div>
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-[#d4a84b]">
              <IconCampaign size={14} /> {BRAND.name} · Gold bay
            </div>
            <h1 className="font-display mt-1 text-4xl text-[#e8c56a] sm:text-5xl">{startOnBuilder ? "NPC Maker" : "Operators"}</h1>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => setShopTab("shop")} className={`rounded-full border px-4 py-1.5 text-[11px] uppercase tracking-[0.18em] ${shopTab === "shop" ? "border-[#d4a84b] text-[#e8c56a]" : "border-white/10 text-zinc-500"}`}>Shop</button>
              <button type="button" onClick={() => setShopTab("builder")} className={`rounded-full border px-4 py-1.5 text-[11px] uppercase tracking-[0.18em] ${shopTab === "builder" ? "border-[#d4a84b] text-[#e8c56a]" : "border-white/10 text-zinc-500"}`}>NPC Builder</button>
            </div>
          </div>
          <div className="rounded-xl border border-[#d4a84b]/40 bg-[#d4a84b]/10 px-4 py-3 text-right">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#d4a84b]/80">Credits</div>
            <div className="mt-1 font-mono text-2xl text-[#f5e6c0]">{balanceQ.isLoading ? "…" : credits.toLocaleString()}</div>
          </div>
        </header>
        {shopTab === "builder" ? (
          <NpcBuilder />
        ) : (
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <section className="space-y-4">
            <div className="text-[10px] uppercase tracking-[0.22em] text-[#d4a84b]/80">Roster · {NPCS.length}/{ROSTER_SLOTS}</div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {NPCS.map((npc) => {
                const left = chargesMap[npc.id] ?? 0;
                const active = selected?.id === npc.id;
                return (
                  <button key={npc.id} type="button" onClick={() => { setSelectedId(npc.id); setCheckoutOpen(left > 0); }} className={`group relative flex min-h-[132px] flex-col rounded-xl border p-3 text-left transition ${active ? "border-[#e8c56a] bg-[#d4a84b]/15" : "border-[#d4a84b]/20 bg-black/40 hover:border-[#d4a84b]/45"}`}>
                    <div className="mb-2 flex h-12 items-center justify-center rounded-lg border border-[#d4a84b]/20 bg-[#0c0c0c]"><span className="text-[#d4a84b]"><IconBot size={22} /></span></div>
                    <div className="line-clamp-1 text-sm font-medium text-[#f5e6c0]">{npc.name}</div>
                    <div className="mt-0.5 line-clamp-1 text-[10px] uppercase tracking-wide text-zinc-500">{npc.role}</div>
                    <div className="mt-auto flex items-center justify-between pt-2"><span className="font-mono text-[11px] text-[#e8c56a]">{left} left</span></div>
                  </button>
                );
              })}
            </div>
            {selected ? (
              <motion.div className="rounded-2xl border border-[#d4a84b]/30 bg-black/50 p-4 sm:p-5" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#d4a84b]">1 · Buy charges</div>
                <h2 className="font-display mt-1 text-3xl text-[#e8c56a]">{selected.name}</h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">{selected.description}</p>
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  {SPAWN_PACKS.map((pack) => (
                    <button key={pack.id} type="button" onClick={() => setPackId(pack.id)} className={`rounded-xl border px-3 py-3 text-left ${packId === pack.id ? "border-[#e8c56a] bg-[#d4a84b]/15" : "border-[#d4a84b]/20"}`}>
                      <div className="text-sm text-[#f5e6c0]">{pack.label}</div>
                      <div className="font-mono text-lg text-[#e8c56a]">{pack.spawns} uses</div>
                      <div className="text-[11px] text-zinc-500">{pack.price.toLocaleString()} cr</div>
                    </button>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <motion.button type="button" onClick={() => buyMut.mutate(selected)} disabled={buyMut.isPending || credits < selectedPack.price} className="rounded-full bg-[#d4a84b] px-5 py-3 text-sm font-semibold uppercase tracking-[0.16em] text-[#1a1205] disabled:bg-zinc-700 disabled:text-zinc-400">
                    {buyMut.isPending ? "Purchasing…" : `Buy ${selectedPack.spawns} · ${selectedPack.price.toLocaleString()} cr`}
                  </motion.button>
                  {selectedLoadout ? (
                    <button type="button" onClick={() => setInvOpen(true)} className="rounded-full border border-[#d4a84b]/40 px-4 py-2 text-xs uppercase tracking-[0.14em] text-[#e8c56a]">View inventory</button>
                  ) : null}
                  <span className="text-[11px] text-zinc-500">{chargesLeft} charges on this operator</span>
                </div>
              </motion.div>
            ) : null}
          </section>
          <aside className="xl:sticky xl:top-4 space-y-3">
            <div className="rounded-2xl border border-[#d4a84b]/30 bg-black/50 p-4">
              <div className="text-[10px] uppercase tracking-[0.22em] text-[#d4a84b]">2 · Checkout · this restart</div>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                After you buy, pick how many of those uses land on the <span className="text-[#e8c56a]">next restart</span>.
                If you have 15, you can schedule all 15 in one restart.
              </p>
              <p className="mt-2 text-sm leading-relaxed text-[#f5e6c0]">
                They do not all drop at once. <strong>1 NPC</strong> appears after the restart. When that body is <strong>buried</strong>, the next one spawns about <strong>30 seconds</strong> later. That repeats until every selected use is spent.
              </p>
              <label className="mt-4 block text-[10px] uppercase tracking-wide text-[#e8c56a]">
                How many this restart (max {chargesLeft || 0})
                <input
                  type="number"
                  min={1}
                  max={Math.max(1, chargesLeft)}
                  value={thisRestart}
                  disabled={!canDeploy}
                  onChange={(e) => setWaveCount(Math.max(1, Math.min(chargesLeft || 1, Number(e.target.value) || 1)))}
                  className="mt-1 w-full rounded-lg border border-[#d4a84b]/40 bg-black px-3 py-3 font-mono text-xl text-[#f5e6c0] outline-none disabled:opacity-40"
                />
              </label>
              <div className="mt-2 text-[11px] text-zinc-500">
                {canDeploy
                  ? `1 now after restart · then ${Math.max(0, thisRestart - 1)} more, 30s after each bury`
                  : "Buy a pack first to open checkout"}
              </div>
            </div>
            <div className="rounded-2xl border border-[#d4a84b]/30 bg-black/50 p-4">
              <div className="text-[10px] uppercase tracking-[0.22em] text-[#d4a84b]">3 · Where · 101x</div>
              <div className="mt-3 space-y-2">
                {modes.map((mode) => (
                  <button key={mode.id} type="button" onClick={() => setPlacementMode(mode.id)} className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${placementMode === mode.id ? "border-[#e8c56a] bg-[#d4a84b]/15" : "border-[#d4a84b]/20 hover:border-[#d4a84b]/40"}`}>
                    <div className="text-sm text-[#f5e6c0]">{mode.label}</div>
                    <div className="mt-0.5 text-xs text-zinc-500">{mode.detail}</div>
                  </button>
                ))}
              </div>
              <div className="mt-4 border-t border-[#d4a84b]/20 pt-4 space-y-3">
                {placementMode === "map" && (
                  <button type="button" disabled={!canDeploy || !selected} onClick={() => selected && window.open(`/tools/npc-map-clicker?npcId=${encodeURIComponent(selected.id)}&count=${thisRestart}`, "_blank", "noopener,noreferrer")} className="flex w-full items-center justify-center gap-2 rounded-full border border-[#d4a84b]/50 px-4 py-2.5 text-sm uppercase tracking-[0.14em] text-[#e8c56a] disabled:opacity-40">Choose on map <IconArrowRight size={14} /></button>
                )}
                {placementMode === "zy" && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-[10px] uppercase tracking-wide text-zinc-500">Y<input value={y} onChange={(e) => setY(e.target.value)} inputMode="numeric" className="mt-1 w-full rounded-lg border border-[#d4a84b]/25 bg-black px-3 py-2 font-mono text-sm text-[#f5e6c0] outline-none" /></label>
                      <label className="text-[10px] uppercase tracking-wide text-zinc-500">Z<input value={z} onChange={(e) => setZ(e.target.value)} inputMode="numeric" className="mt-1 w-full rounded-lg border border-[#d4a84b]/25 bg-black px-3 py-2 font-mono text-sm text-[#f5e6c0] outline-none" /></label>
                    </div>
                    <button type="button" disabled={!canDeploy || spawning} onClick={spawn} className="w-full rounded-full bg-[#d4a84b] px-4 py-2.5 text-sm font-semibold uppercase tracking-[0.14em] text-[#1a1205] disabled:opacity-40">{spawning ? "Queueing…" : `Queue ${thisRestart} after restart`}</button>
                  </div>
                )}
                {placementMode === "gamertag" && (
                  <div className="space-y-3">
                    <div className="rounded-lg border border-[#d4a84b]/25 bg-black px-3 py-2 text-sm text-[#f5e6c0]">{linksQ.isLoading ? "Loading linked PSN…" : gamertag || "No PSN linked"}</div>
                    <button type="button" disabled={!canDeploy || spawning || !gamertag} onClick={spawn} className="w-full rounded-full bg-[#d4a84b] px-4 py-2.5 text-sm font-semibold uppercase tracking-[0.14em] text-[#1a1205] disabled:opacity-40">{spawning ? "Queueing…" : `Queue ${thisRestart} at linked PSN`}</button>
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
        )}
      </div>
      {invOpen && selected && selectedLoadout ? (
        <NpcInventoryModal title={`${selected.name} loadout`} loadout={selectedLoadout} onClose={() => setInvOpen(false)} />
      ) : null}
      {checkoutOpen && canDeploy && selected ? (
        <div className="pointer-events-none fixed bottom-4 left-1/2 z-30 w-[min(92vw,420px)] -translate-x-1/2">
          <div className="pointer-events-auto rounded-2xl border border-[#d4a84b]/50 bg-[#0a0a0a] p-4 shadow-[0_0_40px_rgba(212,168,75,0.2)]">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#d4a84b]">Checkout</div>
            <div className="mt-1 text-sm text-[#f5e6c0]">{selected.name} · {chargesLeft} uses owned</div>
            <div className="mt-1 text-xs text-zinc-400">Scheduling {thisRestart} for the next restart. 1 appears first. Bury it — next one in ~30s — until {thisRestart} are used.</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
