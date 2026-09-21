import { createFileRoute } from "@tanstack/react-router";
import { ITEM_CATALOG } from "@/lib/item-shop-catalog";
import { NPCS } from "@/lib/npc/roster";
import { SPAWN_PACKS } from "@/lib/npc/spawn-packs";
import { buyNpcPack, buyShopItem, shopBalance } from "@/lib/discord-shop-embed";

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
    const session = JSON.parse(decodeURIComponent(raw)) as { user?: { id?: string; user_metadata?: { name?: string } } };
    const id = session.user?.id || "";
    const name = session.user?.user_metadata?.name || id;
    return id ? { id, name, raw } : null;
  } catch {
    return null;
  }
}

function keep(raw: string | null) {
  return raw ? `&discord_session=${encodeURIComponent(raw)}` : "";
}

function page(body: string) {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>DAYZ PRO SHOP</title>
<style>
body{margin:0;background:#070707;color:#f3e6c4;font-family:ui-sans-serif,system-ui,sans-serif}
.wrap{max-width:560px;margin:0 auto;padding:20px 16px 48px}
h1{font-size:22px;letter-spacing:.18em;margin:12px 0 18px}
a.btn,button.btn{display:block;width:100%;box-sizing:border-box;margin:8px 0;padding:14px 16px;border:1px solid #d4a84b;background:#111;color:#f3e6c4;text-decoration:none;border-radius:10px;font-size:16px;text-align:left}
a.btn:active{background:#d4a84b;color:#111}
.row{color:#b9a36a;font-size:13px;margin:0 0 10px}
img.banner{width:100%;border-radius:12px;border:1px solid #d4a84b55;display:block}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
</style></head><body><div class="wrap">${body}</div></body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

export const Route = createFileRoute("/api/discord/shop")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const view = url.searchParams.get("view") || "home";
        const user = sessionUser(url);
        const qs = keep(url.searchParams.get("discord_session"));
        const login = (next: string) => oauthUrl(next.startsWith("http") ? next : `/api/discord/shop${next}`);

        if (!user && view !== "home") {
          return page(`<h1>DAYZ PRO SHOP</h1><a class="btn" href="${login(url.pathname + url.search)}">Continue with Discord</a>`);
        }

        if (view === "bal" && user) {
          const bal = await shopBalance(user.id, user.name);
          return page(`<h1>CREDITS</h1><div class="row">${String(bal.content).replace(/\n/g, "<br>")}</div><a class="btn" href="/api/discord/shop?view=home${qs}">Back</a>`);
        }

        if (view === "nbuy" && user) {
          const msg = await buyNpcPack(
            user.id,
            user.name,
            url.searchParams.get("npc") || "",
            Number(url.searchParams.get("spawns") || 0),
            Number(url.searchParams.get("price") || 0),
          );
          return page(`<h1>NPC</h1><div class="row">${msg}</div><a class="btn" href="/api/discord/shop?view=npc${qs}">Back</a>`);
        }

        if (view === "ibuy" && user) {
          const msg = await buyShopItem(user.id, user.name, url.searchParams.get("item") || "");
          return page(`<h1>ITEM</h1><div class="row">${msg}</div><a class="btn" href="/api/discord/shop?view=items${qs}">Back</a>`);
        }

        if (view === "npc") {
          const npcId = url.searchParams.get("npc");
          if (npcId) {
            const npc = NPCS.find((n) => n.id === npcId);
            const packs = SPAWN_PACKS.map(
              (p) =>
                `<a class="btn" href="/api/discord/shop?view=nbuy&npc=${npcId}&spawns=${p.spawns}&price=${p.price}${qs}">${p.spawns} spawns · ${p.price.toLocaleString()} cr</a>`,
            ).join("");
            return page(`<h1>${npc?.name ?? "NPC"}</h1>${packs}<a class="btn" href="/api/discord/shop?view=npc${qs}">Back</a>`);
          }
          const list = NPCS.map((n) => `<a class="btn" href="/api/discord/shop?view=npc&npc=${n.id}${qs}">${n.name}</a>`).join("");
          return page(`<h1>NPC</h1>${list}<a class="btn" href="/api/discord/shop?view=home${qs}">Back</a>`);
        }

        if (view === "items") {
          const cat = url.searchParams.get("cat");
          const itemId = url.searchParams.get("item");
          if (itemId) {
            const item = ITEM_CATALOG.find((i) => i.id === itemId);
            const img = item?.image ? `<img class="banner" src="${item.image}" alt="">` : "";
            return page(`<h1>${item?.name ?? "Item"}</h1>${img}<div class="row">${item?.price.toLocaleString()} cr</div><a class="btn" href="/api/discord/shop?view=ibuy&item=${itemId}${qs}">Buy</a><a class="btn" href="/api/discord/shop?view=items&cat=${encodeURIComponent(item?.category || "")}${qs}">Back</a>`);
          }
          if (cat) {
            const list = ITEM_CATALOG.filter((i) => i.category === cat)
              .map((i) => `<a class="btn" href="/api/discord/shop?view=items&item=${i.id}${qs}">${i.name} · ${i.price.toLocaleString()}</a>`)
              .join("");
            return page(`<h1>${cat}</h1>${list}<a class="btn" href="/api/discord/shop?view=items${qs}">Back</a>`);
          }
          const cats = [...new Set(ITEM_CATALOG.map((i) => i.category))];
          const list = cats.map((c) => `<a class="btn" href="/api/discord/shop?view=items&cat=${encodeURIComponent(c)}${qs}">${c}</a>`).join("");
          return page(`<h1>ITEMS</h1>${list}<a class="btn" href="/api/discord/shop?view=home${qs}">Back</a>`);
        }

        return page(`
<img class="banner" src="https://raw.githubusercontent.com/asylumconsole-sys/AsylumHub/main/src/assets/console-1.jpg" alt="">
<h1>DAYZ PRO SHOP</h1>
${user ? `<div class="row">Signed in · ${user.name}</div>` : `<a class="btn" href="${login("/api/discord/shop?view=home")}">Continue with Discord</a>`}
<div class="grid">
<a class="btn" href="/api/discord/shop?view=npc${qs}">NPC</a>
<a class="btn" href="/api/discord/shop?view=items${qs}">Items</a>
</div>
<a class="btn" href="/api/discord/shop?view=bal${qs}">Credits</a>
`);
      },
    },
  },
});
