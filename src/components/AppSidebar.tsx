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
} from "lucide-react";
import { NavLink, useLocation, useSearchParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { SectionId } from "@/pages/RapportDetail";

interface ReportSection {
  id: SectionId;
  label: string;
  icon: typeof BarChart3;
  overdue?: number;
}

const reportSections: ReportSection[] = [
  { id: "kpi", label: "KPI", icon: BarChart3 },
  { id: "checkin", label: "Check-in", icon: MessageSquare },
  { id: "responsabilites", label: "Responsabilités", icon: Users },
  { id: "todo", label: "To-do", icon: CheckSquare, overdue: 3 },
  { id: "objectifs", label: "Objectifs", icon: Target },
  { id: "ids", label: "IDS", icon: Lightbulb },
  { id: "cloture", label: "Clôture", icon: Lock },
];

const secondaryLinks = [
  { label: "Rapports passés", url: "/rapports", icon: FileText },
  { label: "Historique spa", url: "/historique", icon: History },
  { label: "Config KPI", url: "/admin/kpi", icon: Settings },
];

const mainNavItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Mes rapports", url: "/rapports", icon: FileText },
  { title: "To-do", url: "/todos", icon: CheckSquare, badge: 3 },
  { title: "Objectifs", url: "/objectifs", icon: Target },
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
}

export function AppSidebar({ activeSection, onSectionChange, sectionStatuses }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const isInReport = location.pathname.startsWith("/rapport/");

  const sidebarContent = (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Spa name + period */}
      <div className="p-4 pb-2">
        <h2 className="text-sm font-bold text-foreground">Spa Le Domaine</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Mars 2026</p>
      </div>

      {/* Main navigation */}
      {!isInReport && (
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
              <span className="lg:inline hidden">{item.title}</span>
              {item.badge && (
                <span className="ml-auto bg-destructive text-destructive-foreground text-xs font-semibold rounded-full h-5 w-5 flex items-center justify-center lg:flex hidden">
                  {item.badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
      )}

      {/* Report sections */}
      {isInReport && (
        <>
          <div className="px-4 mt-3 mb-1">
            <NavLink
              to="/rapports"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronRight className="h-3 w-3 rotate-180" />
              Retour aux rapports
            </NavLink>
          </div>
          <nav className="px-3 mt-1 space-y-0.5">
            {reportSections.map((section) => {
              const isActive = activeSection === section.id;
              const sStatus = sectionStatuses?.[section.id] ?? "incomplete";
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
                  <span className="flex-1 lg:inline hidden">{section.label}</span>
                  <span className="lg:inline hidden">{statusIcon(sStatus)}</span>
                  {section.overdue && (
                    <span className="bg-destructive text-destructive-foreground text-xs font-semibold rounded-full h-5 min-w-[20px] px-1 flex items-center justify-center lg:flex hidden">
                      {section.overdue}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Submit button */}
          <div className="px-3 mt-4">
            <Button className="w-full gap-1.5 lg:flex hidden" size="sm">
              <Send className="h-4 w-4" />
              <span>Soumettre pour revue</span>
            </Button>
          </div>
        </>
      )}

      <div className="flex-1" />

      {/* Secondary links */}
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
            <span className="lg:inline hidden">{link.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User */}
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
