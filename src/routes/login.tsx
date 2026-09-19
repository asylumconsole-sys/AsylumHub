import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { GradientMesh } from "@/components/ui-custom/GradientMesh";
import { BRAND } from "@/lib/brand";
import { BrandHexLogo } from "@/components/app/BrandHexLogo";
import { buildDiscordAuthUrl } from "@/lib/discord-login";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: typeof s.redirect === "string" ? s.redirect : "/dashboard",
    mode: s.mode === "signup" ? ("signup" as const) : ("signin" as const),
    error: typeof s.error === "string" ? s.error : undefined,
  }),
  component: LoginPage,
});

const HEX_CLIP = "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)";

function LoginPage() {
  const search = Route.useSearch();
  const nav = useNavigate();
  const { session, loading } = useAuth();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!search.error) return;
    const messages: Record<string, string> = {
      missing_code: "Discord login was cancelled or missing a code.",
      discord_not_configured: "Discord OAuth is not configured on the server.",
      token_exchange_failed: "Discord token exchange failed. Check redirect URI.",
      missing_access_token: "Discord did not return an access token.",
      user_fetch_failed: "Could not fetch your Discord profile.",
    };
    toast.error(messages[search.error] || `Login error: ${search.error}`);
  }, [search.error]);

  const redirectTarget = typeof search.redirect === "string" && search.redirect ? search.redirect : "/dashboard";
  const safeRedirect = redirectTarget.startsWith("/") ? redirectTarget : `/${redirectTarget}`;

  useEffect(() => {
    if (!loading && session) {
      nav({ to: safeRedirect as string, replace: true });
    }
  }, [session, loading, nav, safeRedirect]);

  const discord = async () => {
    setBusy(true);
    try {
      const authUrl = await buildDiscordAuthUrl(safeRedirect);
      window.location.href = authUrl;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4">
      <GradientMesh />
      <FloatingOrbs />
      <HexConstellation />
      <div className="relative z-10 w-full max-w-[420px]">
        <div className="relative">
          <div className="pointer-events-none absolute -inset-px rounded-[28px] opacity-70 blur-xl" style={{ background: "conic-gradient(from 140deg, oklch(0.64 0.22 25 / 0.35), oklch(0.72 0.19 35 / 0.25), oklch(0.8 0.16 55 / 0.3), oklch(0.64 0.22 25 / 0.35))" }} />
          <div className="relative overflow-hidden rounded-[28px] p-8 md:p-9" style={{ background: "linear-gradient(155deg, oklch(1 0 0 / 0.09) 0%, oklch(1 0 0 / 0.04) 45%, oklch(0 0 0 / 0.15) 100%)", backdropFilter: "blur(40px) saturate(180%)", WebkitBackdropFilter: "blur(40px) saturate(180%)", border: "1px solid oklch(1 0 0 / 0.12)" }}>
            <div className="relative">
              <Link to="/" className="group mb-7 flex items-center justify-center gap-3 text-foreground">
                <BrandHexLogo size={52} />
                <span className="flex flex-col leading-none">
                  <span className="font-display text-2xl tracking-tight">{BRAND.name}</span>
                </span>
              </Link>
              <div className="space-y-5">
                <button type="button" onClick={discord} disabled={busy} className="group relative mt-7 flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-2xl px-4 py-3 text-sm font-medium transition disabled:opacity-50" style={{ background: "linear-gradient(160deg, oklch(1 0 0 / 0.08), oklch(1 0 0 / 0.03))", border: "1px solid oklch(1 0 0 / 0.14)" }}>
                  <DiscordMark />
                  <span className="relative">{busy ? "Connecting…" : "Continue with Discord"}</span>
                </button>
                <p className="text-center text-xs uppercase tracking-[0.2em] text-muted-foreground/70">Use your Discord account to continue</p>
              </div>
            </div>
          </div>
        </div>
        <p className="mt-6 text-center text-[10px] uppercase tracking-[0.3em] text-muted-foreground/50">Secured · Encrypted · Yours</p>
      </div>
    </div>
  );
}

function FloatingOrbs() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute h-[480px] w-[480px] rounded-full opacity-60" style={{ top: "-10%", left: "-8%", background: "radial-gradient(circle, oklch(0.64 0.22 25 / 0.55), transparent 65%)", filter: "blur(60px)" }} />
      <div className="absolute h-[420px] w-[420px] rounded-full opacity-55" style={{ bottom: "-12%", right: "-6%", background: "radial-gradient(circle, oklch(0.72 0.19 35 / 0.5), transparent 65%)", filter: "blur(70px)" }} />
    </div>
  );
}

function HexConstellation() {
  const hexes = [
    { size: 28, top: "15%", left: "12%" },
    { size: 18, top: "22%", left: "78%" },
    { size: 22, top: "70%", left: "10%" },
    { size: 16, top: "78%", left: "85%" },
  ];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {hexes.map((h, i) => (
        <div key={i} className="absolute" style={{ top: h.top, left: h.left, width: h.size, height: h.size * 1.1547, clipPath: HEX_CLIP, background: "linear-gradient(140deg, oklch(1 0 0 / 0.08), oklch(1 0 0 / 0.02))" }} />
      ))}
    </div>
  );
}

function DiscordMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="relative h-4 w-4" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M20.3 4.8a16.5 16.5 0 0 0-4.1-1.3l-.2.4c1.5.4 2.9 1 4.2 2l-.4.3a15.3 15.3 0 0 0-11.8 0 12.8 12.8 0 0 0 4.2-2l-.4-.3c-1.3-.9-2.7-1.6-4.2-2l-.2-.4A16.2 16.2 0 0 0 3.7 4.8C1.9 8.7 1.5 12.5 2 16.2c2.2 1.6 4.4 2.6 6.6 3.2.5-.7 1-1.4 1.4-2.2-.8-.3-1.5-.7-2.2-1.2l.5-.4c2.6 1.2 5.4 1.2 8 0l.5.4c-.7.5-1.4.9-2.2 1.2.4.8.9 1.5 1.4 2.2 2.2-.6 4.4-1.6 6.6-3.2.6-4.2.1-8.1-1.7-11.4ZM9.7 14.4c-.9 0-1.7-.8-1.7-1.8s.7-1.8 1.7-1.8c1 0 1.8.8 1.7 1.8 0 1-.7 1.8-1.7 1.8Zm4.6 0c-.9 0-1.7-.8-1.7-1.8s.7-1.8 1.7-1.8c1 0 1.8.8 1.7 1.8 0 1-.7 1.8-1.7 1.8Z" />
    </svg>
  );
}
