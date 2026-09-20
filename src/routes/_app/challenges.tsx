import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/_app/challenges")({
  component: ChallengesLayout,
  head: () => ({ meta: [{ title: `Challenges — ${BRAND.name}` }] }),
});

function ChallengesLayout() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link to="/challenges" className="text-[11px] uppercase tracking-[0.22em] text-primary">
        Challenges
      </Link>
      <div className="mt-4">
        <Outlet />
      </div>
    </div>
  );
}
