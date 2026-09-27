/** Next scheduled 101x/102x restart — every 4 hours from 00:00 UTC. */
export function nextRestartAt(now = Date.now()) {
  const interval = 4 * 60 * 60 * 1000;
  return Math.ceil(now / interval) * interval;
}

export function formatRestartLeft(ms: number) {
  if (ms <= 0) return "restarting";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}h ${String(m).padStart(2, "0")}m ${String(sec).padStart(2, "0")}s`;
}
