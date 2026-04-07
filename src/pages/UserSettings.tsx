import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

// --- Types & Mock ---

interface UserSettings {
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

const initialSettings: UserSettings = {
  language: "fr",
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
};

const languages = [
  { value: "fr" as const, label: "Français", flag: "🇫🇷" },
  { value: "en" as const, label: "English", flag: "🇬🇧" },
  { value: "es" as const, label: "Español", flag: "🇪🇸" },
];

const days = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

const roleLabels: Record<string, string> = {
  manager: "Spa Manager",
  direction: "Direction",
  admin: "Administrateur",
};

// --- Main ---

export default function UserSettings() {
  const [settings, setSettings] = useState(initialSettings);

  const isManager = settings.account.role === "manager";
  const isDirection = settings.account.role === "direction";

  const update = <K extends keyof UserSettings>(section: K, value: UserSettings[K]) => {
    setSettings({ ...settings, [section]: value });
  };

  const handlePasswordChange = () => {
    toast({ title: "Redirection", description: "Vous allez être redirigé vers le flux de changement de mot de passe." });
  };

  return (
    <div className="max-w-[640px] mx-auto px-6 py-6 pb-20">
      <h1 className="text-xl font-bold text-foreground mb-6">Paramètres</h1>

      {/* SECTION 1 — Langue */}
      <section className="mb-8">
        <h2 className="text-base font-semibold text-foreground mb-3">Langue de l'interface</h2>
        <div className="flex gap-2">
          {languages.map((lang) => (
            <button
              key={lang.value}
              onClick={() => update("language", lang.value)}
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
        <p className="text-xs text-muted-foreground mt-2">
          L'IA produira ses réponses dans la langue sélectionnée.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Ce paramètre est personnel et n'affecte pas les autres utilisateurs.
        </p>
      </section>

      {/* SECTION 2 — Notifications */}
      <section className="mb-8">
        <h2 className="text-base font-semibold text-foreground mb-3">Notifications</h2>
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Pré-brief J-2 avant réunion</p>
              <p className="text-xs text-muted-foreground">Email + push</p>
            </div>
            <Switch
              checked={settings.notifications.preBrief}
              onCheckedChange={(v) => update("notifications", { ...settings.notifications, preBrief: v })}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Synthèse IA disponible</p>
              <p className="text-xs text-muted-foreground">Notification quand la synthèse est prête</p>
            </div>
            <Switch
              checked={settings.notifications.aiSynthesis}
              onCheckedChange={(v) => update("notifications", { ...settings.notifications, aiSynthesis: v })}
            />
          </div>
          {(isDirection || settings.account.role === "admin") && (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Rapport validé</p>
                <p className="text-xs text-muted-foreground">Notification quand un rapport est validé</p>
              </div>
              <Switch
                checked={settings.notifications.reportValidated}
                onCheckedChange={(v) => update("notifications", { ...settings.notifications, reportValidated: v })}
              />
            </div>
          )}
          <div>
            <Label className="text-sm font-medium">Email de notification</Label>
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
          <h2 className="text-base font-semibold text-foreground mb-3">Configuration cycle</h2>
          <div className="bg-card border border-border rounded-xl p-4 shadow-sm space-y-4">
            <div>
              <p className="text-sm font-medium text-foreground">Cycle de reporting</p>
              <div className="mt-1.5 flex items-center gap-2">
                <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                  settings.cycle.type === "weekly" ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-blue-800"
                }`}>
                  {settings.cycle.type === "weekly" ? "🟢 Weekly" : "🔵 Monthly"}
                </span>
                <span className="text-sm text-muted-foreground">
                  {settings.cycle.type === "weekly"
                    ? `fréquence : tous les ${settings.cycle.frequency} jours`
                    : "cycle mensuel"}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Modifiable par l'Admin</p>
            </div>
            {settings.cycle.type === "weekly" && (
              <div>
                <Label className="text-sm font-medium">Jour de soumission préféré</Label>
                <p className="text-[10px] text-muted-foreground mb-1.5">
                  Détermine le jour J du calcul du pré-brief J-2
                </p>
                <Select
                  value={settings.cycle.submissionDay}
                  onValueChange={(v) => update("cycle", { ...settings.cycle, submissionDay: v })}
                >
                  <SelectTrigger className="w-[180px] h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {days.map((d) => (
                      <SelectItem key={d} value={d} className="capitalize">{d.charAt(0).toUpperCase() + d.slice(1)}</SelectItem>
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
        <h2 className="text-base font-semibold text-foreground mb-3">Compte</h2>
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm space-y-4">
          <div>
            <Label className="text-sm font-medium">Nom affiché</Label>
            <Input
              value={settings.account.displayName}
              onChange={(e) => update("account", { ...settings.account, displayName: e.target.value })}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-sm font-medium">Email</Label>
            <Input value={settings.account.email} disabled className="mt-1 bg-muted" />
            <p className="text-[10px] text-muted-foreground mt-1">Modifiable via admin uniquement</p>
          </div>
          <div className="flex gap-8">
            <div>
              <Label className="text-sm font-medium">Rôle</Label>
              <p className="text-sm text-foreground mt-1">{roleLabels[settings.account.role]}</p>
            </div>
            <div>
              <Label className="text-sm font-medium">Spa assigné</Label>
              <p className="text-sm text-foreground mt-1">{settings.account.spa}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handlePasswordChange}>
            Changer mon mot de passe
          </Button>
        </div>
      </section>

      {/* SECTION 5 — Accessibilité */}
      <section className="mb-8">
        <h2 className="text-base font-semibold text-foreground mb-3">Accessibilité</h2>
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm space-y-4">
          <div>
            <Label className="text-sm font-medium">Taille de texte</Label>
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
                  {s === "normal" ? "Normal" : "Grand"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-sm font-medium">Contraste</Label>
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
                  {c === "standard" ? "Standard" : "Élevé"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
