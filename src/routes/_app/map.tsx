import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/map")({
  beforeLoad: () => {
    throw redirect({ to: "/tools/base-map-clicker", replace: true });
  },
});
