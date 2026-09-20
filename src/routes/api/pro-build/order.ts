import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/pro-build/order")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            playerId?: string;
            playerName?: string;
            discordId?: string;
            mode?: "base" | "map";
            x?: number;
            z?: number;
            baseConfirmed?: boolean;
            images?: string[];
          };
          if (!body.playerId) return Response.json({ error: "Sign in required" }, { status: 401 });
          const { placeProBuildOrder } = await import("@/lib/pro-build-order");
          const result = await placeProBuildOrder({
            playerId: body.playerId,
            playerName: body.playerName || body.playerId,
            discordId: body.discordId,
            mode: body.mode === "map" ? "map" : "base",
            x: body.x,
            z: body.z,
            baseConfirmed: Boolean(body.baseConfirmed),
            images: body.images ?? [],
          });
          return Response.json({ ok: true, ...result });
        } catch (e) {
          return Response.json({ error: e instanceof Error ? e.message : "failed" }, { status: 400 });
        }
      },
    },
  },
});
