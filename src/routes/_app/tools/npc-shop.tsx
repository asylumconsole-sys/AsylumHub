import { createFileRoute } from "@tanstack/react-router";
import { NPCShopContent } from "./npc-shop-content";

export const Route = createFileRoute("/_app/tools/npc-shop")({
  component: NPCShopContent,
});

export { NPCShopContent };
