import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/battlepass")({
  component: BattlepassComingSoon,
});

function BattlepassComingSoon() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 text-center">
      <div className="text-[11px] uppercase tracking-[0.28em] text-primary">Season 1</div>
      <h1 className="font-display mt-3 text-5xl sm:text-7xl">COMING SOON</h1>
      <p className="mt-4 text-sm text-muted-foreground">Battlepass rewards are locked until the next season drop.</p>
      <Link to="/dashboard" className="mt-8 rounded-full border border-glass-border px-5 py-2 text-xs uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground">Back to lobby</Link>
    </div>
  );
}
