import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/challenges/zones")({
  server: {
    handlers: {
      GET: async ({ request }) => handle(request),
      POST: async ({ request }) => handle(request),
    },
  },
});

async function handle(request: Request) {
  try {
    const url = new URL(request.url);
    const playerId = url.searchParams.get("playerId") || "";
    if (!playerId) return Response.json({ error: "playerId required" }, { status: 400 });
    const { getMyLinkedPlayernames } = await import("@/lib/account-links.functions");
    const links = await getMyLinkedPlayernames({ data: { discordId: playerId } } as never);
    const psn = links?.psn ?? null;
    let x: number | undefined;
    let z: number | undefined;
    try {
      const { getOnlinePlayers } = await import("@/lib/online-players.functions");
      const online = await getOnlinePlayers({ data: {} } as never);
      const hit = online?.players?.find((p: { name: string; server?: string }) => p.name.toLocaleLowerCase() === String(psn || "").toLocaleLowerCase() && p.server === "101x");
      x = hit?.x;
      z = hit?.z ?? hit?.y;
    } catch {
      /* logs may be down */
    }
    const { recordDiscoveries, listDiscoveries, listNotices } = await import("@/lib/challenges/zone-discovery");
    const result = await recordDiscoveries({
      playerId,
      discordId: playerId,
      psn: psn ?? undefined,
      x,
      z,
    });
    const found = await listDiscoveries(playerId);
    const notices = await listNotices(playerId);
    return Response.json({ ok: true, psn, x, z, ...result, found, notices });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
