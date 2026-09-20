import { createFileRoute } from "@tanstack/react-router";
import { DONATION_TIERS } from "@/lib/donation-tiers";

export const Route = createFileRoute("/api/discord/donation-roles")({
  server: {
    handlers: {
      POST: async () => {
        const token = process.env.DISCORD_TOKEN?.replace(/^Bot\s+/i, "");
        const guild = process.env.DISCORD_GUILD_ID;
        if (!token || !guild) return Response.json({ error: "Discord env missing" }, { status: 500 });
        const headers = { Authorization: `Bot ${token}`, "Content-Type": "application/json" };
        const existing = (await (await fetch(`https://discord.com/api/v10/guilds/${guild}/roles`, { headers })).json()) as Array<{ name: string; id: string }>;
        const have = new Set((existing || []).map((r) => r.name));
        const created: string[] = [];
        for (const tier of DONATION_TIERS) {
          if (have.has(tier.name)) continue;
          const res = await fetch(`https://discord.com/api/v10/guilds/${guild}/roles`, {
            method: "POST",
            headers,
            body: JSON.stringify({ name: tier.name, color: tier.color, mentionable: true, hoist: true }),
          });
          if (res.ok) created.push(tier.name);
          await new Promise((r) => setTimeout(r, 350));
        }
        return Response.json({ ok: true, created });
      },
    },
  },
});
