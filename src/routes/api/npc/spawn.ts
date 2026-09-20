import { createFileRoute } from "@tanstack/react-router";
import { spawnNpc } from "@/lib/dayz-spawn.functions";

export const Route = createFileRoute("/api/npc/spawn")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => ({}))) as {
          serviceId?: string;
          serverId?: string;
          npcId?: string;
          x?: number;
          z?: number;
          a?: number;
          playerId?: string;
          playerName?: string;
        };
        if (!body.npcId) return Response.json({ error: "npcId required" }, { status: 400 });
        const x = Number(body.x);
        const z = Number(body.z);
        if (!Number.isFinite(x) || !Number.isFinite(z)) {
          return Response.json({ error: "Valid Y/Z required" }, { status: 400 });
        }
        try {
          const result = await spawnNpc({
            data: {
              serviceId: body.serviceId || body.serverId || "101x",
              serverId: body.serverId || body.serviceId || "101x",
              npcId: body.npcId,
              x: Math.round(x),
              z: Math.round(z),
              a: Number(body.a) || 0,
              playerId: body.playerId,
              playerName: body.playerName,
            },
          });
          return Response.json(result);
        } catch (error) {
          return Response.json({ error: error instanceof Error ? error.message : "Spawn failed" }, { status: 500 });
        }
      },
    },
  },
});
