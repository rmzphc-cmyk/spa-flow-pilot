import { ChevronRight } from "lucide-react";
import type { SectionId } from "@/pages/RapportDetail";

const sectionLabels: Record<SectionId, string> = {
  kpi: "KPI",
  checkin: "Check-in",
  responsabilites: "Responsabilités",
  todo: "To-do",
  objectifs: "Objectifs",
  ids: "IDS",
  notes: "Notes libres",
  cloture: "Clôture",
};

interface Props {
  label: string;
  period: string;
  type: "monthly" | "weekly";
  completedSections: number;
  totalSections: number;
  activeSection: SectionId;
}

const segmentColors = (completed: number, total: number) =>
  Array.from({ length: total }, (_, i) => (i < completed ? "bg-primary" : "bg-border"));

export function ReportHeader({ label, period, type, completedSections, totalSections, activeSection }: Props) {
  return (
    <div className="mb-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
        <span>Par Gran Canaria</span>
        <ChevronRight className="h-3 w-3" />
        <span>Rapports</span>
        <ChevronRight className="h-3 w-3" />
        <span>{period}</span>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground font-medium">{sectionLabels[activeSection]}</span>
      </nav>

      {/* Title row */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{label}</h1>
          <p className="text-sm text-muted-foreground mt-1">{period}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
              type === "weekly" ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-blue-800"
            }`}
          >
            {type === "weekly" ? "🟢 Weekly" : "🔵 Monthly"}
          </span>
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
            En préparation
          </span>
        </div>
      </div>

      {/* Segmented progress bar */}
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs text-muted-foreground font-medium">{completedSections}/{totalSections} sections</span>
      </div>
      <div className="flex gap-1 h-2">
        {segmentColors(completedSections, totalSections).map((color, i) => (
          <div key={i} className={`flex-1 rounded-full ${color} transition-colors`} />
        ))}
      </div>
    </div>
  );
}
