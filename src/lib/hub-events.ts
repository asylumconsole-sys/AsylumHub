export type HubServerId = "101" | "102";

export type HubEventPayload = {
  type: string;
  playerId: string;
  playerName: string;
  serverId: HubServerId | null;
  ts: number;
  meta: Record<string, unknown>;
};

const HUB_EVENT_TIMEOUT_MS = 5_000;

/**
 * Send a hub event to the optional Discord Manager webhook without making the
 * caller wait for, or depend on, the webhook's availability.
 */
export function emitHubEvent(payload: HubEventPayload): void {
  const url = process.env.DISCORD_HUB_EVENTS_URL;
  if (!url) return;

  void (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HUB_EVENT_TIMEOUT_MS);

    try {
      const secret = process.env.HUB_BOT_SECRET;
      await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch {
      // Webhook delivery is best effort and must never break a hub action.
    } finally {
      clearTimeout(timeout);
    }
  })();
}
