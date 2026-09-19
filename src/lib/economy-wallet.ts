export function walletCandidates(playerId?: string | null, userId?: string | null) {
  return [...new Set([playerId, userId, "demo-user"].filter((id): id is string => Boolean(id && id.trim()))];
}
