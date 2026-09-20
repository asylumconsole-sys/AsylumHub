import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/pro-build/order")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const form = await request.formData();
          const playerId = String(form.get("playerId") || "");
          if (!playerId) return Response.json({ error: "Sign in required" }, { status: 401 });
          const files = form.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
          if (files.length < 3) return Response.json({ error: "Select at least 3 base photos" }, { status: 400 });
          const attachments = await Promise.all(
            files.slice(0, 6).map(async (f, i) => ({
              name: f.name || `base-${i + 1}.jpg`,
              type: f.type || "image/jpeg",
              bytes: Buffer.from(await f.arrayBuffer()),
            })),
          );
          const { placeProBuildOrder } = await import("@/lib/pro-build-order");
          const result = await placeProBuildOrder({
            playerId,
            playerName: String(form.get("playerName") || playerId),
            discordId: String(form.get("discordId") || "") || undefined,
            mode: form.get("mode") === "map" ? "map" : "base",
            x: Number(form.get("x") || 0) || undefined,
            z: Number(form.get("z") || 0) || undefined,
            baseConfirmed: form.get("baseConfirmed") === "true",
            attachments,
          });
          return Response.json({ ok: true, ...result });
        } catch (e) {
          return Response.json({ error: e instanceof Error ? e.message : "failed" }, { status: 400 });
        }
      },
    },
  },
});
