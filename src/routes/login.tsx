import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { startDiscordLogin } from "@/lib/discord-login";
import { AuthGate } from "@/components/app/AuthGate";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: typeof s.redirect === "string" ? s.redirect : "/dashboard",
    mode: s.mode === "signup" ? ("signup" as const) : ("signin" as const),
    error: typeof s.error === "string" ? s.error : undefined,
  }),
  component: LoginPage,
});

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
    if (!loading && session) nav({ to: safeRedirect as never, replace: true });
  }, [session, loading, nav, safeRedirect]);

  const discord = async () => {
    setBusy(true);
    try {
      await startDiscordLogin(safeRedirect);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  };

  return <AuthGate busy={busy} onDiscord={() => void discord()} />;
}
