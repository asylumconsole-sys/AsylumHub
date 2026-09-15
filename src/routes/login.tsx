import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { createDemoSession, DEMO_SESSION_KEY, useAuth } from "@/contexts/AuthContext";
import { GradientMesh } from "@/components/ui-custom/GradientMesh";
import { BRAND } from "@/lib/brand";
import { BrandHexLogo } from "@/components/app/BrandHexLogo";
import { buildDiscordAuthUrl } from "@/lib/discord-login";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: typeof s.redirect === "string" ? s.redirect : "/dashboard",
    mode: s.mode === "signup" ? ("signup" as const) : ("signin" as const),
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
    if (session?.access_token === "demo-access-token") {
      localStorage.removeItem(DEMO_SESSION_KEY);
      window.location.reload();
      return;
    }
    if (!loading && session) {
      nav({ to: search.redirect as "/dashboard", replace: true });
    }
  }, [session, loading, nav, search.redirect]);

  const discord = async () => {
    setBusy(true);
    try {
      const authUrl = buildDiscordAuthUrl(search.redirect as string);
      window.location.href = authUrl;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  };

  const demoLogin = () => {
    const session = createDemoSession();
    localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(session));
    nav({ to: search.redirect as "/dashboard", replace: true });
  };

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4">
      <GradientMesh />

      {/* Floating refractive orbs */}
      <FloatingOrbs />

      {/* Ambient hex constellation */}
      <HexConstellation />

      <div className="relative z-10 w-full max-w-[420px]">


        {/* Liquid glass card */}
        <div className="relative">
          {/* Outer chromatic halo */}
          <div
            className="pointer-events-none absolute -inset-px rounded-[28px] opacity-70 blur-xl"
            style={{
              background:
                "conic-gradient(from 140deg, oklch(0.64 0.22 25 / 0.35), oklch(0.72 0.19 35 / 0.25), oklch(0.8 0.16 55 / 0.3), oklch(0.64 0.22 25 / 0.35))",
            }}
          />
          {/* Card */}
          <div
            className="relative overflow-hidden rounded-[28px] p-8 md:p-9"
            style={{
              background:
                "linear-gradient(155deg, oklch(1 0 0 / 0.09) 0%, oklch(1 0 0 / 0.04) 45%, oklch(0 0 0 / 0.15) 100%)",
              backdropFilter: "blur(40px) saturate(180%)",
              WebkitBackdropFilter: "blur(40px) saturate(180%)",
              border: "1px solid oklch(1 0 0 / 0.12)",
              boxShadow:
                "inset 0 1px 0 oklch(1 0 0 / 0.14), inset 0 -1px 0 oklch(0 0 0 / 0.3), 0 40px 80px -20px oklch(0 0 0 / 0.6), 0 0 60px -10px oklch(0.64 0.22 25 / 0.25)",
            }}
          >
            {/* Specular sheen */}
            <div
              className="pointer-events-none absolute -top-1/2 left-0 h-full w-full rotate-12"
              style={{
                background: "linear-gradient(180deg, oklch(1 0 0 / 0.08) 0%, transparent 60%)",
                filter: "blur(20px)",
              }}
            />
            {/* Top edge highlight */}
            <div
              className="pointer-events-none absolute inset-x-8 top-0 h-px"
              style={{
                background: "linear-gradient(90deg, transparent, oklch(1 0 0 / 0.5), transparent)",
              }}
            />

            <div className="relative">
              <Link
                to="/"
                className="group mb-7 flex items-center justify-center gap-3 text-foreground"
              >
                <BrandHexLogo size={52} />
                <span className="flex flex-col leading-none">
                  <span className="font-display text-2xl tracking-tight">{BRAND.name}</span>
                </span>
              </Link>

              <div className="space-y-5">
                <button
                  type="button"
                  onClick={discord}
                  disabled={busy}
                  className="group relative mt-7 flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-2xl px-4 py-3 text-sm font-medium transition disabled:opacity-50"
                  style={{
                    background:
                      "linear-gradient(160deg, oklch(1 0 0 / 0.08), oklch(1 0 0 / 0.03))",
                    border: "1px solid oklch(1 0 0 / 0.14)",
                    backdropFilter: "blur(20px)",
                    boxShadow:
                      "inset 0 1px 0 oklch(1 0 0 / 0.1), 0 4px 16px -4px oklch(0 0 0 / 0.4)",
                  }}
                >
                  <span
                    className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100"
                    style={{
                      background:
                        "radial-gradient(circle at 50% 0%, oklch(1 0 0 / 0.12), transparent 70%)",
                    }}
                  />
                  <DiscordMark />
                  <span className="relative">{busy ? "Connecting…" : "Continue with Discord"}</span>
                </button>

                <button
                  type="button"
                  onClick={demoLogin}
                  className="flex w-full items-center justify-center gap-2.5 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm font-medium text-amber-100 transition hover:bg-amber-500/15"
                >
                  Enter demo hub
                </button>

                <p className="text-center text-xs uppercase tracking-[0.2em] text-muted-foreground/70">
                  Use your Discord account to continue
                </p>
              </div>
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-[10px] uppercase tracking-[0.3em] text-muted-foreground/50">
          Secured · Encrypted · Yours
        </p>
      </div>
    </div>
  );
}

