import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "manager" | "direction" | "admin";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  userRole: AppRole | null;
  spaId: string | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function mapRole(raw: unknown): AppRole | null {
  if (typeof raw !== "string") return null;
  if (raw === "spa_manager" || raw === "manager") return "manager";
  if (raw === "direction") return "direction";
  if (raw === "admin") return "admin";
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setIsLoading(false);
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const user = session?.user ?? null;
  const appMeta = (user?.app_metadata ?? {}) as Record<string, unknown>;
  const userRole = mapRole(appMeta.role);
  const rawSpaId = appMeta.spa_id;
  const spaId = typeof rawSpaId === "string" && rawSpaId.length > 0 ? rawSpaId : null;

  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider value={{ user, session, userRole, spaId, isLoading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
