import { DAYZ_SERVERS, resolveServiceId } from "@/lib/dayz/servers";
import { readJsonFile } from "@/lib/dayz/store";
import { isBannedCannedTicket, shouldSkipRepeat } from "@/lib/ticket-ai";

type LinkStore = { byDiscordId: Record<string, { username?: string; links?: { username: string; serverId: string }[] }> };

const CONFIG_DIR = {
  "101x": "/games/ni12096544_1/ftproot/dayzps/config",
  "102x": "/games/ni12096544_2/ftproot/dayzps/config",
} as const;

function fold(value: string) {
  return value.toLowerCase().replace(/[\s_-]+/g, "");
}

async function linkedNames(discordId: string) {
  const store = await readJsonFile<LinkStore>("bot-account-links.json", { byDiscordId: {} });
  const row = store.byDiscordId[discordId];
  return [...new Set([...(row?.links ?? []).map((l) => l.username), row?.username].filter((n): n is string => Boolean(n?.trim())))];
}

async function downloadAdm(serverId: "101x" | "102x", names: string[]) {
  const token = process.env.NITRADO_API_TOKEN;
  if (!token || !names.length) return [] as string[];
  const catalog = DAYZ_SERVERS.find((s) => s.id === serverId);
  if (!catalog) return [];
  const serviceId = resolveServiceId(catalog);
  const dir = CONFIG_DIR[serverId];
  const list = await fetch(
    `https://api.nitrado.net/services/${serviceId}/gameservers/file_server/list?dir=${encodeURIComponent(`${dir}/`)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!list.ok) return [];
  const json = (await list.json()) as { data?: { entries?: Array<{ path?: string; name?: string }> } };
  const files = (json.data?.entries ?? [])
    .map((e) => e.path || `${dir}/${e.name || ""}`)
    .filter((p) => /\.(adm|rpt)$/i.test(p))
    .slice(0, 4);
  const wants = names.map(fold);
  const hits: string[] = [];
  for (const file of files) {
    const meta = (await fetch(
      `https://api.nitrado.net/services/${serviceId}/gameservers/file_server/download?file=${encodeURIComponent(file)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    ).then((r) => r.json())) as { data?: { url?: string; token?: { url?: string } } };
    const url = meta.data?.url ?? meta.data?.token?.url;
    if (!url) continue;
    const text = await fetch(url).then((r) => (r.ok ? r.text() : ""));
    for (const line of text.split(/\r?\n/)) {
      const f = fold(line);
      if (!wants.some((w) => w.length >= 2 && f.includes(w))) continue;
      if (/raid|built|placed|flag|killed|hit by|disconnected|connected/i.test(line)) {
        hits.push(`${serverId} · ${line.trim().slice(0, 180)}`);
      }
      if (hits.length >= 6) return hits;
    }
  }
  return hits;
}

export async function draftTicketReply(input: { discordId: string; content: string; priorBot?: string[] }) {
  const names = await linkedNames(input.discordId);
  const tag = names[0] || "";
  const [a, b] = await Promise.all([downloadAdm("101x", names), downloadAdm("102x", names)]);
  const hits = [...a, ...b];
  let text: string;
  if (/raid|base|boost|raided/i.test(input.content)) {
    if (hits.length) {
      text = tag
        ? `Checking ${tag}. Hits in ADM:\n${hits.slice(0, 4).join("\n")}\nIf that pin is the base, say 101 or 102 and we keep digging.`
        : `ADM hits:\n${hits.slice(0, 4).join("\n")}`;
    } else if (tag) {
      text = `Linked ${tag}. No ADM/RPT hit for that tag on 101/102 yet. Which server was the base on?`;
    } else {
      text = "Need the PSN on the account page so I can pull ADM. Which server, 101 or 102?";
    }
  } else if (hits.length) {
    text = `Got ${tag || "the tag"}. Latest ADM:\n${hits[0]}`;
  } else {
    text = tag ? `Linked ${tag}. What do you need looked at?` : "Link PSN on the Hub account page and tell me 101 or 102.";
  }
  if (isBannedCannedTicket(text) || shouldSkipRepeat(input.priorBot || [], text)) {
    text = tag ? `Still on ${tag}. Send 101 or 102 and I keep scanning.` : "Send 101 or 102.";
  }
  return { text, tag, hits, names };
}
