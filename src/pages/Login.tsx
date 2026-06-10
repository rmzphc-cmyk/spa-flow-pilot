import { FormEvent, useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Login() {
  const { t } = useTranslation();
  const { session, userRole, isLoading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && session) {
      const target = userRole === "direction" ? "/direction" : "/";
      navigate(target, { replace: true });
    }
  }, [session, userRole, isLoading, navigate]);

  if (isLoading) return null;
  if (session) return <Navigate to={userRole === "direction" ? "/direction" : "/"} replace />;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (signInError) {
      setError(t("login.invalidCredentials"));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold" style={{ color: "#006B6B" }}>
            SPA OMS
          </h1>
          <p className="text-sm text-muted-foreground mt-2">{t("login.subtitle")}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 bg-card border border-border rounded-xl p-6 shadow-sm">
          <div className="space-y-2">
            <Label htmlFor="email">{t("login.email")}</Label>
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">{t("login.password")}</Label>
              <Link
                to="/forgot-password"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                {t("login.forgotPassword")}
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <Button
            type="submit"
            disabled={submitting}
            className="w-full text-white hover:opacity-90"
            style={{ backgroundColor: "#006B6B" }}
          >
            {submitting ? t("login.submitting") : t("login.submit")}
          </Button>
        </form>
        <p className="text-xs text-center text-muted-foreground">
          {t("login.inviteOnly")}
        </p>
      </div>
    </div>
  );
}
