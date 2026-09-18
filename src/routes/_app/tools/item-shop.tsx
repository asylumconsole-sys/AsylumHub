import { createFileRoute } from "@tanstack/react-router";
import { ItemShopContent } from "./item-shop-content";

export const Route = createFileRoute("/_app/tools/item-shop")({
  component: ItemShopContent,
});

export { ItemShopContent };
