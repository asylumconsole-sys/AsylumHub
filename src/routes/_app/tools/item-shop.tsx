import { createFileRoute } from "@tanstack/react-router";
import { ItemShop } from "./ItemShop";

export const Route = createFileRoute("/_app/tools/item-shop")({
  component: ItemShop,
});

export { ItemShop as ItemShopContent };
