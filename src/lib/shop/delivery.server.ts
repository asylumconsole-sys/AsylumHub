import { Client } from "basic-ftp";
import { readJsonFile } from "@/lib/dayz/store";
import { ShopError } from "./mongo.server";
import { restartSchedule } from "./status.server";

export type Spot = { id: string; label: string; x: number; y: number; z: number };
/** Public roadside spots (vanilla truck spawn roads) with ground altitude from ADM. Override with SHOP_SAFE_SPOTS (JSON array). */
const DEFAULT_SPOTS: Spot[] = [
  { id: "road-078-058", label: "Roadside · grid 078/058 (east-central)", x: 7812.6, y: 246.5, z: 5889.5 },
  { id: "road-055-087", label: "Roadside · grid 055/087 (central)", x: 5521.1, y: 307.4, z: 8714.3 },
  { id: "road-025-055", label: "Roadside · grid 025/055 (west)", x: 2562.8, y: 396.8, z: 5521.3 },
  { id: "field-066-111", label: "Open ground · grid 066/111 (north)", x: 6655.6, y: 174.2, z: 11102.9 },
];
export function safeSpots(): Spot[] {
  try {
    const env = process.env.SHOP_SAFE_SPOTS ? (JSON.parse(process.env.SHOP_SAFE_SPOTS) as Spot[]) : null;
    if (Array.isArray(env) && env.length) return env.filter((s) => s.id && [s.x, s.y, s.z].every(Number.isFinite));
  } catch {
    /* fall back */
  }
  return DEFAULT_SPOTS;
}

type LinkStore = { byDiscordId: Record<string, { links?: Array<{ username: string; serverId: string }>; username?: string }> };
export async function linkedPsn(discordId: string): Promise<string | null> {
  const store = await readJsonFile<LinkStore>("bot-account-links.json", { byDiscordId: {} });
  const rec = store.byDiscordId[discordId];
  const l = rec?.links?.find((x) => x.serverId === "101") ?? rec?.links?.[0];
  // Only the bot-written link store (HUB_BOT_SECRET-authenticated) counts. Mongo players.psn is NOT used: it can be set
  // through an unauthenticated hub-api route, which would let someone claim another player's PSN and see their position.
  if (l?.username || rec?.username) return (l?.username || rec?.username) as string;
  return null;
}

let admCache: { at: number; files: Array<{ name: string; text: string }> } | null = null;
async function latestAdm() {
  if (admCache && Date.now() - admCache.at < 60_000) return admCache.files;
  const host = process.env.FTP_101X_HOST, user = process.env.FTP_101X_USER, password = process.env.FTP_101X_PASS;
  const dir = (process.env.FTP_101X_LOGS_PATH || "/dayzps/config").replace(/\/$/, "");
  if (!host || !user || !password) throw new ShopError(503, "adm_unavailable", "Server logs are not reachable right now; pick a safe spot");
  const client = new Client();
  client.ftp.timeout = 20_000;
  try {
    await client.access({ host, user, password, port: Number(process.env.FTP_101X_PORT || 21) });
    // ADM (admin) logs only — never RPT/script logs.
    const list = (await client.list(dir)).filter((f) => /\.ADM$/i.test(f.name)).sort((a, b) => b.name.localeCompare(a.name)).slice(0, 2);
    const files: Array<{ name: string; text: string }> = [];
    for (const f of list) {
      const chunks: Buffer[] = [];
      await client.downloadTo({ write(c: Buffer, _e: string, cb: () => void) { chunks.push(Buffer.from(c)); cb(); } } as never, `${dir}/${f.name}`);
      files.push({ name: f.name, text: Buffer.concat(chunks).toString("utf8") });
    }
    admCache = { at: Date.now(), files };
    return files;
  } finally {
    client.close();
  }
}

/** Caller's OWN linked PSN last ADM position. Never returns anyone else's position. */
export async function myLastPosition(discordId: string) {
  const psn = await linkedPsn(discordId);
  if (!psn) return { psn: null, position: null, reason: "No PSN linked to your Discord yet. Link it in Account, or pick a safe spot." };
  const files = await latestAdm();
  const want = psn.toLowerCase();
  const sched = await restartSchedule();
  const lastRestart = Date.parse(sched.nextRestartAt) - sched.cadenceHours * 3600_000;
  for (const f of files) {
    let hit: { x: number; z: number; alt: number; hms: string } | null = null;
    for (const line of f.text.split(/\r?\n/)) {
      const m = line.match(/^(\d\d:\d\d:\d\d)\s*\|\s*Player\s+"([^"]+)"[^\n]*?pos=<([\d.]+),\s*([\d.]+),\s*([\d.]+)>/);
      if (m && m[2].toLowerCase() === want) hit = { hms: m[1], x: +m[3], z: +m[4], alt: +m[5] };
    }
    if (!hit) continue;
    const fm = f.name.match(/(\d{4})-(\d\d)-(\d\d)_(\d\d)-(\d\d)-(\d\d)/);
    let at: number | null = null;
    if (fm) {
      const startAsUtc = Date.UTC(+fm[1], +fm[2] - 1, +fm[3], +fm[4], +fm[5], +fm[6]);
      const off = Number(process.env.SHOP_ADM_UTC_OFFSET_H ?? Math.round((startAsUtc - lastRestart) / 3600_000));
      const [h, mi, s] = hit.hms.split(":").map(Number);
      let t = Date.UTC(+fm[1], +fm[2] - 1, +fm[3], h, mi, s) - off * 3600_000;
      if (t < startAsUtc - off * 3600_000) t += 86400_000;
      at = t;
    }
    return {
      psn,
      position: { x: hit.x, z: hit.z, y: Math.round((hit.alt + 0.2) * 10) / 10, seenAt: at ? new Date(at).toISOString() : null, ageMinutes: at ? Math.max(0, Math.round((Date.now() - at) / 60000)) : null },
      reason: null,
    };
  }
  return { psn, position: null, reason: `No recent position for ${psn} in the current server logs. Join the server once, or pick a safe spot.` };
}

export async function deliveryOptions(discordId: string) {
  const mine = await myLastPosition(discordId).catch((e) => ({ psn: null, position: null, reason: e instanceof ShopError ? e.message : "Server logs unavailable" }));
  return { ok: true, lastPosition: mine, safeSpots: safeSpots(), note: "Arrives at next server restart (every 2h). Items appear on the ground at the chosen spot." };
}
