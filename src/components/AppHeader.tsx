import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { ChevronDown, Settings, LogOut, Bell } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllRead,
  formatRelativeTime,
} from "@/hooks/useNotifications";

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
  const navigate = useNavigate();
  const { user, signOut, userRole } = useAuth();
  const { data: notifications = [] } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllRead();
  const [notifOpen, setNotifOpen] = useState(false);

  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? "Utilisateur";
  const initials = getInitials(displayName);

  const isInReport = location.pathname.startsWith("/rapport/");
  const currentCycle = "monthly" as "weekly" | "monthly";
  const currentStatus = isInReport ? "draft_preparation" : null;

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const latestNotifications = notifications.slice(0, 10);

  const handleNotifClick = (notif: typeof notifications[0]) => {
    markRead.mutate(notif.id);
    setNotifOpen(false);
    if (notif.report_id) {
      navigate(`/rapport/${notif.report_id}`);
    }
  };

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

        {userRole !== null && (
          <DropdownMenu open={notifOpen} onOpenChange={setNotifOpen}>
            <DropdownMenuTrigger asChild>
              <button className="relative flex items-center justify-center h-8 w-8 hover:bg-muted rounded-lg transition-colors">
                <Bell className="h-[18px] w-[18px] text-muted-foreground" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 min-w-[16px] px-0.5 rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground flex items-center justify-center">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 p-0">
              <div className="px-3 py-2 border-b border-border">
                <span className="text-sm font-semibold text-foreground">Notifications</span>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {latestNotifications.length === 0 ? (
                  <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                    Aucune notification
                  </div>
                ) : (
                  latestNotifications.map((notif) => (
                    <button
                      key={notif.id}
                      onClick={() => handleNotifClick(notif)}
                      className={`w-full text-left px-3 py-2.5 transition-colors hover:bg-muted/50 border-b border-border last:border-b-0 ${
                        !notif.is_read ? "bg-muted/30" : ""
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {notif.title}
                          </p>
                          {notif.body && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {notif.body.length > 80 ? notif.body.slice(0, 80) + "…" : notif.body}
                            </p>
                          )}
                          <p className="text-[11px] text-muted-foreground/70 mt-1">
                            {formatRelativeTime(notif.created_at)}
                          </p>
                        </div>
                        {!notif.is_read && (
                          <span className="mt-1 h-2 w-2 rounded-full bg-primary shrink-0" />
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
              {unreadCount > 0 && (
                <div className="px-3 py-2 border-t border-border">
                  <button
                    onClick={() => markAllRead.mutate()}
                    className="text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                  >
                    Tout marquer comme lu
                  </button>
                </div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

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
            <DropdownMenuItem className="gap-2" onClick={() => navigate("/parametres")}>
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
