import { LayoutDashboard, FileText, CheckSquare, Target, Menu, X } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useState } from "react";

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Mes rapports", url: "/rapports", icon: FileText },
  { title: "To-do", url: "/todos", icon: CheckSquare, badge: 3 },
  { title: "Objectifs", url: "/objectifs", icon: Target },
];

const languages = ["FR", "EN", "ES"];

export function AppSidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeLang, setActiveLang] = useState("FR");

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-6 pb-2">
        <h1 className="text-xl font-bold text-primary">SPA OMS</h1>
        <p className="text-xs text-muted-foreground mt-1">Pilotage opérationnel</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 mt-4 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.url}
            to={item.url}
            end={item.url === "/"}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors relative ${
                isActive
                  ? "bg-accent text-accent-foreground border-l-[3px] border-primary pl-[9px]"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`
            }
          >
            <item.icon className="h-5 w-5 shrink-0" />
            <span>{item.title}</span>
            {item.badge && (
              <span className="ml-auto bg-destructive text-destructive-foreground text-xs font-semibold rounded-full h-5 w-5 flex items-center justify-center">
                {item.badge}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom */}
      <div className="p-4 border-t border-border space-y-3">
        <p className="text-xs text-muted-foreground">Spa Le Domaine</p>
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
            MD
          </div>
          <span className="text-sm font-medium text-foreground">Marie Dupont</span>
        </div>
        <div className="flex gap-1">
          {languages.map((lang) => (
            <button
              key={lang}
              onClick={() => setActiveLang(lang)}
              className={`text-xs px-2 py-1 rounded font-medium transition-colors ${
                activeLang === lang
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {lang}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-card shadow-sm border border-border"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 bg-foreground/20 z-40" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static z-40 top-0 left-0 h-screen w-60 bg-card border-r border-border flex-shrink-0 transition-transform lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
