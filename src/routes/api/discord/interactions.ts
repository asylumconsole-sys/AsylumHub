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
import { publishWipeAnnounce } from "@/lib/wipe-announce";
import { aioffReply, registerAiToggleCommands, setTicketAiPaused } from "@/lib/ticket-ai-pause";
import { handleStaffClaim, handleStaffPromo, handleStaffVote } from "@/lib/staff-actions";

type Interaction = {
  type: number;
  member?: { user?: { id: string } };
  user?: { id: string };
  data?: {
    custom_id?: string;
    name?: string;
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

function page(text: string) {
  return new Response(
    `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="background:#050505;color:#f5e6c0;font-family:sans-serif;padding:24px"><p>${text}</p><p><a href="https://discord.com/channels/@me" style="color:#d4a84b">Back to Discord</a></p></body>`,
    { headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

export const Route = createFileRoute("/api/discord/interactions")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const action = url.searchParams.get("action") || "publish";
        if (action === "staff_done") {
          const raw = url.searchParams.get("discord_session") || "";
          let userId = "";
          try {
            const session = JSON.parse(decodeURIComponent(raw)) as { user?: { id?: string } };
            userId = session.user?.id || "";
          } catch {
            userId = "";
          }
          if (!userId) return page("Login failed. Open the button again.");
          const kind = url.searchParams.get("kind");
          const result = kind === "promo" ? await handleStaffPromo(userId) : await handleStaffClaim(userId);
          return page(String(result.content || "Done."));
        }
        if (action === "announce" || action === "wipe_announce") return Response.json(await publishWipeAnnounce());
        if (action === "aioff") {
          const paused = await setTicketAiPaused(true, "http");
          const reg = await registerAiToggleCommands();
          return Response.json({ ok: true, store: paused, reg, reply: aioffReply(true) });
        }
        if (action === "aion") {
          const store = await setTicketAiPaused(false, "http");
          return Response.json({ ok: true, store, reply: aioffReply(false) });
        }
        if (action === "staff") return Response.json(await publishStaffBoard());
        if (action === "online") {
          const raw = await getOnlinePlayers({ data: { accessToken: "discord-access-token" } }).catch(() => ({ players: [] as Array<{ name: string }> }));
          return Response.json(await repostOnlineEmbed(raw.players.map((p) => p.name)));
        }
        if (action === "dm") {
          const to = url.searchParams.get("to") || "239814047627870208";
          await dmOwner(to, "DAYZ PRO base rent TEST\nBase: Dennis Fox (df4507049)");
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
          const hit = store.bases.find((b) => b.code === url.searchParams.get("code"));
          if (hit) hit.status = "despawned";
          await saveBases(store);
          return Response.json({ pub: await publishBaseBoard() });
        }
        if (action === "rent") return Response.json({ rent: await runMonthlyRent(true), pub: await publishBaseBoard() });
        if (action === "create") {
          const ownerName = url.searchParams.get("ownerName") || "unknown";
          store.bases.push({
            code: url.searchParams.get("code") || makeBaseCode(ownerName),
            name: url.searchParams.get("name") || `${ownerName}'s base`,
            ownerDiscordId: url.searchParams.get("ownerDiscordId") || "",
            ownerName,
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
        const cmd = String(body.data?.name || "");
        if (body.type === 2 && (cmd === "aioff" || cmd === "aion")) {
          const paused = cmd === "aioff";
          await setTicketAiPaused(paused, actorId(body));
          return json(4, { content: aioffReply(paused) });
        }
        const id = body.data?.custom_id ?? "";
        const who = actorId(body);
        if (id === "staff_claim") return json(4, await handleStaffClaim(who));
        if (id === "staff_promo") return json(4, await handleStaffPromo(who));
        if (id.startsWith("staff_yes:")) {
          const [, target, next] = id.split(":");
          return json(4, await handleStaffVote(who, true, target, next));
        }
        if (id.startsWith("staff_no:")) return json(4, await handleStaffVote(who, false, id.split(":")[1]));
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
          const base = store.bases.find((b) => b.code === id.split(":")[1]);
          if (base) base.status = "despawned";
          await saveBases(store);
          await publishBaseBoard();
          return json(4, { flags: 64, content: "Despawned." });
        }
        if (id.startsWith("base_xfer_ask:")) {
          return json(9, {
            custom_id: `base_xfer_modal:${id.split(":")[1]}`,
            title: "Transfer ownership",
            components: [{ type: 1, components: [{ type: 4, custom_id: "query", label: "Search Discord name", style: 1, min_length: 1, max_length: 32, required: true }] }],
          });
        }
        if (id.startsWith("base_xfer_modal:")) {
          const people = await listGuildMembers(body.data?.components?.[0]?.components?.[0]?.value ?? "");
          if (!people.length) return json(4, { flags: 64, content: "No members match." });
          return json(4, {
            flags: 64,
            content: "Pick owner",
            components: [{
              type: 1,
              components: [{
                type: 3,
                custom_id: `base_xfer:${id.split(":")[1]}`,
                placeholder: "Pick a player",
                options: people.slice(0, 25).map((p) => ({ label: p.username.slice(0, 100), value: `${p.id}|${p.username}`.slice(0, 100) })),
              }],
            }],
          });
        }
        if (id.startsWith("base_xfer:")) {
          const raw = body.data?.values?.[0] ?? "";
          const [uid, uname] = raw.split("|");
          const base = store.bases.find((b) => b.code === id.split(":")[1]);
          if (base && uid) {
            base.ownerDiscordId = uid;
            base.ownerName = uname || uid;
            await saveBases(store);
            await publishBaseBoard();
          }
          return json(4, { flags: 64, content: "Transferred." });
        }
        if (id === "base_cancel") return json(4, { flags: 64, content: "Cancelled." });
        return json(4, { flags: 64, content: "Unknown action." });
      },
    },
  },
});
