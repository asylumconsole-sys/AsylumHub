import { createFileRoute } from "@tanstack/react-router";
import {
  DEFAULT_MONTHLY_RENT,
  firstOfNextMonth,
  loadBases,
  makeBaseCode,
  saveBases,
} from "@/lib/custom-bases";
import { publishBaseBoard } from "@/lib/custom-bases-discord";
import { dmOwner } from "@/lib/custom-bases-discord";

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
          const playerName = String(form.get("playerName") || playerId);
          const discordId = String(form.get("discordId") || playerId);
          const x = Number(form.get("x") || 0) || undefined;
          const z = Number(form.get("z") || 0) || undefined;
          const { placeProBuildOrder } = await import("@/lib/pro-build-order");
          const result = await placeProBuildOrder({
            playerId,
            playerName,
            discordId: discordId || undefined,
            mode: form.get("mode") === "map" ? "map" : "base",
            x,
            z,
            baseConfirmed: form.get("baseConfirmed") === "true",
            attachments,
          });
          const store = await loadBases();
          const code = makeBaseCode(playerName);
          store.bases.push({
            code,
            name: `${playerName}'s base`,
            ownerDiscordId: discordId,
            ownerName: playerName,
            x,
            z,
            map: "livonia",
            monthlyCost: DEFAULT_MONTHLY_RENT,
            amountPaid: 0,
            createdAt: new Date().toISOString(),
            nextDueAt: firstOfNextMonth(),
            status: "active",
          });
          await saveBases(store);
          await publishBaseBoard();
          await dmOwner(
            discordId,
            [`Your custom base is on file.`, `Code: ${code}`, `Rent: ${DEFAULT_MONTHLY_RENT.toLocaleString()} cr on the 1st of each month.`, x != null ? `Coords Y ${x} / Z ${z}` : "Coords pending staff confirm."].join("\n"),
          );
          return Response.json({ ok: true, ...result, baseCode: code });
        } catch (e) {
          return Response.json({ error: e instanceof Error ? e.message : "failed" }, { status: 400 });
        }
      },
    },
  },
});
