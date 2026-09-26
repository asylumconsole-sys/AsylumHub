import { db, mongoConfigured } from "./mongo.server";

const H = 3600_000;
const WINDOW_CLOSE_MS = 3 * 60_000;

export type BridgeBeat = { at: Date; eta?: { next_restart_utc?: string; new_intent_target_utc?: string; cadence?: { cadence_hours?: number } }; armed?: boolean; version?: string };

let beatCache: { at: number; beat: BridgeBeat | null } | null = null;
export async function bridgeBeat(): Promise<BridgeBeat | null> {
  if (beatCache && Date.now() - beatCache.at < 15_000) return beatCache.beat;
  let beat: BridgeBeat | null = null;
  if (mongoConfigured()) beat = ((await (await db()).collection("shop_meta").findOne({ _id: "bridge" as never })) as BridgeBeat | null) ?? null;
  beatCache = { at: Date.now(), beat };
  return beat;
}

/** DayZ++ restarts every 2 h on even UTC hours (≈ :00:20). Prefer the box scheduler's learned cadence when it is fresh. */
export async function restartSchedule(now = Date.now()) {
  const beat = await bridgeBeat().catch(() => null);
  const fresh = !!beat && now - new Date(beat.at).getTime() < 5 * 60_000;
  const cad = (beat?.eta?.cadence?.cadence_hours || 2) * H;
  let next = Math.ceil(now / (2 * H)) * 2 * H + 20_000;
  const learned = fresh && beat?.eta?.next_restart_utc ? Date.parse(beat.eta.next_restart_utc) : NaN;
  if (Number.isFinite(learned)) {
    next = learned;
    while (next < now) next += cad;
  }
  const target = now > next - WINDOW_CLOSE_MS ? next + cad : next;
  const minute = (t: number) => new Date(Math.floor(t / 60_000) * 60_000).toISOString();
  return {
    nextRestartAt: minute(next),
    nextDeliveryRestartAt: minute(target),
    secondsToNextRestart: Math.max(0, Math.round((next - now) / 1000)),
    cadenceHours: cad / H,
    source: Number.isFinite(learned) ? "heartbeat-restart-log" : "even-utc-hours",
    bridgeOnline: fresh,
    bridgeLastSeen: beat?.at ? new Date(beat.at).toISOString() : null,
    liveUploadsArmed: fresh ? !!beat?.armed : false,
    label: "Arrives at next server restart (every 2h)",
  };
}

let playersCache: { at: number; v: unknown } | null = null;
export async function playerCount() {
  if (playersCache && Date.now() - playersCache.at < 30_000) return playersCache.v as { online: number | null; max: number | null; status: string };
  const token = process.env.NITRADO_API_TOKEN;
  const sid = process.env.NITRADO_SERVICE_101X || "17656048";
  let v = { online: null as number | null, max: null as number | null, status: "unknown" };
  if (token) {
    try {
      const res = await fetch(`https://api.nitrado.net/services/${sid}/gameservers`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(6000),
      });
      if (res.ok) {
        // only pick the three public fields; the response also carries credentials we must never store or echo
        const gs = ((await res.json()) as { data?: { gameserver?: { status?: string; query?: { player_current?: number; player_max?: number } } } }).data?.gameserver;
        v = { online: gs?.query?.player_current ?? null, max: gs?.query?.player_max ?? null, status: gs?.status ?? "unknown" };
      }
    } catch {
      /* keep unknown */
    }
  }
  playersCache = { at: Date.now(), v };
  return v;
}

export async function serverStatus() {
  const [players, restart] = await Promise.all([playerCount(), restartSchedule()]);
  return { ok: true, server: { id: "101x", name: "101x | ASYLUM · Livonia", map: "Livonia" }, players, restart };
}
