import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { readJsonFile, writeJsonFile } from "@/lib/dayz/store";

type ServerId = "101" | "102";

type AccountLink = {
  username: string;
  serverId: ServerId;
  linkedAt: string;
};

type AccountLinkRecord = {
  discordId: string;
  discordTag?: string;
  username?: string;
  serverId?: ServerId;
  links: AccountLink[];
  updatedAt: string;
};

type Store = {
  byDiscordId: Record<string, AccountLinkRecord>;
};

const STORE_FILE = "bot-account-links.json";
const DEFAULT_STORE: Store = { byDiscordId: {} };
const MAX_LINKS = 10;

function normalizeServerId(value: unknown): ServerId {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "102" || raw === "102x") return "102";
  return "101";
}

function normalizeUsername(value: unknown) {
  return String(value ?? "").trim().replace(/^@/, "");
}

export const getMyLinkedPlayernames = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data?: { discordId?: string }) => data ?? {})
  .handler(async ({ data, context }) => {
    const discordId = String(data?.discordId || context.userId || "").trim();
    if (!discordId) return { discordId: null, psn: null as string | null, links: [] as AccountLink[] };
    const store = await readJsonFile<Store>(STORE_FILE, DEFAULT_STORE);
    const record =
      store.byDiscordId[discordId] ??
      Object.values(store.byDiscordId).find((row) => row.discordId === discordId);
    const links = record?.links ?? [];
    const on101 = links.find((l) => l.serverId === "101") ?? links[0];
    return {
      discordId,
      psn: on101?.username ?? record?.username ?? null,
      links,
    };
  });

export const linkMyPsn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { discordId?: string; username?: string; serverId?: string; unlink?: boolean }) => data)
  .handler(async ({ data, context }) => {
    const discordId = String(data?.discordId || context.userId || "").trim();
    if (!discordId || discordId === "demo-user") {
      throw new Error("Sign in with Discord first");
    }
    const username = normalizeUsername(data?.username);
    const serverId = normalizeServerId(data?.serverId);
    const store = await readJsonFile<Store>(STORE_FILE, DEFAULT_STORE);
    const existing = store.byDiscordId[discordId];
    const now = new Date().toISOString();

    if (data?.unlink) {
      if (username) {
        const nextLinks = (existing?.links ?? []).filter((l) => {
          if (l.username.toLowerCase() !== username.toLowerCase()) return true;
          if (serverId && l.serverId !== serverId) return true;
          return false;
        });
        store.byDiscordId[discordId] = {
          discordId,
          discordTag: existing?.discordTag,
          username: nextLinks[0]?.username,
          serverId: nextLinks[0]?.serverId,
          links: nextLinks,
          updatedAt: now,
        };
      } else {
        delete store.byDiscordId[discordId];
      }
      await writeJsonFile(STORE_FILE, store);
      return { ok: true, psn: store.byDiscordId[discordId]?.links?.[0]?.username ?? null, links: store.byDiscordId[discordId]?.links ?? [] };
    }

    if (!username || username.length < 3) {
      throw new Error("Enter your PSN / Xbox gamertag");
    }

    let nextLinks: AccountLink[] = existing?.links ? [...existing.links] : [];
    const key = `${username.toLowerCase()}::${serverId}`;
    nextLinks = nextLinks.filter((l) => `${l.username.toLowerCase()}::${l.serverId}` !== key);
    nextLinks.push({ username, serverId, linkedAt: now });
    if (nextLinks.length > MAX_LINKS) nextLinks = nextLinks.slice(-MAX_LINKS);

    store.byDiscordId[discordId] = {
      discordId,
      discordTag: existing?.discordTag,
      username,
      serverId,
      links: nextLinks,
      updatedAt: now,
    };
    await writeJsonFile(STORE_FILE, store);
    return { ok: true, psn: username, links: nextLinks };
  });
