import { ShopStore } from "@/components/shop/ShopStore";

// Vehicle shop: same Discord wallet, cart, checkout and order tracking as the item shop.
// Vehicles are delivered by the box bridge as a CE vehicle event at a preset vehicle spot on the next restart.
export function VehicleShopContent() {
  return <ShopStore mode="vehicles" />;
}
