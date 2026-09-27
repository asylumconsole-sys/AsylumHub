import { createFileRoute } from "@tanstack/react-router";
import { optionalUser } from "@/lib/shop/auth.server";
import { publicOrigin } from "@/lib/shop/catalog.server";
import { handle } from "@/lib/shop/mongo.server";
import { restartSchedule } from "@/lib/shop/status.server";
import { VEHICLE_LIMITS, VEHICLE_MODELS, vehicleCapacity } from "@/lib/shop/vehicles.server";

// GET /api/shop/vehicles: vehicle models (server prices), preset vehicle spots with availability for the next delivery restart.
export const Route = createFileRoute("/api/shop/vehicles")({
  server: {
    handlers: {
      GET: ({ request }) =>
        handle(async () => {
          const origin = publicOrigin(request);
          const restart = await restartSchedule();
          const user = await optionalUser(request).catch(() => null);
          const dry = !!(user?.test && !user.live); // flow-test users see (and book) the separate dry-run slots
          const cap = await vehicleCapacity(restart.nextDeliveryRestartAt, restart.cadenceHours, dry).catch(() => null);
          return {
            ok: true, currency: "CR", deliveryLabel: "Arrives at next server restart (every 2h)",
            note: "Spawns with all parts (wheels, doors, hood, trunk, battery, spark/glow plug, radiator, headlights). Fuel level is set by the game when a car spawns, so bring a canister.",
            limits: VEHICLE_LIMITS,
            restart,
            capacity: cap ? { used: cap.used, max: cap.max } : null,
            spots: cap?.spots ?? [],
            models: VEHICLE_MODELS.map((m) => ({
              ...m,
              variants: m.variants.map((v) => ({ ...v, id: v.classname, image: `/api/item-image/${v.classname}`, imageUrl: `${origin}/api/item-image/${v.classname}` })),
            })),
          };
        }),
    },
  },
});
