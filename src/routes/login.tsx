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
