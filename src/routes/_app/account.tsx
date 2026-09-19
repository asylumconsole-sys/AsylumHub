import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/contexts/AuthContext";
import { PsnLinkCard } from "@/components/app/PsnLinkCard";

export const Route = createFileRoute("/_app/account")({
  component: AccountPage,
});

function AccountPage() {
  const { user, signOut } = useAuth();
  const name =
    (typeof user?.user_metadata?.name === "string" && user.user_metadata.name) ||
    user?.email ||
    "Signed in";

  return (
    <div className="mx-auto w-full max-w-lg space-y-4 px-1 pb-8 sm:px-0">
      <header className="pt-1">
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Account</div>
        <h1 className="mt-1 font-display text-3xl tracking-tight">Your profile</h1>
        <p className="mt-1 truncate text-sm text-muted-foreground">{name}</p>
      </header>

      <PsnLinkCard />

      <section className="rounded-2xl border border-glass-border bg-glass/40 p-4">
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">More</div>
        <div className="mt-3 grid grid-cols-1 gap-2">
          <Link to="/tools/npc-shop" className="rounded-xl border border-glass-border px-4 py-3 text-sm">
            NPC Shop
          </Link>
          <Link to="/settings" search={{ tab: "account" }} className="rounded-xl border border-glass-border px-4 py-3 text-sm">
            Full settings
          </Link>
          <button
            type="button"
            onClick={() => signOut()}
            className="rounded-xl border border-glass-border px-4 py-3 text-left text-sm text-red-300"
          >
            Sign out
          </button>
        </div>
      </section>
    </div>
  );
}
