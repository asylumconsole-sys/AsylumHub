import { createFileRoute, Navigate } from "@tanstack/react-router";

const TOOL_REDIRECTS: Record<string, { to: string; search?: Record<string, string> }> = {
  "hackathon-request": { to: "/tools/event-intake" },
  "hackathon": { to: "/tools/event-intake" },
  "naming": { to: "/tools/taxonomy" },
  "automations": { to: "/connectors" },
  "zone-pick": { to: "/tools/base-map-clicker" },
};

export const Route = createFileRoute("/_app/tools/$")({
  component: ToolsCatchAll,
});

function ToolsCatchAll() {
  const { _splat } = Route.useParams();
  const slug = (_splat ?? "").split("/")[0];
  const hit = TOOL_REDIRECTS[slug];
  const target = hit ?? { to: "/tools" };
  const props = {
    to: target.to,
    search: target.search ?? {},
    replace: true,
  } as unknown as Parameters<typeof Navigate>[0];
  return <Navigate {...props} />;
}
