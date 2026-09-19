import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { GlassPanel } from "@/components/ui-custom/GlassPanel";
import { Button } from "@/components/ui/button";
import { DAYZ_SERVERS, resolveServiceId } from "@/lib/dayz/servers";
import { DAYZ_MAPS, mapIdForServer, mapPositionToGame } from "@/lib/dayz/map-tiles";
import { postNpcSpawn } from "@/lib/npc/spawn-client";
import { toast } from "sonner";

const NpcSpawnMap = lazy(() => import("@/components/tools/NpcSpawnMap"));

export const Route = createFileRoute("/_app/tools/npc-map-clicker")({
  component: NPCMapClickerPage,
  validateSearch: (s: Record<string, unknown>) => ({
    npcId: typeof s.npcId === "string" && s.npcId ? s.npcId : "the_beamer",
  }),
});

function NPCMapClickerPage() {
  const { npcId } = Route.useSearch();
  const nav = useNavigate();
  const { user } = useAuth();
  const [pos, setPos] = useState<{ x: number; z: number; lat: number; lng: number } | null>(null);
  const serverId = "101x";
  const [busy, setBusy] = useState(false);
  const [leafletReady, setLeafletReady] = useState(false);

  useEffect(() => {
    setLeafletReady(true);
  }, []);

  const server = DAYZ_SERVERS.find((s) => s.id === serverId) ?? DAYZ_SERVERS[0];
  const serviceId = resolveServiceId(server);

  const queue = async () => {
    if (!pos) return toast.error("Tap the map to choose a spawn point");
    setBusy(true);
    try {
      const result = await postNpcSpawn({
        serviceId,
        serverId,
        npcId,
        x: pos.x,
        z: pos.z,
        a: 0,
        playerId: user?.id,
        playerName: typeof user?.user_metadata?.name === "string" ? user.user_metadata.name : user?.id,
      });
      if (result.mode === "live") {
        toast.success(`Live spawn via ${result.adapter}`, { description: result.entity });
      } else {
        toast.message("Queued — server restart required", {
          description: `${result.eventName} · ${result.reason}`,
        });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Spawn failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-3 pb-8 pt-2 sm:px-4 sm:py-8">
      <div className="mb-3 pr-14 sm:pr-0">
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">NPC map</div>
        <h1 className="font-display text-2xl leading-tight sm:text-3xl">Place {npcId.replaceAll("_", " ")}</h1>
        <p className="mt-1 text-xs text-muted-foreground">Tap the map, then queue the spawn.</p>
        <button
          type="button"
          onClick={() => nav({ to: "/tools/npc-shop" })}
          className="mt-3 rounded-full border border-glass-border px-3 py-2 text-sm"
        >
          Back to NPC shop
        </button>
      </div>

      <GlassPanel className="mb-3 flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:p-4">
        <div className="flex items-center gap-3">
          <div className="border border-primary/40 bg-primary/10 px-3 py-1 font-mono text-xs uppercase text-primary">101X</div>
          <div className="text-xs text-muted-foreground">{pos ? `X ${pos.x} · Z ${pos.z}` : "Tap map to set coords"}</div>
        </div>
        <Button className="w-full sm:ml-auto sm:w-auto" disabled={!pos || busy} onClick={queue}>
          {busy ? "Queuing…" : "Queue spawn here"}
        </Button>
      </GlassPanel>

      <GlassPanel className="overflow-hidden p-0">
        <div className="h-[58vh] min-h-[320px] w-full bg-black/40 sm:h-[480px]">
          {leafletReady ? (
            <Suspense fallback={<div className="grid h-full place-items-center text-sm text-muted-foreground">Loading map…</div>}>
              <NpcSpawnMap
                serverId={serverId}
                pos={pos}
                onPick={(lat, lng) => {
                  const worldSize = DAYZ_MAPS[mapIdForServer(serverId)].worldSize;
                  const { x, z } = mapPositionToGame(lat, lng, worldSize);
                  setPos({ x, z, lat, lng });
                }}
              />
            </Suspense>
          ) : (
            <div className="grid h-full place-items-center text-sm text-muted-foreground">Loading map…</div>
          )}
        </div>
      </GlassPanel>
    </div>
  );
}
