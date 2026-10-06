import { createFileRoute } from "@tanstack/react-router";
import { publishLotteryBoard } from "@/lib/discord-lottery";
import { buyLotteryTicket, scratchLottery } from "@/lib/discord-lottery-play";

const HUB = "https://dayzpro.online";

function oauthUrl(next: string) {
  const clientId = process.env.DISCORD_CLIENT_ID || process.env.VITE_DISCORD_CLIENT_ID || "";
  const redirectUri = `${HUB}/api/discord/callback`;
  const state = Buffer.from(JSON.stringify({ redirect: next, redirectUri })).toString("base64");
  if (!clientId) return next;
  return `https://discord.com/oauth2/authorize?${new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "identify",
    state,
  }).toString()}`;
}

function sessionUser(url: URL) {
  const raw = url.searchParams.get("discord_session") || "";
  try {
    const session = JSON.parse(decodeURIComponent(raw)) as { user?: { id?: string; global_name?: string; username?: string; user_metadata?: { name?: string } } };
    const id = session.user?.id || "";
    const name = session.user?.global_name || session.user?.username || session.user?.user_metadata?.name || id;
    return id ? { id, name, raw } : null;
  } catch {
    return null;
  }
}

function page(body: string) {
  return new Response(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DAYZ PRO SCRATCH</title><style>body{margin:0;background:#100e0c;color:#f3e6c4;font-family:ui-sans-serif,system-ui,sans-serif}.wrap{max-width:460px;margin:0 auto;padding:22px 16px 48px}h1{letter-spacing:.16em;font-size:20px}a.btn,button.btn{display:block;margin:8px 0;padding:14px;border:1px solid #c4a35a;background:#1a1612;color:#f3e6c4;text-decoration:none;border-radius:10px;text-align:center}pre{font-size:22px;line-height:1.7;background:#070605;padding:14px;border-radius:12px;border:1px solid #c4a35a55}.row{color:#b9a36a;font-size:14px}</style></head><body><div class="wrap">${body}</div></body></html>`, { headers: { "content-type": "text/html; charset=utf-8" } });
}

function renderTicket(payload: { content?: string; embeds?: Array<{ title?: string; description?: string }>; components?: Array<{ components?: Array<{ label?: string; custom_id?: string; disabled?: boolean }> }> }, session: string, note?: string) {
  const embed = payload.embeds?.[0];
  const cells = (payload.components || []).flatMap((row) => row.components || []).map((b) => {
    const id = b.custom_id || "";
    const href = `/api/discord/lottery?view=scratch&cid=${encodeURIComponent(id)}&discord_session=${encodeURIComponent(session)}`;
    return b.disabled ? `<button class="btn" disabled>${b.label}</button>` : `<a class="btn" href="${href}">${b.label}</a>`;
  }).join("");
  return page(`<h1>${embed?.title || "SCRATCH"}</h1><div class="row">${note || ""}</div><pre>${(embed?.description || payload.content || "").replace(/</g, "")}</pre>${cells}<a class="btn" href="https://discord.com/channels/1389462883645132961/1557145808384565278">Back to Discord</a>`);
}

export const Route = createFileRoute("/api/discord/lottery")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const view = url.searchParams.get("view") || "";
        if (!view) return Response.json(await publishLotteryBoard(url.searchParams.get("channel") || undefined));
        const user = sessionUser(url);
        if (!user) return page(`<h1>DAYZ PRO SCRATCH</h1><div class="row">15,000 credits. No refunds.</div><a class="btn" href="${oauthUrl(url.pathname + url.search)}">Continue with Discord</a>`);
        if (view === "scratch") {
          const hit = await scratchLottery(user.id, url.searchParams.get("cid") || "");
          return renderTicket(hit.data, user.raw);
        }
        const ticket = await buyLotteryTicket(user.id, user.name);
        return renderTicket(ticket, user.raw, ticket.content || "");
      },
    },
  },
});
