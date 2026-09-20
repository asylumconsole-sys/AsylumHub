import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/challenges/")({
  component: ChallengesIndex,
});

function ChallengesIndex() {
  return (
    <div>
      <h1 className="font-display text-4xl text-primary">Challenges</h1>
      <p className="mt-2 text-sm text-zinc-400">Field tasks. Clear them for credits.</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Link to="/challenges/zone-discovery" className="rounded-2xl border border-primary/30 bg-black/40 p-5 hover:border-primary/60">
          <div className="text-[10px] uppercase tracking-[0.18em] text-primary">101x Livonia</div>
          <h2 className="mt-1 text-2xl text-foreground">Zone discovery</h2>
          <p className="mt-2 text-sm text-zinc-400">Visit the major cities. 2,500 cr each. Discord DM + hub notice when you clear a ring.</p>
        </Link>
      </div>
    </div>
  );
}
