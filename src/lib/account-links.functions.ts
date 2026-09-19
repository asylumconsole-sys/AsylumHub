import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { readJsonFile } from "@/lib/dayz/store";

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
