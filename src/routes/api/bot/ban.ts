import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/bot/ban")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => null)) as {
          name?: string;
          kind?: "id" | "gamertag";
          reason?: string;
          duration?: string;
          bail?: string;
          servers?: string[];
          bannedAt?: string;
        } | null;
        if (!body?.name) return Response.json({ error: "name required" }, { status: 400 });
        const { upsertBan } = await import("@/lib/bans-store");
        const ban = await upsertBan({
          id: `ban_${Date.now()}`,
          name: body.name.trim(),
          kind: body.kind === "id" ? "id" : "gamertag",
          reason: body.reason || "Not specified",
          bannedAt: body.bannedAt || new Date().toISOString(),
          duration: body.duration || "Permanent",
          bail: body.bail || "No bail",
          servers: body.servers?.length ? body.servers : ["101x", "102x"],
          active: true,
        });
        return Response.json({ ok: true, ban });
      },
    },
  },
});
