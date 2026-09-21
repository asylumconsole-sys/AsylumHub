import { createFileRoute } from "@tanstack/react-router";
import {
  DEFAULT_MONTHLY_RENT,
  firstOfNextMonth,
  loadBases,
  makeBaseCode,
  mapLink,
  saveBases,
} from "@/lib/custom-bases";
import { baseDetailEmbed, dmOwner, listGuildMembers, publishBaseBoard } from "@/lib/custom-bases-discord";
import { runMonthlyRent } from "@/lib/custom-bases-rent";
import { repostOnlineEmbed } from "@/lib/discord-online-embed";
import { getOnlinePlayers } from "@/lib/online-players.functions";
import { publishStaffBoard } from "@/lib/staff-embed";
import { handleStaffClaim, handleStaffPromo, handleStaffVote } from "@/lib/staff-actions";

type Interaction = {
  type: number;
  member?: { user?: { id: string } };
  user?: { id: string };
  data?: {
    custom_id?: string;
    values?: string[];
    components?: Array<{ components?: Array<{ custom_id?: string; value?: string }> }>;
  };
};

function json(type: number, data: Record<string, unknown>) {
  return Response.json({ type, data });
}

function actorId(body: Interaction) {
  return body.member?.user?.id || body.user?.id || "";
}

