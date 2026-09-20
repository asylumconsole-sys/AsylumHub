import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { DONATION_TIERS, hexColor } from "@/lib/donation-tiers";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/_app/donate")({
  component: DonatePage,
});

function DonatePage() {
  useEffect(() => {
    void fetch("/api/discord/donation-roles", { method: "POST" });
  }, []);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div>
        <div className="text-[11px] uppercase tracking-[0.28em] text-primary">Support {BRAND.name}</div>
        <h1 className="font-display mt-2 text-5xl">Donate</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Each tier gets a Discord role with the same name. $10 marks a 10k supporter, $500 marks 500k — higher gifts get colder, brighter colors.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {DONATION_TIERS.map((tier) => (
          <div key={tier.name} className="rounded-2xl border p-4" style={{ borderColor: `${hexColor(tier.color)}55`, background: `${hexColor(tier.color)}12` }}>
            <div className="flex items-baseline justify-between">
              <div className="font-display text-3xl" style={{ color: hexColor(tier.color) }}>{tier.name}</div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">{tier.creditsMark}</div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Discord role {tier.name}</p>
            <a
              href={`https://discord.com/channels/@me`}
              className="mt-4 inline-flex rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-black"
              style={{ background: hexColor(tier.color) }}
            >
              Donate {tier.name}
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
