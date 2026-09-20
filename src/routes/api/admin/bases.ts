import { createFileRoute } from "@tanstack/react-router";
import {
  DEFAULT_MONTHLY_RENT,
  firstOfNextMonth,
  loadBases,
  makeBaseCode,
  saveBases,
  type CustomBase,
} from "@/lib/custom-bases";
import { publishBaseBoard } from "@/lib/custom-bases-discord";
import { runMonthlyRent } from "@/lib/custom-bases-rent";

function authorized(request: Request) {
  const secret = process.env.HUB_BOT_SECRET;
  const header = request.headers.get("authorization") ?? request.headers.get("x-hub-secret") ?? "";
  return Boolean(secret && header.replace(/^Bearer\s+/i, "") === secret);
}

export const Route = createFileRoute("/api/admin/bases")({
  server: {
    handlers: {
      GET: async () => {
        const store = await loadBases();
        return Response.json(store);
      },
      POST: async ({ request }) => {
        if (!authorized(request)) return Response.json({ error: "unauthorized" }, { status: 401 });
        const body = (await request.json().catch(() => ({}))) as Partial<CustomBase> & { action?: string; query?: string };
        if (body.action === "publish") {
          const pub = await publishBaseBoard();
          return Response.json(pub);
        }
        if (body.action === "rent") {
          const rent = await runMonthlyRent(true);
          await publishBaseBoard();
          return Response.json(rent);
        }
        const ownerName = body.ownerName?.trim() || "unknown";
        const base: CustomBase = {
          code: body.code || makeBaseCode(ownerName),
          name: body.name?.trim() || `${ownerName}'s base`,
          ownerDiscordId: String(body.ownerDiscordId || ""),
          ownerName,
          faction: body.faction,
          x: body.x,
          z: body.z,
          map: body.map || "livonia",
          monthlyCost: Number(body.monthlyCost) || DEFAULT_MONTHLY_RENT,
          amountPaid: Number(body.amountPaid) || 0,
          createdAt: new Date().toISOString(),
          nextDueAt: firstOfNextMonth(),
          status: "active",
        };
        const store = await loadBases();
        store.bases.push(base);
        await saveBases(store);
        await publishBaseBoard();
        return Response.json(base);
      },
      DELETE: async ({ request }) => {
        if (!authorized(request)) return Response.json({ error: "unauthorized" }, { status: 401 });
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const store = await loadBases();
        const hit = store.bases.find((b) => b.code === code);
        if (hit) hit.status = "despawned";
        await saveBases(store);
        await publishBaseBoard();
        return Response.json({ ok: true, code });
      },
    },
  },
});
