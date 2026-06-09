import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MIN_LENGTH = 8;

export default function ChangePassword() {
  const { t } = useTranslation();
  const { userRole, mustChangePassword, signOut } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const home = userRole === "direction" ? "/direction" : userRole === "admin" ? "/admin/organisation" : "/";

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < MIN_LENGTH) {
      setError(t("changePassword.tooShort", { count: MIN_LENGTH }));
      return;
    }
    if (password !== confirm) {
      setError(t("changePassword.mismatch"));
      return;
    }

    setSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({
      password,
      data: { must_change_password: false },
    });
    setSubmitting(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    toast.success(t("changePassword.success"));
    navigate(home, { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold" style={{ color: "#006B6B" }}>
            SPA OMS
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            {mustChangePassword ? t("changePassword.forcedSubtitle") : t("changePassword.subtitle")}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 bg-card border border-border rounded-xl p-6 shadow-sm">
          {mustChangePassword && (
            <p className="text-sm text-muted-foreground">{t("changePassword.forcedDesc")}</p>
          )}
          <div className="space-y-2">
            <Label htmlFor="new-password">{t("changePassword.newPassword")}</Label>
            <Input
              id="new-password"
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">{t("changePassword.confirmPassword")}</Label>
            <Input
              id="confirm-password"
              type="password"
              required
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
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
            {submitting ? t("changePassword.submitting") : t("changePassword.submit")}
          </Button>

          {mustChangePassword ? (
            <button
              type="button"
              onClick={signOut}
              className="w-full text-xs text-center text-muted-foreground hover:text-foreground"
            >
              {t("changePassword.signOut")}
            </button>
          ) : (
            <Button type="button" variant="ghost" className="w-full" onClick={() => navigate(-1)}>
              {t("common.cancel")}
            </Button>
          )}
        </form>
      </div>
    </div>
  );
}
