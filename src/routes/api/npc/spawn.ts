import { createFileRoute } from "@tanstack/react-router";
import { spawnNpc } from "@/lib/dayz-spawn.functions";

export const Route = createFileRoute("/api/npc/spawn")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            serviceId?: string;
            serverId?: string;
            npcId?: string;
            x?: number;
            z?: number;
            a?: number;
            playerId?: string;
            playerName?: string;
          };
          if (!body?.npcId || body.x == null || body.z == null) {
            return Response.json({ error: "npcId, x, z required" }, { status: 400 });
          }
          const result = await spawnNpc({
            data: {
              serviceId: String(body.serviceId || body.serverId || "101x"),
              serverId: String(body.serverId || "101x"),
              npcId: String(body.npcId),
              x: Number(body.x),
              z: Number(body.z),
              a: Number(body.a ?? 0),
              playerId: body.playerId,
              playerName: body.playerName,
            },
          });
          return Response.json(result);
        } catch (e) {
          return Response.json({ error: e instanceof Error ? e.message : "Spawn failed" }, { status: 500 });
        }
      },
    },
  },
});
