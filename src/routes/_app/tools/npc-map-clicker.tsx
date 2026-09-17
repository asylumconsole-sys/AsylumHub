import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { GlassPanel } from "@/components/ui-custom/GlassPanel";
import { DayZPageHeader } from "@/components/dayz/DayZPageHeader";
import { IconCampaign } from "@/components/ui-custom/CustomIcon";
import { Button } from "@/components/ui/button";
import { spawnNpc } from "@/lib/dayz-spawn.functions";
import { DAYZ_SERVERS } from "@/lib/dayz/servers";
import { listAsylumServiceIds } from "@/lib/dayz/server-status.functions";
import { DAYZ_MAPS, mapIdForServer, mapPositionToGame } from "@/lib/dayz/map-tiles";
import { toast } from "sonner";

/** Leaflet touches `window` at import time — must stay out of the SSR bundle. */
const NpcSpawnMap = lazy(() => import("@/components/tools/NpcSpawnMap"));

export const Route = createFileRoute("/_app/tools/npc-map-clicker")({
  component: NPCMapClickerPage,
  validateSearch: (s: Record<string, unknown>) => ({
    npcId: typeof s.npcId === "string" ? s.npcId : "guard",
  }),
});

function NPCMapClickerPage() {
  const { npcId } = Route.useSearch();
  const nav = useNavigate();
  const [pos, setPos] = useState<{ x: number; z: number; lat: number; lng: number } | null>(null);
  const serverId = "101x";
  const [busy, setBusy] = useState(false);
  const [leafletReady, setLeafletReady] = useState(false);

  useEffect(() => {
    setLeafletReady(true);
  }, []);

  const catalogQ = useQuery({ queryKey: ["asylum-services"], queryFn: () => listAsylumServiceIds() });
  const server = DAYZ_SERVERS.find((s) => s.id === serverId) ?? DAYZ_SERVERS[0];
  const serviceId = catalogQ.data?.find((s) => s.id === serverId)?.serviceId ?? server.fallbackServiceId;

  const queue = async () => {
    if (!pos) return toast.error("Click the map to choose a spawn point");
    setBusy(true);
    try {
      const result = await spawnNpc({
        data: {
          serviceId,
          serverId,
          npcId,
          x: pos.x,
          z: pos.z,
          a: 0,
        },
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
    <div className="mx-auto max-w-5xl px-4 py-8">
      <DayZPageHeader
        title="NPC map clicker"
        subtitle={`Place NPC "${npcId}" on the map · PS4 CE may need restart`}
        icon={<IconCampaign size={16} />}
        hue={160}
        actions={
          <Button variant="outline" onClick={() => nav({ to: "/tools/npc-shop" })}>
            Back to NPC shop
          </Button>
        }
      />

      <GlassPanel className="mb-4 flex flex-wrap items-center gap-3 p-4">
        <div className="border border-primary/40 bg-primary/10 px-3 py-1 font-mono text-xs uppercase text-primary">101x</div>
        <div className="text-xs text-muted-foreground">
          {pos ? `X ${pos.x} · Z ${pos.z}` : "Click map to set coordinates"}
        </div>
        <Button className="ml-auto" disabled={!pos || busy} onClick={queue}>
          {busy ? "Queuing…" : "Queue spawn here"}
        </Button>
      </GlassPanel>

      <GlassPanel className="overflow-hidden p-0">
        <div className="h-[480px] w-full bg-black/40">
          {leafletReady ? (
            <Suspense
              fallback={<div className="grid h-full place-items-center text-sm text-muted-foreground">Loading map…</div>}
            >
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
        <div className="border-t border-glass-border px-4 py-3 text-xs text-muted-foreground">
          Chernarus/Livonia satellite basemap mapped into DayZ world coords. Spawn path uses existing `spawnNpc` → live adapter or CE restart queue.
        </div>
      </GlassPanel>
    </div>
  );
}
