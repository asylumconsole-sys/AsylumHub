import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getKillfeed, getLiveEvents } from "@/lib/killfeed.functions";

export type RewardStats = {
	playerId: string;
	displayName: string;
	kills: number;
	headshotKills: number;
	longRange400Kills: number;
	longRange600Kills: number;
	longRange1000Kills: number;
	deaths: number;
	spawnKills: number;
	carDestroys: number;
	animalKills: number;
	combatLogs: number;
};

function emptyStats(playerId: string, displayName?: string): RewardStats {
	return {
		playerId,
		displayName: displayName?.trim() || (playerId === "demo-user" ? "Asylum Demo" : playerId),
		kills: 0,
		headshotKills: 0,
		longRange400Kills: 0,
		longRange600Kills: 0,
		longRange1000Kills: 0,
		deaths: 0,
		spawnKills: 0,
		carDestroys: 0,
		animalKills: 0,
		combatLogs: 0,
	};
}

function samePlayer(left: string | undefined, right: string) {
	return left?.trim().toLocaleLowerCase() === right.trim().toLocaleLowerCase();
}

function incrementLoggedSpecialEvents(stats: RewardStats, raw: string) {
	if (/spawn\s*kill/i.test(raw)) stats.spawnKills += 1;
	if (/combat\s*log/i.test(raw)) stats.combatLogs += 1;
	if (/(?:car|vehicle)\s+(?:destroyed|destroy)/i.test(raw)) stats.carDestroys += 1;
	if (/(?:animal|wolf|bear|deer|boar|cow|goat|chicken)\s+(?:killed|slain)/i.test(raw)) stats.animalKills += 1;
}

export const getRewardStats = createServerFn({ method: "GET" })
	.middleware([requireSupabaseAuth])
	.inputValidator((data: { playerId?: string; playerName?: string; displayName?: string }) => data)
	.handler(async ({ data, context }) => {
		const playerId = data.playerId ?? context.userId ?? "demo-user";
		const playerName = data.playerName?.trim();
		const stats = emptyStats(playerId, playerName || data.displayName);
		if (!playerName) return stats;

		const [kills, live] = await Promise.all([
			getKillfeed({ data: { server: "all", limit: 300 } }),
			getLiveEvents({ data: { server: "all", limit: 400 } }),
		]);
		for (const event of kills.events) {
			if (samePlayer(event.killer, playerName)) {
				stats.kills += 1;
				if (/head\s*shot/i.test(event.raw)) stats.headshotKills += 1;
				if ((event.distance ?? 0) >= 1000) stats.longRange1000Kills += 1;
				else if ((event.distance ?? 0) >= 600) stats.longRange600Kills += 1;
				else if ((event.distance ?? 0) >= 400) stats.longRange400Kills += 1;
				incrementLoggedSpecialEvents(stats, event.raw);
			}
			if (samePlayer(event.victim, playerName)) stats.deaths += 1;
		}
		for (const event of live.events) {
			if (event.kind !== "other" || !samePlayer(event.actor, playerName)) continue;
			incrementLoggedSpecialEvents(stats, event.raw);
		}
		return stats;
	});