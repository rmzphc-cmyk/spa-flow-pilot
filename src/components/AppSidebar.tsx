import {
  BarChart3,
  MessageSquare,
  Users,
  CheckSquare,
  Target,
  Lightbulb,
  Lock,
  FileText,
  History,
  Settings,
  Menu,
  X,
  LayoutDashboard,
  ChevronRight,
  Send,
  Eye,
  ArrowLeft,
} from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useDirectionSpas } from "@/hooks/useDirectionData";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { SectionId } from "@/pages/RapportDetail";
import type { ReportType } from "@/pages/RapportDetail";

interface ReportSection {
  id: SectionId;
  labelKey: string;
  icon: typeof BarChart3;
  overdue?: number;
}

const allReportSections: ReportSection[] = [
  { id: "kpi", labelKey: "sections.kpi", icon: BarChart3 },
  { id: "checkin", labelKey: "sections.checkin", icon: MessageSquare },
  { id: "responsabilites", labelKey: "sections.responsabilites", icon: Users },
  { id: "todo", labelKey: "sections.todo", icon: CheckSquare, overdue: 3 },
  { id: "objectifs", labelKey: "sections.objectifs", icon: Target },
  { id: "ids", labelKey: "sections.ids", icon: Lightbulb },
  { id: "cloture", labelKey: "sections.cloture", icon: Lock },
];

const weeklySectionIds: SectionId[] = ["kpi", "checkin", "ids"];

const weeklyLabelOverrides: Partial<Record<SectionId, string>> = {
  checkin: "Check-in rapide",
  ids: "IDS — Capture",
};

const secondaryLinks = [
  { labelKey: "nav.pastReports", url: "/rapports", icon: FileText },
  { labelKey: "nav.spaHistory", url: "/historique", icon: History },
  { labelKey: "nav.configKpi", url: "/admin/kpi", icon: Settings },
  { labelKey: "nav.configResp", url: "/admin/responsabilites", icon: Users },
];

const mainNavItems = [
  { titleKey: "nav.dashboard", url: "/", icon: LayoutDashboard },
  { titleKey: "nav.reports", url: "/rapports", icon: FileText },
  { titleKey: "nav.todos", url: "/todos", icon: CheckSquare, badge: 3 },
  { titleKey: "nav.objectives", url: "/objectifs", icon: Target },
];

const statusIcon = (status: string) => {
  if (status === "complete") return <span className="text-emerald-600 text-xs font-bold">✓</span>;
  if (status === "warning") return <span className="text-amber-500 text-xs">⚠</span>;
  return <span className="text-muted-foreground/50 text-xs">○</span>;
};

interface Props {
  activeSection?: SectionId;
  onSectionChange?: (section: SectionId) => void;
  sectionStatuses?: Record<SectionId, string>;
  reportType?: ReportType;
}

