import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const REDIRECT_URL = "https://spa-flow-pilot.lovable.app/change-password";

export default function ForgotPassword() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: REDIRECT_URL,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
    } else {
      setSent(true);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold" style={{ color: "#006B6B" }}>
            SPA OMS
          </h1>
          <p className="text-sm text-muted-foreground mt-2">{t("forgotPassword.subtitle")}</p>
        </div>

        {sent ? (
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm text-center space-y-4">
            <p className="text-sm">{t("forgotPassword.sent")}</p>
            <Link to="/login" className="text-sm underline" style={{ color: "#006B6B" }}>
              {t("forgotPassword.backToLogin")}
            </Link>
          </div>
        ) : (
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
            <Button
              type="submit"
              disabled={submitting}
              className="w-full text-white hover:opacity-90"
              style={{ backgroundColor: "#006B6B" }}
            >
              {submitting ? t("forgotPassword.submitting") : t("forgotPassword.submit")}
            </Button>
            <Link
              to="/login"
              className="block text-xs text-center text-muted-foreground hover:text-foreground"
            >
              {t("forgotPassword.backToLogin")}
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
