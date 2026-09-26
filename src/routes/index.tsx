import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { BRAND } from "@/lib/brand";
import { startDiscordLogin } from "@/lib/discord-login";
import { AuthGate } from "@/components/app/AuthGate";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  component: LandingPage,
  head: () => ({
    meta: [
      { title: `${BRAND.name}` },
      { name: "description", content: BRAND.description },
    ],
  }),
});

function LandingPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/dashboard", replace: true });
  }, [session, loading, navigate]);

  const discord = async () => {
    setBusy(true);
    try {
      await startDiscordLogin("/dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login failed");
      setBusy(false);
    }
  };

  if (loading || session) {
    return <div className="min-h-dvh bg-black" />;
  }

  return <AuthGate busy={busy} onDiscord={() => void discord()} />;
}