export function AppSidebar({ activeSection, onSectionChange, sectionStatuses, reportType = "monthly" }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const isInReport = location.pathname.startsWith("/rapport/");
  const isDirection = location.pathname.startsWith("/direction");
  const { spaId, userRole } = useAuth();
  const { data: directionSpas = [] } = useDirectionSpas();

  const { data: spaRow } = useQuery({
    queryKey: ["spa", spaId],
    enabled: !!spaId && userRole !== "direction",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("spas")
        .select("name")
        .eq("id", spaId as string)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const spaName = userRole === "direction" ? "Vue Direction" : spaRow?.name ?? "Mon Spa";

  const isWeekly = reportType === "weekly";
  const reportSections = isWeekly
    ? allReportSections.filter((s) => weeklySectionIds.includes(s.id))
    : allReportSections;

  const totalSections = reportSections.length;
  const completedCount = reportSections.filter((s) => sectionStatuses?.[s.id] === "complete").length;

  const sidebarContent = (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-4 pb-2">
        {isDirection ? (
          <>
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-bold text-foreground">{t("direction.title")}</h2>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-sm font-bold text-foreground">{spaName}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{t("period.march2026")}</p>
          </>
        )}
      </div>

      {/* Direction mode sidebar */}
      {isDirection && (
        <>
          <nav className="px-3 mt-2 space-y-0.5">
            <NavLink
              to="/direction"
              end
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive && !location.pathname.includes("/spa/")
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`
              }
            >
              <LayoutDashboard className="h-4 w-4 shrink-0" />
              <span className="lg:inline hidden">{t("direction.overview")}</span>
            </NavLink>
          </nav>

          <div className="px-4 mt-4 mb-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Spas</p>
          </div>
          <nav className="px-3 space-y-0.5">
            {spas.map((spa) => {
              const isActive = location.pathname === `/direction/spa/${spa.id}`;
              const dotColor = spa.alerts.some((a) => a.level === "red")
                ? "bg-destructive"
                : spa.alerts.some((a) => a.level === "orange")
                ? "bg-amber-500"
                : "bg-emerald-500";

              return (
                <button
                  key={spa.id}
                  onClick={() => {
                    navigate(`/direction/spa/${spa.id}`);
                    setMobileOpen(false);
                  }}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors w-full text-left ${
                    isActive
                      ? "bg-primary/10 text-primary font-semibold"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full shrink-0 ${dotColor}`} />
                  <span className="lg:inline hidden truncate">{spa.name}</span>
                </button>
              );
            })}
          </nav>

          <div className="flex-1" />
          <div className="p-3 border-t border-border">
            <NavLink
              to="/"
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="lg:inline hidden">{t("direction.backToManager")}</span>
            </NavLink>
          </div>
        </>
      )}

      {/* Manager mode — default nav */}
      {!isInReport && !isDirection && (
        <nav className="px-3 mt-2 space-y-0.5">
          {mainNavItems.map((item) => (
            <NavLink
              key={item.url}
              to={item.url}
              end={item.url === "/"}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`
              }
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="lg:inline hidden">{t(item.titleKey)}</span>
              {item.badge && (
                <span className="ml-auto bg-destructive text-destructive-foreground text-xs font-semibold rounded-full h-5 w-5 flex items-center justify-center lg:flex hidden">
                  {item.badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
      )}

      {/* Report mode sidebar */}
      {isInReport && (
        <>
          <div className="px-4 mt-3 mb-1">
            <NavLink
              to="/rapports"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronRight className="h-3 w-3 rotate-180" />
              {t("nav.backToReports")}
            </NavLink>
          </div>

          {/* Progress indicator */}
          <div className="px-4 mt-2 mb-1">
            <span className="text-xs text-muted-foreground">{completedCount}/{totalSections} sections</span>
            <div className="flex gap-1 h-1.5 mt-1">
              {reportSections.map((s, i) => (
                <div
                  key={s.id}
                  className={`flex-1 rounded-full transition-colors ${
                    sectionStatuses?.[s.id] === "complete" ? "bg-primary" : "bg-border"
                  }`}
                />
              ))}
            </div>
          </div>

          <nav className="px-3 mt-2 space-y-0.5">
            {reportSections.map((section) => {
              const isActive = activeSection === section.id;
              const sStatus = sectionStatuses?.[section.id] ?? "incomplete";
              const label = isWeekly && weeklyLabelOverrides[section.id]
                ? weeklyLabelOverrides[section.id]
                : t(section.labelKey);
              return (
                <button
                  key={section.id}
                  onClick={() => {
                    onSectionChange?.(section.id);
                    setMobileOpen(false);
                  }}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors w-full text-left ${
                    isActive
                      ? "bg-accent text-primary border-l-[3px] border-primary pl-[9px] font-semibold"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <section.icon className={`h-4 w-4 shrink-0 ${isActive ? "text-primary" : ""}`} />
                  <span className="flex-1 lg:inline hidden">{label}</span>
                  <span className="lg:inline hidden">{statusIcon(sStatus)}</span>
                  {!isWeekly && section.overdue && (
                    <span className="bg-destructive text-destructive-foreground text-xs font-semibold rounded-full h-5 min-w-[20px] px-1 flex items-center justify-center lg:flex hidden">
                      {section.overdue}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="px-3 mt-4">
            <Button className="w-full gap-1.5 lg:flex hidden" size="sm">
              <Send className="h-4 w-4" />
              <span>{isWeekly ? "Valider et envoyer" : t("nav.submitForReview")}</span>
            </Button>
          </div>
        </>
      )}

      {/* Bottom section for non-direction modes */}
      {!isDirection && (
        <>
          <div className="flex-1" />
          <div className="border-t border-border mx-3 my-2" />
          <nav className="px-3 space-y-0.5 pb-2">
            {secondaryLinks.map((link) => (
              <NavLink
                key={link.url}
                to={link.url}
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <link.icon className="h-4 w-4 shrink-0" />
                <span className="lg:inline hidden">{t(link.labelKey)}</span>
              </NavLink>
            ))}
          </nav>

          <div className="p-3 border-t border-border">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                MD
              </div>
              <div className="lg:block hidden">
                <p className="text-sm font-medium text-foreground leading-tight">Marie Dupont</p>
                <p className="text-xs text-muted-foreground">Spa Manager</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );

  return (
    <>
      <button
        className="lg:hidden fixed top-3 left-3 z-50 p-2 rounded-lg bg-card shadow-sm border border-border"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Menu"
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 bg-foreground/20 z-40" onClick={() => setMobileOpen(false)} />
      )}

      <aside
        className={`fixed lg:static z-40 top-0 left-0 h-full w-[220px] border-r border-border flex-shrink-0 transition-transform lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ backgroundColor: "#F9FAFB" }}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
