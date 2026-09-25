import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { readJsonFile, writeJsonFile } from "@/lib/dayz/store";

export type FactionProfile = {
  name: string;
  flag: string;
  map: "101x" | "102x";
  members: string[];
  ownerId: string;
};

type Store = { byOwner: Record<string, FactionProfile> };
const EMPTY: Store = { byOwner: {} };

export async function loadFactionProfiles() {
  return readJsonFile<Store>("faction-profiles.json", EMPTY);
}

export const getMyFaction = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { playerId?: string }) => data)
  .handler(async ({ data, context }) => {
    const playerId = data.playerId || context.userId || "";
    const store = await loadFactionProfiles();
    return store.byOwner[playerId] ?? null;
  });

export const saveMyFaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { playerId?: string; name: string; flag: string; map?: "101x" | "102x" }) => data)
  .handler(async ({ data, context }) => {
    const playerId = data.playerId || context.userId || "";
    const name = data.name.trim();
    if (!name) throw new Error("Faction name required");
    const store = await loadFactionProfiles();
    const prev = store.byOwner[playerId];
    store.byOwner[playerId] = {
      name,
      flag: data.flag,
      map: data.map || prev?.map || "101x",
      members: prev?.members ?? [],
      ownerId: playerId,
    };
    await writeJsonFile("faction-profiles.json", store);
    return store.byOwner[playerId];
  });
