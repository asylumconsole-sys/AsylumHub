import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function botHeaders() {
  const token = process.env.DISCORD_TOKEN?.replace(/^Bot\s+/i, "");
  if (!token) throw new Error("DISCORD_TOKEN missing");
  return { Authorization: `Bot ${token}`, "Content-Type": "application/json" };
}

async function guildId(headers: Record<string, string>) {
  if (process.env.DISCORD_GUILD_ID) return process.env.DISCORD_GUILD_ID;
  const guilds = (await (await fetch("https://discord.com/api/v10/users/@me/guilds", { headers })).json()) as Array<{ id: string }>;
  if (!Array.isArray(guilds) || !guilds[0]?.id) throw new Error("Bot is in no guild");
  return guilds[0].id;
}

function hexToInt(hex: string) {
  const clean = hex.replace("#", "").trim();
  const n = Number.parseInt(clean, 16);
  if (!Number.isFinite(n)) throw new Error("Bad color");
  return n;
}

export const applyFactionRoleStyle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { factionName: string; mode: "solid" | "gradient" | "holographic"; primary: string; secondary?: string; tertiary?: string }) => d)
  .handler(async ({ data }) => {
    const headers = botHeaders();
    const gid = await guildId(headers);
    const name = data.factionName.trim().slice(0, 32);
    if (!name) throw new Error("Faction name required");
    const roles = (await (await fetch(`https://discord.com/api/v10/guilds/${gid}/roles`, { headers })).json()) as Array<{ id: string; name: string }>;
    if (!Array.isArray(roles)) throw new Error("Could not list roles");
    let role = roles.find((r) => r.name.toLowerCase() === name.toLowerCase());
    if (!role) {
      const created = await fetch(`https://discord.com/api/v10/guilds/${gid}/roles`, {
        method: "POST",
        headers,
        body: JSON.stringify({ name, mentionable: true }),
      });
      const body = await created.json();
      if (!created.ok) throw new Error(body?.message || "Could not create faction role");
      role = { id: body.id, name: body.name };
    }
    const primary = hexToInt(data.primary);
    const payload: Record<string, unknown> = { color: primary };
    if (data.mode === "gradient" || data.mode === "holographic") {
      payload.colors = {
        primary_color: primary,
        secondary_color: hexToInt(data.secondary || "#7c3aed"),
        tertiary_color: data.mode === "holographic" ? hexToInt(data.tertiary || "#22d3ee") : null,
      };
    }
    const patched = await fetch(`https://discord.com/api/v10/guilds/${gid}/roles/${role.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(payload),
    });
    const out = await patched.json();
    if (!patched.ok) throw new Error(out?.message || "Discord rejected the role style");
    return { ok: true as const, roleId: role.id, name: role.name, mode: data.mode };
  });
