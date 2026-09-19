import { createFileRoute } from "@tanstack/react-router";
import { NPCShopContent } from "./npc-shop-content";

export { NPCShopContent };

export const Route = createFileRoute("/_app/tools/npc-shop")({
  component: NPCShopContent,
});
