import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/tools/all-utms")({
  beforeLoad: () => {
    throw redirect({ to: "/tools/uav", replace: true });
  },
});
