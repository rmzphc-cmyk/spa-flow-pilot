import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronDown, User, Settings, LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";

function getInitials(name: string) {
  const parts = name.trim().split(/[\s@.]+/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

const langCodes = [
  { code: "fr", label: "FR" },
  { code: "en", label: "EN" },
  { code: "es", label: "ES" },
];

export function AppHeader() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const { user, signOut } = useAuth();

  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? "Utilisateur";
  const initials = getInitials(displayName);

  const isInReport = location.pathname.startsWith("/rapport/");
  const currentCycle = "monthly" as "weekly" | "monthly";
  const currentStatus = isInReport ? "draft_preparation" : null;

  return (
    <header className="h-14 border-b border-border bg-card flex items-center px-4 shrink-0 z-30">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-bold text-primary">{t("app.name")}</h1>
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
            currentCycle === "weekly"
              ? "bg-emerald-100 text-emerald-800"
              : "bg-blue-100 text-blue-800"
          }`}
        >
          {currentCycle === "weekly" ? "🟢" : "🔵"}{" "}
          {t(`app.cycle.${currentCycle}`)}
        </span>
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-3">
        {currentStatus && (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
            {t(`status.${currentStatus}`)}
          </span>
        )}

        <div className="flex items-center gap-0.5 border border-border rounded-md">
          {langCodes.map((lang) => (
            <button
              key={lang.code}
              onClick={() => i18n.changeLanguage(lang.code)}
              className={`text-xs px-2 py-1 font-medium transition-colors ${
                i18n.language === lang.code
                  ? "bg-primary text-primary-foreground rounded-md"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {lang.label}
            </button>
          ))}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 hover:bg-muted rounded-lg px-2 py-1.5 transition-colors">
              <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
                {initials}
              </div>
              <span className="text-sm font-medium text-foreground hidden sm:inline">{displayName}</span>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem className="gap-2">
              <User className="h-4 w-4" /> {t("header.profile")}
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2">
              <Settings className="h-4 w-4" /> {t("header.settings")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 text-destructive" onClick={() => signOut()}>
              <LogOut className="h-4 w-4" /> {t("header.logout")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
