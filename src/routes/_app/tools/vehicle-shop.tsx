import { createFileRoute } from "@tanstack/react-router";
import { VehicleShopContent } from "./vehicle-shop-content";

export const Route = createFileRoute("/_app/tools/vehicle-shop")({
  component: VehicleShopContent,
});

export { VehicleShopContent };
