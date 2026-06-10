import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toAppRole, type AppRole } from "@/lib/roles";

export type { AppRole };

interface AuthContextValue {
  user: User | null;
  userId: string | null;
  session: Session | null;
  userRole: AppRole | null;
  spaId: string | null;
  mustChangePassword: boolean;
  isLoading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

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
  const userRole = toAppRole(appMeta.role);
  const rawSpaId = appMeta.spa_id;
  const spaId = typeof rawSpaId === "string" && rawSpaId.length > 0 ? rawSpaId : null;
  const userMeta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const mustChangePassword = userMeta.must_change_password === true;

  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.replace("/login");
  };

  return (
    <AuthContext.Provider value={{ user, userId: user?.id ?? null, session, userRole, spaId, mustChangePassword, isLoading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