export const Route = createFileRoute("/api/discord/interactions")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const action = url.searchParams.get("action") || "publish";
        if (action === "staff") return Response.json(await publishStaffBoard());
        if (action === "online") {
          const raw = await getOnlinePlayers({ data: { accessToken: "discord-access-token" } }).catch(() => ({ players: [] as Array<{ name: string }> }));
          return Response.json(await repostOnlineEmbed(raw.players.map((p) => p.name)));
        }
        if (action === "dm") {
          const to = url.searchParams.get("to") || "239814047627870208";
          await dmOwner(
            to,
            [
              "DAYZ PRO base rent TEST",
              "Base: Dennis Fox (df4507049)",
              "Coords: unknown",
              `Map: ${mapLink({ code: "df4507049", name: "Dennis Fox", ownerDiscordId: to, ownerName: "Dennis Fox", monthlyCost: 55000, amountPaid: 0, createdAt: new Date().toISOString(), nextDueAt: firstOfNextMonth(), status: "active" })}`,
              "55,000 cr will auto-deduct on the 1st.",
            ].join("\n"),
          );
          return Response.json({ ok: true, to });
        }
        const store = await loadBases();
        if (action === "wipe") {
          const keep = (url.searchParams.get("keep") || "df4507049,Dennis Fox").split(",");
          for (const b of store.bases) {
            if (!keep.some((k) => k && (b.code === k || b.name === k))) b.status = "despawned";
          }
          await saveBases(store);
          return Response.json({ wiped: true, pub: await publishBaseBoard() });
        }
        if (action === "delete") {
          const code = url.searchParams.get("code") || "";
          const hit = store.bases.find((b) => b.code === code);
          if (hit) hit.status = "despawned";
          await saveBases(store);
          return Response.json({ deleted: code, pub: await publishBaseBoard() });
        }
        if (action === "rent") return Response.json({ rent: await runMonthlyRent(true), pub: await publishBaseBoard() });
        if (action === "create") {
          const ownerName = url.searchParams.get("ownerName") || "unknown";
          store.bases.push({
            code: url.searchParams.get("code") || makeBaseCode(ownerName),
            name: url.searchParams.get("name") || `${ownerName}'s base`,
            ownerDiscordId: url.searchParams.get("ownerDiscordId") || "",
            ownerName,
            faction: url.searchParams.get("faction") || undefined,
            x: Number(url.searchParams.get("x") || 0) || undefined,
            z: Number(url.searchParams.get("z") || 0) || undefined,
            map: "livonia",
            monthlyCost: Number(url.searchParams.get("monthlyCost") || DEFAULT_MONTHLY_RENT),
            amountPaid: 0,
            createdAt: new Date().toISOString(),
            nextDueAt: firstOfNextMonth(),
            status: "active",
          });
          await saveBases(store);
          return Response.json({ pub: await publishBaseBoard() });
        }
        return Response.json({ pub: await publishBaseBoard(), live: store.bases.filter((b) => b.status !== "despawned") });
      },
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => ({}))) as Interaction;
        if (body.type === 1) return Response.json({ type: 1 });
        const id = body.data?.custom_id ?? "";
        const who = actorId(body);
        if (id === "staff_claim") return json(4, await handleStaffClaim(who));
        if (id === "staff_promo") return json(4, await handleStaffPromo(who));
        if (id.startsWith("staff_yes:")) {
          const [, target, next] = id.split(":");
          return json(4, await handleStaffVote(who, true, target, next));
        }
        if (id.startsWith("staff_no:")) {
          const target = id.split(":")[1];
          return json(4, await handleStaffVote(who, false, target));
        }
        const store = await loadBases();
        if (id === "base_select") {
          const code = body.data?.values?.[0];
          const base = store.bases.find((b) => b.code === code);
          if (!base) return json(4, { content: "Base not found.", flags: 64 });
          return json(4, {
            flags: 64,
            embeds: [baseDetailEmbed(base)],
            components: [{
              type: 1,
              components: [
                { type: 2, style: 4, label: "Delete base", custom_id: `base_del_ask:${base.code}` },
                { type: 2, style: 1, label: "Transfer ownership", custom_id: `base_xfer_ask:${base.code}` },
              ],
            }],
          });
        }
        if (id.startsWith("base_del_ask:")) {
          const code = id.split(":")[1];
          return json(4, {
            flags: 64,
            content: `Delete base ${code}?`,
            components: [{
              type: 1,
              components: [
                { type: 2, style: 4, label: "Confirm delete", custom_id: `base_del:${code}` },
                { type: 2, style: 2, label: "Cancel", custom_id: "base_cancel" },
              ],
            }],
          });
        }
        if (id.startsWith("base_del:")) {
          const code = id.split(":")[1];
          const base = store.bases.find((b) => b.code === code);
          if (base) base.status = "despawned";
          await saveBases(store);
          await publishBaseBoard();
          return json(4, { flags: 64, content: `Base ${code} despawned.` });
        }
        if (id.startsWith("base_xfer_ask:")) {
          const code = id.split(":")[1];
          return json(9, {
            custom_id: `base_xfer_modal:${code}`,
            title: "Transfer ownership",
            components: [{
              type: 1,
              components: [{ type: 4, custom_id: "query", label: "Search Discord name", style: 1, min_length: 1, max_length: 32, required: true }],
            }],
          });
        }
        if (id.startsWith("base_xfer_modal:")) {
          const code = id.split(":")[1];
          const query = body.data?.components?.[0]?.components?.[0]?.value ?? "";
          const people = await listGuildMembers(query);
          if (!people.length) return json(4, { flags: 64, content: `No members match "${query}".` });
          return json(4, {
            flags: 64,
            content: `Transfer ${code} to:`,
            components: [{
              type: 1,
              components: [{
                type: 3,
                custom_id: `base_xfer:${code}`,
                placeholder: "Pick a player",
                options: people.slice(0, 25).map((p) => ({ label: p.username.slice(0, 100), value: `${p.id}|${p.username}`.slice(0, 100) })),
              }],
            }],
          });
        }
        if (id.startsWith("base_xfer:")) {
          const code = id.split(":")[1];
          const raw = body.data?.values?.[0] ?? "";
          const [uid, uname] = raw.split("|");
          const base = store.bases.find((b) => b.code === code);
          if (base && uid) {
            base.ownerDiscordId = uid;
            base.ownerName = uname || uid;
            await saveBases(store);
            await publishBaseBoard();
          }
          return json(4, { flags: 64, content: `Ownership of ${code} moved to ${uname || uid}.` });
        }
        if (id === "base_cancel") return json(4, { flags: 64, content: "Cancelled." });
        return json(4, { flags: 64, content: "Unknown action." });
      },
    },
  },
});
