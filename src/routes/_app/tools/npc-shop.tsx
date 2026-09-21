import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { NPCShopContent } from "./npc-shop-content";

export const Route = createFileRoute("/_app/tools/npc-shop")({
  validateSearch: z.object({ maker: z.union([z.boolean(), z.string()]).optional() }),
  component: NpcShopPage,
});

function NpcShopPage() {
  const { maker } = Route.useSearch();
  const startOnBuilder = maker === true || maker === "1" || maker === "true";
  return <NPCShopContent startOnBuilder={startOnBuilder} />;
}

export { NPCShopContent };
