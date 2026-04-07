import { useState } from "react";
import { useLocation } from "react-router-dom";
import { ChevronDown, Globe, User, Settings, LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const languages = ["FR", "EN", "ES"];

const statusMap: Record<string, { label: string; bg: string; text: string }> = {
  draft_preparation: { label: "En préparation", bg: "bg-muted", text: "text-muted-foreground" },
  ready_for_review: { label: "Prêt pour réunion", bg: "bg-amber-100", text: "text-amber-800" },
  in_meeting: { label: "En réunion", bg: "bg-orange-100", text: "text-orange-800" },
  validated: { label: "Validé", bg: "bg-emerald-100", text: "text-emerald-800" },
};

export function AppHeader() {
  const [activeLang, setActiveLang] = useState("FR");
  const location = useLocation();

  const isInReport = location.pathname.startsWith("/rapport/");
  const currentCycle: "weekly" | "monthly" = "monthly";
  const currentStatus = isInReport ? "draft_preparation" : null;
  const status = currentStatus ? statusMap[currentStatus] : null;

  return (
    <header className="h-14 border-b border-border bg-card flex items-center px-4 shrink-0 z-30">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-bold text-primary">SPA OMS</h1>
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
            currentCycle === "weekly"
              ? "bg-emerald-100 text-emerald-800"
              : "bg-blue-100 text-blue-800"
          }`}
        >
          {currentCycle === "weekly" ? "🟢" : "🔵"}{" "}
          {currentCycle === "weekly" ? "Weekly" : "Monthly"}
        </span>
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-3">
        {status && (
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${status.bg} ${status.text}`}>
            {status.label}
          </span>
        )}

        <div className="flex items-center gap-0.5 border border-border rounded-md">
          {languages.map((lang) => (
            <button
              key={lang}
              onClick={() => setActiveLang(lang)}
              className={`text-xs px-2 py-1 font-medium transition-colors ${
                activeLang === lang
                  ? "bg-primary text-primary-foreground rounded-md"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {lang}
            </button>
          ))}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 hover:bg-muted rounded-lg px-2 py-1.5 transition-colors">
              <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
                MD
              </div>
              <span className="text-sm font-medium text-foreground hidden sm:inline">Marie Dupont</span>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem className="gap-2">
              <User className="h-4 w-4" /> Profil
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2">
              <Settings className="h-4 w-4" /> Paramètres
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 text-destructive">
              <LogOut className="h-4 w-4" /> Déconnexion
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