function GlassField({
  label,
  type,
  value,
  onChange,
  required,
  minLength,
  autoComplete,
  trailing,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  minLength?: number;
  autoComplete?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground/80">
          {label}
        </span>
        {trailing}
      </div>
      <div
        className="group relative overflow-hidden rounded-xl transition focus-within:ring-1 focus-within:ring-primary/40"
        style={{
          background: "linear-gradient(160deg, oklch(0 0 0 / 0.25), oklch(0 0 0 / 0.1))",
          border: "1px solid oklch(1 0 0 / 0.1)",
          boxShadow: "inset 0 1px 0 oklch(1 0 0 / 0.06), inset 0 -1px 0 oklch(0 0 0 / 0.2)",
        }}
      >
        <input
          type={type}
          required={required}
          minLength={minLength}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
        />
      </div>
    </label>
  );
}

function FloatingOrbs() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div
        className="absolute h-[480px] w-[480px] rounded-full opacity-60"
        style={{
          top: "-10%",
          left: "-8%",
          background: "radial-gradient(circle, oklch(0.64 0.22 25 / 0.55), transparent 65%)",
          filter: "blur(60px)",
          animation: "orb-drift-a 22s ease-in-out infinite",
        }}
      />
      <div
        className="absolute h-[420px] w-[420px] rounded-full opacity-55"
        style={{
          bottom: "-12%",
          right: "-6%",
          background: "radial-gradient(circle, oklch(0.72 0.19 35 / 0.5), transparent 65%)",
          filter: "blur(70px)",
          animation: "orb-drift-b 26s ease-in-out infinite",
        }}
      />
      <div
        className="absolute h-[360px] w-[360px] rounded-full opacity-40"
        style={{
          top: "30%",
          right: "20%",
          background: "radial-gradient(circle, oklch(0.8 0.16 55 / 0.35), transparent 65%)",
          filter: "blur(80px)",
          animation: "orb-drift-c 30s ease-in-out infinite",
        }}
      />
      <style>{`
        @keyframes orb-drift-a {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(40px, 60px) scale(1.08); }
        }
        @keyframes orb-drift-b {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-50px, -40px) scale(1.1); }
        }
        @keyframes orb-drift-c {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-30px, 40px) scale(0.92); }
        }
      `}</style>
    </div>
  );
}

function HexConstellation() {
  const hexes = [
    { size: 28, top: "15%", left: "12%", delay: 0 },
    { size: 18, top: "22%", left: "78%", delay: 1.2 },
    { size: 22, top: "70%", left: "10%", delay: 2.4 },
    { size: 16, top: "78%", left: "85%", delay: 0.6 },
    { size: 36, top: "55%", left: "6%", delay: 1.8 },
    { size: 14, top: "40%", left: "90%", delay: 3 },
  ];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {hexes.map((h, i) => (
        <div
          key={i}
          className="absolute"
          style={{
            top: h.top,
            left: h.left,
            width: h.size,
            height: h.size * 1.1547,
            clipPath: HEX_CLIP,
            background: "linear-gradient(140deg, oklch(1 0 0 / 0.08), oklch(1 0 0 / 0.02))",
            border: "1px solid oklch(1 0 0 / 0.06)",
            animation: `hex-float 8s ease-in-out ${h.delay}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes hex-float {
          0%, 100% { transform: translateY(0) rotate(0deg); opacity: 0.5; }
          50% { transform: translateY(-14px) rotate(8deg); opacity: 0.9; }
        }
      `}</style>
    </div>
  );
}

function DiscordMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="relative h-4 w-4"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M20.3 4.8a16.5 16.5 0 0 0-4.1-1.3l-.2.4c1.5.4 2.9 1 4.2 2l-.4.3a15.3 15.3 0 0 0-11.8 0 12.8 12.8 0 0 0 4.2-2l-.4-.3c-1.3-.9-2.7-1.6-4.2-2l-.2-.4A16.2 16.2 0 0 0 3.7 4.8C1.9 8.7 1.5 12.5 2 16.2c2.2 1.6 4.4 2.6 6.6 3.2.5-.7 1-1.4 1.4-2.2-.8-.3-1.5-.7-2.2-1.2l.5-.4c2.6 1.2 5.4 1.2 8 0l.5.4c-.7.5-1.4.9-2.2 1.2.4.8.9 1.5 1.4 2.2 2.2-.6 4.4-1.6 6.6-3.2.6-4.2.1-8.1-1.7-11.4ZM9.7 14.4c-.9 0-1.7-.8-1.7-1.8s.7-1.8 1.7-1.8c1 0 1.8.8 1.7 1.8 0 1-.7 1.8-1.7 1.8Zm4.6 0c-.9 0-1.7-.8-1.7-1.8s.7-1.8 1.7-1.8c1 0 1.8.8 1.7 1.8 0 1-.7 1.8-1.7 1.8Z"/>
    </svg>
  );
}
