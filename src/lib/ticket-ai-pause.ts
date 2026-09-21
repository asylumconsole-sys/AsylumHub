import { readJsonFile, writeJsonFile } from "@/lib/dayz/store";
import { discordGet, discordPost } from "@/lib/staff-embed";

const FILE = "ticket-ai-pause.json";
const ANNOUNCE_CHANNEL = "1371150773857288324";

type PauseStore = { paused: boolean; updatedAt: string; by?: string };

export async function isTicketAiPaused() {
  const store = await readJsonFile<PauseStore>(FILE, { paused: false, updatedAt: "" });
  return Boolean(store.paused);
}

export async function setTicketAiPaused(paused: boolean, by = "system") {
  const store: PauseStore = { paused, updatedAt: new Date().toISOString(), by };
  await writeJsonFile(FILE, store);
  return store;
}

export function aioffReply(paused: boolean) {
  return paused
    ? "PRO AI ticket replies are **OFF**. Staff only until `/aion`."
    : "PRO AI ticket replies are **ON** again.";
}

export async function registerAiToggleCommands() {
  const appId = process.env.DISCORD_CLIENT_ID || process.env.VITE_DISCORD_CLIENT_ID || "";
  if (!appId) return { ok: false, error: "no application id" };
  const channel = (await discordGet(`/channels/${ANNOUNCE_CHANNEL}`)) as { guild_id?: string } | null;
  const guildId = channel?.guild_id;
  if (!guildId) return { ok: false, error: "no guild id" };
  await discordPost(`/applications/${appId}/guilds/${guildId}/commands`, {
    name: "aioff",
    description: "Pause PRO AI ticket replies",
  });
  await discordPost(`/applications/${appId}/guilds/${guildId}/commands`, {
    name: "aion",
    description: "Resume PRO AI ticket replies",
  });
  return { ok: true, guildId };
}
