import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toAppRole, type AppRole } from "@/lib/roles";
import i18n from "@/i18n";

export type { AppRole };

interface AuthContextValue {
  user: User | null;
  userId: string | null;
  session: Session | null;
  userRole: AppRole | null;
  spaId: string | null;
  mustChangePassword: boolean;
  isRecoveryMode: boolean;
  isLoading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      setIsLoading(false);
      if (event === "PASSWORD_RECOVERY") setIsRecoveryMode(true);
      if (event === "USER_UPDATED" || event === "SIGNED_IN") setIsRecoveryMode(false);
      // Sync langue depuis user_metadata à chaque (re)connexion
      const lang = newSession?.user?.user_metadata?.language;
      if (lang && ["fr", "en", "es"].includes(lang) && i18n.language !== lang) {
        i18n.changeLanguage(lang);
        localStorage.setItem("app-language", lang);
      }
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
    <AuthContext.Provider value={{ user, userId: user?.id ?? null, session, userRole, spaId, mustChangePassword, isRecoveryMode, isLoading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
