import { createFileRoute } from "@tanstack/react-router";
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

function json(data: unknown, status = 200) {
      return Response.json(data, { status });
}

function unauthorized() {
      return json({ error: "unauthorized" }, 401);
}

function badRequest(message: string) {
      return json({ error: message }, 400);
}

function authorize(request: Request) {
      const expected = process.env.HUB_BOT_SECRET;
      if (!expected) return false;
      const header = request.headers.get("authorization") || "";
      const match = header.match(/^Bearer\s+(.+)$/i);
      return Boolean(match && match[1] === expected);
}

function normalizeServerId(value: unknown): ServerId | null {
      const raw = String(value ?? "").trim().toLowerCase();
      if (raw === "101" || raw === "101x") return "101";
      if (raw === "102" || raw === "102x") return "102";
      return null;
}

function normalizeUsername(value: unknown) {
      return String(value ?? "").trim();
}

function normalizeLinks(links: unknown): AccountLink[] | null {
      if (!Array.isArray(links)) return null;
      const out: AccountLink[] = [];
      const seen = new Set<string>();
      for (const item of links) {
              if (!item || typeof item !== "object") continue;
              const username = normalizeUsername((item as AccountLink).username);
              const serverId = normalizeServerId((item as AccountLink).serverId);
              if (!username || !serverId) continue;
              const key = `${username.toLowerCase()}::${serverId}`;
              if (seen.has(key)) continue;
              seen.add(key);
              out.push({
                        username,
                        serverId,
                        linkedAt: String((item as AccountLink).linkedAt || new Date().toISOString()),
              });
              if (out.length >= MAX_LINKS) break;
      }
      return out;
}

export const Route = createFileRoute("/api/bot/account-links")({
      server: {
              handlers: {
                        GET: async ({ request }) => {
                                    if (!authorize(request)) return unauthorized();
                                    const url = new URL(request.url);
                                    const discordId = String(url.searchParams.get("discordId") || "").trim();
                                    if (!discordId) return badRequest("discordId is required");
                                    const store = await readJsonFile<Store>(STORE_FILE, DEFAULT_STORE);
                                    const record = store.byDiscordId[discordId];
                                    return json(
                                                  record ?? {
                                                                  discordId,
                                                                  links: [],
                                                                  updatedAt: null,
                                                  },
                                                );
                        },
                        POST: async ({ request }) => {
                                    if (!authorize(request)) return unauthorized();
                                    let body: Record<string, unknown>;
                                    try {
                                                  body = (await request.json()) as Record<string, unknown>;
                                    } catch {
                                                  return badRequest("invalid JSON body");
                                    }

                          const type = body?.type;
                                    if (type !== "account.link" && type !== "account.unlink") {
                                                  return badRequest('type must be "account.link" or "account.unlink"');
                                    }

                          const discordId = String(body?.discordId || "").trim();
                                    if (!discordId) return badRequest("discordId is required");

                          const discordTag = body?.discordTag != null ? String(body.discordTag) : undefined;
                                    const username = body?.username != null ? normalizeUsername(body.username) : undefined;
                                    const serverId = body?.serverId != null ? normalizeServerId(body.serverId) : null;
                                    if (body?.serverId != null && !serverId) return badRequest('serverId must be "101" or "102"');

                          const links = body?.links != null ? normalizeLinks(body.links) : null;
                                    if (body?.links != null && links == null) return badRequest("links must be an array");

                          const store = await readJsonFile<Store>(STORE_FILE, DEFAULT_STORE);
                                    const existing = store.byDiscordId[discordId];
                                    const now =
                                                  typeof body?.ts === "number" || typeof body?.ts === "string"
                                        ? new Date(body.ts as string | number).toISOString()
                                                    : new Date().toISOString();

                          if (type === "account.unlink" && (!links || links.length === 0) && !username) {
                                        delete store.byDiscordId[discordId];
                                        await writeJsonFile(STORE_FILE, store);
                                        return json({ ok: true, discordId, links: [], updatedAt: now });
                          }

                          let nextLinks: AccountLink[] = existing?.links ? [...existing.links] : [];

                          if (type === "account.unlink") {
                                        if (links && links.length) {
                                                        const remove = new Set(links.map((l) => `${l.username.toLowerCase()}::${l.serverId}`));
                                                        nextLinks = nextLinks.filter((l) => !remove.has(`${l.username.toLowerCase()}::${l.serverId}`));
                                        } else if (username) {
                                                        nextLinks = nextLinks.filter((l) => {
                                                                          if (l.username.toLowerCase() !== username.toLowerCase()) return true;
                                                                          if (serverId && l.serverId !== serverId) return true;
                                                                          return false;
                                                        });
                                        }
                          } else if (links) {
                                        nextLinks = links;
                          } else if (username && serverId) {
                                        const key = `${username.toLowerCase()}::${serverId}`;
                                        nextLinks = nextLinks.filter((l) => `${l.username.toLowerCase()}::${l.serverId}` !== key);
                                        nextLinks.push({ username, serverId, linkedAt: now });
                          } else {
                                        return badRequest("account.link requires links[] or username+serverId");
                          }

                          if (nextLinks.length > MAX_LINKS) {
                                        return badRequest(`max ${MAX_LINKS} links per Discord user`);
                          }

                          const record: AccountLinkRecord = {
                                        discordId,
                                        discordTag: discordTag ?? existing?.discordTag,
                                        username: username ?? existing?.username,
                                        serverId: serverId ?? existing?.serverId,
                                        links: nextLinks.slice(0, MAX_LINKS),
                                        updatedAt: now,
                          };
                                    store.byDiscordId[discordId] = record;
                                    await writeJsonFile(STORE_FILE, store);
                                    return json({ ok: true, ...record });
                        },
              },
      },
});
