import { createFileRoute } from "@tanstack/react-router";
import { readJsonFile, writeJsonFile } from "@/lib/dayz/store";

type EconomyStore = {
  accounts: Record<string, { playerId: string; displayName: string; balance: number; xp: number }>;
  transfers: Array<{ id: string; fromPlayerId: string; toPlayerId: string; amount: number; note?: string; createdAt: string }>;
};

function authorized(request: Request) {
  const secret = process.env.HUB_BOT_SECRET;
  const header = request.headers.get("authorization") ?? request.headers.get("x-hub-secret") ?? "";
  const token = header.replace(/^Bearer\s+/i, "");
  return Boolean(secret && token && token === secret);
}

function botHeaders() {
  const token = process.env.DISCORD_TOKEN?.replace(/^Bot\s+/i, "");
  return token ? { Authorization: `Bot ${token}`, "Content-Type": "application/json" } : null;
}

async function listGuildMembers(guildId: string, headers: Record<string, string>) {
  const out: Array<{ id: string; username: string }>= [];
  let after = "0";
  for (let i = 0; i < 8; i++) {
    const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members?limit=1000&after=${after}`, { headers });
    const rows = (await res.json()) as Array<{ user?: { id: string; username: string; bot?: boolean } }>;
    if (!Array.isArray(rows) || rows.length === 0) break;
    for (const row of rows) {
      if (row.user && !row.user.bot) out.push({ id: row.user.id, username: row.user.username });
    }
    after = rows[rows.length - 1]?.user?.id ?? after;
    if (rows.length < 1000) break;
  }
  return out;
}

async function tryDayzppUsers(apiKey: string) {
  const bases = [
    "https://api.killfeed.xyz",
    "https://killfeed.xyz/api",
    "https://api.killfeed.xyz/v1",
  ];
  const paths = ["/linked-usernames", "/users", "/guild/users", "/developers/users"];
  for (const base of bases) {
    for (const path of paths) {
      try {
        const res = await fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${apiKey}`, "X-API-Key": apiKey } });
        if (!res.ok) continue;
        const data = await res.json();
        if (data) return { ok: true as const, data, url: `${base}${path}` };
      } catch {
        /* next */
      }
    }
  }
  return { ok: false as const, data: null, url: "" };
}

function dmBody(username: string, linked: string[], balance: number) {
  const names = linked.length ? linked.join(", ") : "none on file yet";
  return [
    `DAYZ PRO is replacing DayZ++.`,
    ``,
    `Your stats and credits are moving to the new hub.`,
    `Imported balance on the hub: ${balance.toLocaleString()} cr`,
    `Linked usernames: ${names}`,
    ``,
    `Hub: https://dayzpro.online`,
    `Lobby: https://dayzpro.online/dashboard`,
    `Shop: https://dayzpro.online/tools`,
    `War Room: https://dayzpro.online/war-room`,
    `Account / PSN link: https://dayzpro.online/account`,
    ``,
    `Open the hub with the same Discord login. If a name is missing, link it on Account.`,
  ].join("\n");
}

export const Route = createFileRoute("/api/admin/dayzpp-migrate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!authorized(request)) return Response.json({ error: "unauthorized" }, { status: 401 });
        const headers = botHeaders();
        if (!headers) return Response.json({ error: "DISCORD_TOKEN missing" }, { status: 500 });
        const guilds = (await (await fetch("https://discord.com/api/v10/users/@me/guilds", { headers })).json()) as Array<{ id: string; name?: string }>;
        const guildId = process.env.DISCORD_GUILD_ID || (Array.isArray(guilds) ? guilds[0]?.id : "");
        if (!guildId) return Response.json({ error: "no guild" }, { status: 500 });
        const members = await listGuildMembers(guildId, headers);
        const apiKey = process.env.DAYZPP_API_KEY || "";
        const imported = apiKey ? await tryDayzppUsers(apiKey) : { ok: false as const, data: null, url: "" };
        const store = await readJsonFile<EconomyStore>("economy.json", { accounts: {}, transfers: [] });
        const results: Array<{ id: string; username: string; dm: string; balance: number }> = [];
        for (const member of members) {
          const account = store.accounts[member.id] ?? {
            playerId: member.id,
            displayName: member.username,
            balance: 0,
            xp: 0,
          };
          account.displayName = member.username;
          store.accounts[member.id] = account;
          let dm = "skipped";
          try {
            const ch = await fetch("https://discord.com/api/v10/users/@me/channels", {
              method: "POST",
              headers,
              body: JSON.stringify({ recipient_id: member.id }),
            });
            const channel = (await ch.json()) as { id?: string; message?: string };
            if (channel.id) {
              const sent = await fetch(`https://discord.com/api/v10/channels/${channel.id}/messages`, {
                method: "POST",
                headers,
                body: JSON.stringify({ content: dmBody(member.username, [member.username], account.balance) }),
              });
              dm = sent.ok ? "sent" : `fail ${sent.status}`;
            } else {
              dm = channel.message || "no dm channel";
            }
          } catch (error) {
            dm = error instanceof Error ? error.message : "dm failed";
          }
          results.push({ id: member.id, username: member.username, dm, balance: account.balance });
          await new Promise((r) => setTimeout(r, 400));
        }
        await writeJsonFile("economy.json", store);
        return Response.json({
          guildId,
          members: members.length,
          dayzpp: imported.ok ? `hit ${imported.url}` : "DAYZPP_API_KEY missing or API denied — balances not copied yet",
          dms: {
            sent: results.filter((r) => r.dm === "sent").length,
            failed: results.filter((r) => r.dm !== "sent").length,
          },
          sample: results.slice(0, 8),
        });
      },
    },
  },
});
