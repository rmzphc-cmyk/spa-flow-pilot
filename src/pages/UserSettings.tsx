import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const languages = [
  { value: "fr" as const, label: "Français", flag: "🇫🇷" },
  { value: "en" as const, label: "English", flag: "🇬🇧" },
  { value: "es" as const, label: "Español", flag: "🇪🇸" },
];

export default function UserSettings() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const currentLang = (i18n.language?.slice(0, 2) ?? "fr") as "fr" | "en" | "es";
  const [saving, setSaving] = useState(false);

  const handleLanguageChange = async (lang: "fr" | "en" | "es") => {
    if (lang === currentLang) return;
    setSaving(true);
    i18n.changeLanguage(lang);
    localStorage.setItem("app-language", lang);
    try {
      await supabase.auth.updateUser({ data: { language: lang } });
    } catch {
      // non-bloquant — la langue est déjà appliquée localement
    } finally {
      setSaving(false);
    }
  };

  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const fullName = (typeof meta.full_name === "string" && meta.full_name) || user?.email || "—";
  const email = user?.email ?? "—";

  return (
    <div className="max-w-[560px] mx-auto px-6 py-6 pb-20">
      <h1 className="text-xl font-bold text-foreground mb-6">{t("settings.title")}</h1>

      {/* Langue */}
      <section className="mb-8">
        <h2 className="text-base font-semibold text-foreground mb-3">{t("settings.language.title")}</h2>
        <div className="flex gap-2">
          {languages.map((lang) => (
            <button
              key={lang.value}
              disabled={saving}
              onClick={() => handleLanguageChange(lang.value)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                currentLang === lang.value
                  ? "bg-primary/10 text-primary border-primary/30"
                  : "bg-card text-muted-foreground border-border hover:bg-muted"
              }`}
            >
              <span className="text-lg">{lang.flag}</span>
              {lang.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-2">{t("settings.language.aiNote")}</p>
      </section>

      {/* Compte */}
      <section className="mb-8">
        <h2 className="text-base font-semibold text-foreground mb-3">{t("settings.account.title")}</h2>
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm space-y-4">
          <div>
            <Label className="text-sm font-medium">{t("settings.account.displayName")}</Label>
            <p className="text-sm text-foreground mt-1">{fullName}</p>
          </div>
          <div>
            <Label className="text-sm font-medium">{t("settings.account.email")}</Label>
            <p className="text-sm text-foreground mt-1">{email}</p>
            <p className="text-[10px] text-muted-foreground mt-1">{t("settings.account.emailNote")}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate("/change-password")}>
            {t("settings.account.changePassword")}
          </Button>
        </div>
      </section>
    </div>
  );
}
