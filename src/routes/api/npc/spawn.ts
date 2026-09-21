import { createFileRoute } from "@tanstack/react-router";
import { executeNpcSpawn, tickNpcWaves } from "@/lib/npc-spawn-exec";

export const Route = createFileRoute("/api/npc/spawn")({
  server: {
    handlers: {
      GET: async () => Response.json(await tickNpcWaves()),
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => ({}))) as {
          serviceId?: string;
          serverId?: string;
          npcId?: string;
          npcName?: string;
          x?: number;
          z?: number;
          a?: number;
          playerId?: string;
          playerName?: string;
          count?: number;
        };
        if (!body.npcId) return Response.json({ error: "npcId required" }, { status: 400 });
        const x = Number(body.x);
        const z = Number(body.z);
        if (!Number.isFinite(x) || !Number.isFinite(z)) {
          return Response.json({ error: "Valid Y/Z required" }, { status: 400 });
        }
        try {
          const result = await executeNpcSpawn({
            serviceId: body.serviceId || body.serverId || "101x",
            serverId: body.serverId || "101x",
            npcId: body.npcId,
            npcName: body.npcName,
            x: Math.round(x),
            z: Math.round(z),
            a: Number(body.a) || 0,
            playerId: body.playerId,
            playerName: body.playerName,
            count: body.count,
          });
          return Response.json(result);
        } catch (error) {
          return Response.json({ error: error instanceof Error ? error.message : "Spawn failed" }, { status: 500 });
        }
      },
    },
  },
});
