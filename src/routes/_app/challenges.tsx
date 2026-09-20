import { createFileRoute, Link, Outlet, useChildMatches } from "@tanstack/react-router";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/_app/challenges")({
  component: ChallengesLayout,
  head: () => ({ meta: [{ title: `Challenges — ${BRAND.name}` }] }),
});

function ChallengesLayout() {
  const child = useChildMatches();
  const nested = child.length > 0;
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="text-[11px] uppercase tracking-[0.22em] text-primary">Challenges</div>
      <h1 className="font-display mt-1 text-4xl text-primary">Challenges</h1>
      <p className="mt-2 text-sm text-zinc-400">Field tasks. Clear them for credits.</p>
      {nested ? (
        <div className="mt-6">
          <Link to="/challenges" className="text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground">
            ← All challenges
          </Link>
          <div className="mt-4">
            <Outlet />
          </div>
        </div>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Link
            to="/challenges/zone-discovery"
            className="rounded-2xl border border-primary/30 bg-black/40 p-5 hover:border-primary/60"
          >
            <div className="text-[10px] uppercase tracking-[0.18em] text-primary">101x Livonia</div>
            <h2 className="mt-1 text-2xl text-foreground">Zone discovery</h2>
            <p className="mt-2 text-sm text-zinc-400">Visit the major cities. 2,500 cr each. Discord DM + hub notice when you clear a ring.</p>
          </Link>
        </div>
      )}
    </div>
  );
}
