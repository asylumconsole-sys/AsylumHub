import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/tools/zone-pick")({
  component: () => <Navigate to="/tools/base-map-clicker" replace />,
});
