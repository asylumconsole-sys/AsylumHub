export type SpawnClientResult =
  | { mode: "live"; adapter: string; entity: string }
  | {
      mode: "restart_required";
      reason: string;
      eventName: string;
      restockSeconds: number;
      restarted: boolean;
      remaining?: number;
      waveLeft?: number;
    };

export async function postNpcSpawn(payload: {
  serviceId: string;
  serverId?: string;
  npcId: string;
  npcName?: string;
  x: number;
  z: number;
  a?: number;
  playerId?: string;
  playerName?: string;
  count?: number;
}): Promise<SpawnClientResult> {
  const res = await fetch("/api/npc/spawn", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = (await res.json().catch(() => ({}))) as SpawnClientResult & { error?: string };
  if (!res.ok) throw new Error(json.error || `Spawn failed (${res.status})`);
  if (!json.mode) throw new Error(json.error || "Spawn failed");
  return json;
}
