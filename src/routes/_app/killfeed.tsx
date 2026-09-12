import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy path — Killfeed was renamed to Live. */
export const Route = createFileRoute("/_app/killfeed")({
  beforeLoad: () => {
    throw redirect({ to: "/live", replace: true });
  },
});
