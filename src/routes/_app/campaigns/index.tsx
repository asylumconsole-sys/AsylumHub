import { createFileRoute, redirect } from "@tanstack/react-router";

/** Sidebar still labeled Operations used to open the old campaigns grid. */
export const Route = createFileRoute("/_app/campaigns/")({
  beforeLoad: () => {
    throw redirect({ to: "/operations", replace: true });
  },
});
