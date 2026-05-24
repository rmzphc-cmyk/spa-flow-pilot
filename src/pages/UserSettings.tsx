import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import {
  loadSchedule,
  saveSchedule,
  type MeetingSchedule,
} from "@/lib/meetingSchedule";

interface UserSettingsData {
  language: "fr" | "en" | "es";
  notifications: {
    preBrief: boolean;
    aiSynthesis: boolean;
    reportValidated: boolean;
    email: string;
  };
  cycle: {
    type: "weekly" | "monthly";
    frequency: number;
    submissionDay: string;
  };
  account: {
    displayName: string;
    email: string;
    role: "manager" | "direction" | "admin";
    spa: string;
  };
  accessibility: {
    textSize: "normal" | "large";
    contrast: "standard" | "high";
  };
}

const languages = [
  { value: "fr" as const, label: "Français", flag: "🇫🇷" },
  { value: "en" as const, label: "English", flag: "🇬🇧" },
  { value: "es" as const, label: "Español", flag: "🇪🇸" },
];

const days = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

export default function UserSettings() {
  const { t, i18n } = useTranslation();

  const [settings, setSettings] = useState<UserSettingsData>({
    language: (i18n.language as "fr" | "en" | "es") || "fr",
    notifications: {
      preBrief: true,
      aiSynthesis: true,
      reportValidated: true,
      email: "marie.dupont@spadomaine.fr",
    },
    cycle: {
      type: "weekly",
      frequency: 7,
      submissionDay: "vendredi",
    },
    account: {
      displayName: "Marie Dupont",
      email: "marie.dupont@spadomaine.fr",
      role: "manager",
      spa: "Spa Le Domaine",
    },
    accessibility: {
      textSize: "normal",
      contrast: "standard",
    },
  });

  const isManager = settings.account.role === "manager";

  const [schedule, setSchedule] = useState<MeetingSchedule>(() => loadSchedule());
  useEffect(() => {
    saveSchedule(schedule);
  }, [schedule]);


  const update = <K extends keyof UserSettingsData>(section: K, value: UserSettingsData[K]) => {
    setSettings({ ...settings, [section]: value });
  };

  const handleLanguageChange = (lang: "fr" | "en" | "es") => {
    update("language", lang);
    i18n.changeLanguage(lang);
  };

  const handlePasswordChange = () => {
    toast({ title: t("settings.passwordRedirect.title"), description: t("settings.passwordRedirect.description") });
  };

  return (
    <div className="max-w-[640px] mx-auto px-6 py-6 pb-20">
      <h1 className="text-xl font-bold text-foreground mb-6">{t("settings.title")}</h1>

      {/* SECTION 1 — Langue */}
      <section className="mb-8">
        <h2 className="text-base font-semibold text-foreground mb-3">{t("settings.language.title")}</h2>
        <div className="flex gap-2">
          {languages.map((lang) => (
            <button
              key={lang.value}
              onClick={() => handleLanguageChange(lang.value)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                settings.language === lang.value
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
        <p className="text-xs text-muted-foreground mt-1">{t("settings.language.personalNote")}</p>
      </section>

      {/* SECTION 2 — Notifications */}
      <section className="mb-8">
        <h2 className="text-base font-semibold text-foreground mb-3">{t("settings.notifications.title")}</h2>
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">{t("settings.notifications.preBrief")}</p>
              <p className="text-xs text-muted-foreground">{t("settings.notifications.preBriefDesc")}</p>
            </div>
            <Switch
              checked={settings.notifications.preBrief}
              onCheckedChange={(v) => update("notifications", { ...settings.notifications, preBrief: v })}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">{t("settings.notifications.aiSynthesis")}</p>
              <p className="text-xs text-muted-foreground">{t("settings.notifications.aiSynthesisDesc")}</p>
            </div>
            <Switch
              checked={settings.notifications.aiSynthesis}
              onCheckedChange={(v) => update("notifications", { ...settings.notifications, aiSynthesis: v })}
            />
          </div>
          {(settings.account.role === "direction" || settings.account.role === "admin") && (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">{t("settings.notifications.reportValidated")}</p>
                <p className="text-xs text-muted-foreground">{t("settings.notifications.reportValidatedDesc")}</p>
              </div>
              <Switch
                checked={settings.notifications.reportValidated}
                onCheckedChange={(v) => update("notifications", { ...settings.notifications, reportValidated: v })}
              />
            </div>
          )}
          <div>
            <Label className="text-sm font-medium">{t("settings.notifications.emailLabel")}</Label>
            <Input
              value={settings.notifications.email}
              onChange={(e) => update("notifications", { ...settings.notifications, email: e.target.value })}
              className="mt-1"
              type="email"
            />
          </div>
        </div>
      </section>

      {/* SECTION 3 — Cycle (Manager only) */}
      {isManager && (
        <section className="mb-8">
          <h2 className="text-base font-semibold text-foreground mb-3">{t("settings.cycle.title")}</h2>
          <div className="bg-card border border-border rounded-xl p-4 shadow-sm space-y-4">
            <div>
              <p className="text-sm font-medium text-foreground">{t("settings.cycle.reportingCycle")}</p>
              <div className="mt-1.5 flex items-center gap-2">
                <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                  settings.cycle.type === "weekly" ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-blue-800"
                }`}>
                  {settings.cycle.type === "weekly" ? "🟢 Weekly" : "🔵 Monthly"}
                </span>
                <span className="text-sm text-muted-foreground">
                  {settings.cycle.type === "weekly"
                    ? t("settings.cycle.frequencyLabel", { count: settings.cycle.frequency })
                    : t("settings.cycle.monthlyCycle")}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">{t("settings.cycle.adminOnly")}</p>
            </div>
            {settings.cycle.type === "weekly" && (
              <div>
                <Label className="text-sm font-medium">{t("settings.cycle.submissionDay")}</Label>
                <p className="text-[10px] text-muted-foreground mb-1.5">{t("settings.cycle.submissionDayDesc")}</p>
                <Select
                  value={settings.cycle.submissionDay}
                  onValueChange={(v) => update("cycle", { ...settings.cycle, submissionDay: v })}
                >
                  <SelectTrigger className="w-[180px] h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {days.map((d) => (
                      <SelectItem key={d} value={d} className="capitalize">{t(`days.${d}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </section>
      )}

      {/* SECTION 4 — Compte */}

      <section className="mb-8">
        <h2 className="text-base font-semibold text-foreground mb-3">{t("settings.account.title")}</h2>
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm space-y-4">
          <div>
            <Label className="text-sm font-medium">{t("settings.account.displayName")}</Label>
            <Input
              value={settings.account.displayName}
              onChange={(e) => update("account", { ...settings.account, displayName: e.target.value })}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-sm font-medium">{t("settings.account.email")}</Label>
            <Input value={settings.account.email} disabled className="mt-1 bg-muted" />
            <p className="text-[10px] text-muted-foreground mt-1">{t("settings.account.emailNote")}</p>
          </div>
          <div className="flex gap-8">
            <div>
              <Label className="text-sm font-medium">{t("settings.account.role")}</Label>
              <p className="text-sm text-foreground mt-1">{t(`roles.${settings.account.role}`)}</p>
            </div>
            <div>
              <Label className="text-sm font-medium">{t("settings.account.spa")}</Label>
              <p className="text-sm text-foreground mt-1">{settings.account.spa}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handlePasswordChange}>
            {t("settings.account.changePassword")}
          </Button>
        </div>
      </section>

      {/* SECTION 5 — Accessibilité */}
      <section className="mb-8">
        <h2 className="text-base font-semibold text-foreground mb-3">{t("settings.accessibility.title")}</h2>
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm space-y-4">
          <div>
            <Label className="text-sm font-medium">{t("settings.accessibility.textSize")}</Label>
            <div className="flex gap-2 mt-1.5">
              {(["normal", "large"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => update("accessibility", { ...settings.accessibility, textSize: s })}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    settings.accessibility.textSize === s
                      ? "bg-primary/10 text-primary border-primary/30"
                      : "bg-card text-muted-foreground border-border hover:bg-muted"
                  }`}
                >
                  {s === "normal" ? t("settings.accessibility.textNormal") : t("settings.accessibility.textLarge")}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-sm font-medium">{t("settings.accessibility.contrast")}</Label>
            <div className="flex gap-2 mt-1.5">
              {(["standard", "high"] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => update("accessibility", { ...settings.accessibility, contrast: c })}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    settings.accessibility.contrast === c
                      ? "bg-primary/10 text-primary border-primary/30"
                      : "bg-card text-muted-foreground border-border hover:bg-muted"
                  }`}
                >
                  {c === "standard" ? t("settings.accessibility.contrastStandard") : t("settings.accessibility.contrastHigh")}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
