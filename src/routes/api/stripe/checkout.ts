import { createFileRoute } from "@tanstack/react-router";
import { DONATION_TIERS } from "@/lib/donation-tiers";

export const Route = createFileRoute("/api/stripe/checkout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.STRIPE_SECRET_KEY;
        if (!secret) return Response.json({ error: "Stripe is not configured. Add STRIPE_SECRET_KEY on Railway." }, { status: 500 });
        const body = (await request.json().catch(() => ({}))) as { usd?: number; method?: string };
        const tier = DONATION_TIERS.find((t) => t.usd === Number(body.usd));
        if (!tier) return Response.json({ error: "Unknown donation amount" }, { status: 400 });
        const origin = new URL(request.url).origin;
        const method = String(body.method || "auto");
        const params = new URLSearchParams();
        params.set("mode", "payment");
        params.set("success_url", `${origin}/dashboard?donated=${tier.usd}`);
        params.set("cancel_url", `${origin}/dashboard`);
        params.set("line_items[0][quantity]", "1");
        params.set("line_items[0][price_data][currency]", "usd");
        params.set("line_items[0][price_data][unit_amount]", String(tier.usd * 100));
        params.set("line_items[0][price_data][product_data][name]", `DAYZ PRO donation ${tier.name}`);
        params.set("metadata[tier]", tier.name);
        params.set("metadata[creditsMark]", tier.creditsMark);
        params.set("allow_promotion_codes", "true");
        if (method === "paypal") params.append("payment_method_types[0]", "paypal");
        else if (method === "cashapp") params.append("payment_method_types[0]", "cashapp");
        else if (method === "venmo") params.append("payment_method_types[0]", "venmo");
        else {
          params.append("payment_method_types[0]", "card");
          params.append("payment_method_types[1]", "paypal");
          params.append("payment_method_types[2]", "cashapp");
          params.append("payment_method_types[3]", "link");
        }
        const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${secret}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: params,
        });
        const data = (await res.json()) as { id?: string; url?: string; error?: { message: string } };
        if (!res.ok || !data.url) return Response.json({ error: data.error?.message || "Stripe checkout failed" }, { status: 400 });
        return Response.json({ url: data.url });
      },
    },
  },
});
