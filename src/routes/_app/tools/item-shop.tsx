import { createFileRoute } from "@tanstack/react-router";
import { ShopStore } from "@/components/shop/ShopStore";

// /tools/item-shop?cart=akm:2,bandage:3&source=discord-activity prefills the cart (Discord Activity hand-off).
export const Route = createFileRoute("/_app/tools/item-shop")({
  component: () => <ShopStore />,
});
