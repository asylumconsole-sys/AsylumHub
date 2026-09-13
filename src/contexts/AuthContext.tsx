import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { prefetchOrgId } from "@/hooks/use-org";

export type AppUser = {
    id: string;
    email?: string | null;
    user_metadata?: Record<string, unknown>;
    app_metadata?: Record<string, unknown>;
};

export type AppSession = {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    expires_at: number;
    token_type: string;
    user: AppUser & {
      aud: string;
      created_at: string;
      updated_at: string;export function createLocalSession({
          id,
          email,
          name,
          provider,
      }: {
          id: string;
          email: string;
          name: string;
          provider: "demo" | "discord";
      }): AppSession {
        const now = Math.floor(Date.now() / 1000);
        return {
              access_token: `${provider}-access-token`,
              refresh_token: `${provider}-refresh-token`,
              expires_in: 3600,
              expires_at: now + 3600,
              token_type: "bearer",
              user: {
                      id,
                      email,
                      app_metadata: { provider },
                      user_metadata: { name },
                      aud: "authenticated",
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                      role: "authenticated",
                      confirmation_sent_at: null,
                      email_confirmed_at: new Date().toISOString(),
                      last_sign_in_at: new Date().toISOString(),
                      phone: null,
                      phone_confirmed_at: null,
                      identities: [],
                      factors: [],
              },
        };export function createDiscordSession(name = "Discord User", userId?: string, email?: string): AppSession {
        return createLocalSession({
              id: userId || `discord-user-${Date.now()}`,
              email: email || "discord@asylum.local",
              name,
              provider: "discord",
          });
    }

  interface AuthCtx {
    session: AppSession | null;
      user: AppUser | null;
      loading: boolean;
      signOut: () => Promise<void>;
  }

  const Ctx = createContext<AuthCtx>({
      session: null,
      user: null,
      loading: true,
      signOut: async () => {},
  });

  function sessionsEqual(a: AppSession | null, b: AppSession | null) {
    if (a === b) return true;
    if (!a || !b) return false;
    return a.access_token === b.access_token && a.user?.id === b.user?.id;
}

function readStoredSession(): AppSession | null {
    if (typeof window === "undefined") return null;
    const querySession = new URLSearchParams(window.location.search).get("discord_session");
    if (querySession) {
          try {
                  const parsed = JSON.parse(decodeURIComponent(querySession)) as AppSession;
                  if (parsed?.user?.id && parsed?.access_  try {
                        const raw = window.localStorage.getItem(DISCORD_SESSION_KEY);
                        if (raw) {
                                const parsed = JSON.parse(raw) as AppSession;
                                if (parsed?.user?.id && parsed?.access_token) return parsed;
                        }
                  } catch {
                        window.localStorage.removeItem(DISCORD_SESSION_KEY);
                  }
              return null;
          }
      
      export function AuthProvider({ children }: { children: ReactNode }) {
          const [session, setSession] = useState<AppSession | null>(null);
          const [loading, setLoading] = useState(true);
          const lastUserIdRef = useRef<string | null>(null);
          const initializedRef = useRef(false);
        
          useEffect(() => {
                const apply = (s: AppSession | null) => {
                        setSession((prev) => (sessionsEqual(prev, s) ? prev : s));
                        if (!initializedRef.current) {
                                  initializedRef.current = true;
                                  setLoading(false);
                        }  const signOut = useCallback(async () => {
                              window.localStorage.removeItem(DEMO_SESSION_KEY);
                              window.localStorage.removeItem(DISCORD_SESSION_KEY);
                              setSession(null);
                        }, [session]);

                    const value = useMemo<AuthCtx>(
                          () => ({
                                  session,
                                  user: session?.user ?? null,
                                  loading,
                                  signOut,
                          }),
                          [session, loading, signOut],
                        );

                    return <Ctx.Provider value={value}>{children}</Ctx.Provider>Ctx.Provider>;
                }

            export const useAuth = () => useContext(Ctx);
            
                        const userId = s?.user?.id ?? null;
                        if (userId && lastUserIdRef.current !== userId) {
                                  lastUserIdRef.current = userId;
                                  prefetchOrgId(userId);
                        } else if (!userId) {
                                  lastUserIdRef.current = null;
                        }
                };
            
                apply(readStoredSession());
          }, []);
        
        token) {
                            window.localStorage.setItem(DISCORD_SESSION_KEY, JSON.stringify(parsed));
                            const url = new URL(window.location.href);
                            url.searchParams.delete("discord_session");
                            window.history.replaceState({}, "", url);
                            return parsed;
                  }
          } catch {
                  window.localStorage.removeItem(DISCORD_SESSION_KEY);
          }
    }

  
    }

  export function createDemoSession(): AppSession {
    return createLocalSession({
          id: "demo-user",
          email: "demo@asylum.local",
          name: "Asylum Demo User",
          provider: "demo",
    });
}


      role: string;
      confirmation_sent_at: string | null;
      email_confirmed_at: string | null;
      last_sign_in_at: string;
      phone: string | null;
      phone_confirmed_at: string | null;
      identities: unknown[];
      factors: unknown[];
    };
};

export const DEMO_SESSION_KEY = "asylum-demo-session";
export const DISCORD_SESSION_KEY = "asylum-discord-session";

