import { useState, useMemo, useCallback } from "react";
import { useParams, useOutletContext } from "react-router-dom";
import { ReportHeader } from "@/components/rapport/ReportHeader";
import { SectionKpi } from "@/components/rapport/SectionKpi";
import { SectionCheckin } from "@/components/rapport/SectionCheckin";
import { SectionCheckinWeekly } from "@/components/rapport/SectionCheckinWeekly";
import { SectionResponsabilites } from "@/components/rapport/SectionResponsabilites";
import { SectionTodo } from "@/components/rapport/SectionTodo";
import { SectionObjectifs } from "@/components/rapport/SectionObjectifs";
import { SectionIds } from "@/components/rapport/SectionIds";
import { SectionIdsWeekly } from "@/components/rapport/SectionIdsWeekly";
import { SectionCloture } from "@/components/rapport/SectionCloture";
import { AutosaveIndicator } from "@/components/rapport/AutosaveIndicator";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Save, Send } from "lucide-react";

export type ReportType = "monthly" | "weekly";
export type SectionId = "kpi" | "checkin" | "responsabilites" | "todo" | "objectifs" | "ids" | "cloture";
export type SectionStatus = "complete" | "incomplete" | "warning";

interface OutletContext {
  activeSection: SectionId;
  setActiveSection: (s: SectionId) => void;
  sectionStatuses: Record<SectionId, SectionStatus>;
  setSectionStatuses: React.Dispatch<React.SetStateAction<Record<SectionId, SectionStatus>>>;
  reportType: ReportType;
}

const reportData: Record<string, { label: string; period: string; type: ReportType }> = {
  r1: { label: "Monthly — Mars 2026", period: "1 mars → 31 mars 2026", type: "monthly" },
  r2: { label: "Weekly — Semaine 12", period: "18 → 24 mars 2026", type: "weekly" },
  r3: { label: "Monthly — Février 2026", period: "1 fév → 28 fév 2026", type: "monthly" },
  r4: { label: "Weekly — Semaine 11", period: "11 → 17 mars 2026", type: "weekly" },
  r5: { label: "Monthly — Janvier 2026", period: "1 jan → 31 jan 2026", type: "monthly" },
  r6: { label: "Weekly — Semaine 13", period: "25 → 31 mars 2026", type: "weekly" },
};

const weeklySections: SectionId[] = ["kpi", "checkin", "ids"];
const monthlySections: SectionId[] = ["kpi", "checkin", "responsabilites", "todo", "objectifs", "ids", "cloture"];

export default function RapportDetail() {
  const { id } = useParams<{ id: string }>();
  const report = reportData[id ?? ""] ?? { label: `Rapport ${id}`, period: "", type: "monthly" as ReportType };
  const { activeSection, sectionStatuses, setSectionStatuses } = useOutletContext<OutletContext>();

  const isWeekly = report.type === "weekly";
  const sections = isWeekly ? weeklySections : monthlySections;

  const updateSectionStatus = useCallback((section: SectionId, status: SectionStatus) => {
    setSectionStatuses((prev) => ({ ...prev, [section]: status }));
  }, [setSectionStatuses]);

  const canSubmit = useMemo(() => {
    if (isWeekly) {
      return sectionStatuses.kpi === "complete" && sectionStatuses.checkin === "complete";
    }
    return sectionStatuses.kpi === "complete" && sectionStatuses.checkin === "complete";
  }, [sectionStatuses, isWeekly]);

  const completedCount = useMemo(() => {
    return sections.filter((s) => sectionStatuses[s] === "complete").length;
  }, [sectionStatuses, sections]);

  return (
    <div className="pb-24">
      <ReportHeader
        label={report.label}
        period={report.period}
        type={report.type}
        completedSections={completedCount}
        totalSections={sections.length}
        activeSection={activeSection}
      />

      {activeSection === "kpi" && (
        <SectionKpi reportType={report.type} period={report.period} onStatusChange={(s) => updateSectionStatus("kpi", s)} />
      )}
      {activeSection === "checkin" && !isWeekly && (
        <SectionCheckin onStatusChange={(s) => updateSectionStatus("checkin", s)} />
      )}
      {activeSection === "checkin" && isWeekly && (
        <SectionCheckinWeekly onStatusChange={(s) => updateSectionStatus("checkin", s)} />
      )}
      {activeSection === "responsabilites" && !isWeekly && (
        <SectionResponsabilites onStatusChange={(s) => updateSectionStatus("responsabilites", s)} />
      )}
      {activeSection === "todo" && !isWeekly && <SectionTodo />}
      {activeSection === "objectifs" && !isWeekly && <SectionObjectifs reportType={report.type} />}
      {activeSection === "ids" && !isWeekly && <SectionIds reportType={report.type} />}
      {activeSection === "ids" && isWeekly && (
        <SectionIdsWeekly onStatusChange={(s) => updateSectionStatus("ids", s)} />
      )}
      {activeSection === "cloture" && !isWeekly && <SectionCloture reportType={report.type} />}

      {/* STICKY BOTTOM BAR */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-[0_-2px_8px_rgba(0,0,0,0.06)] px-6 py-3 flex items-center justify-between z-50">
        <div className="flex items-center gap-4">
          <Button variant="ghost" className="gap-1.5">
            <Save className="h-4 w-4" />
            Enregistrer
          </Button>
          <AutosaveIndicator />
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button size="sm" disabled={!canSubmit} className="gap-1.5">
                <Send className="h-4 w-4" />
                {isWeekly ? "Valider et envoyer à la Direction" : "Soumettre pour revue"}
              </Button>
            </span>
          </TooltipTrigger>
          {!canSubmit && <TooltipContent>Complétez KPI et Check-in minimum</TooltipContent>}
        </Tooltip>
      </div>
    </div>
  );
}
