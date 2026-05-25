import { useMemo, useCallback } from "react";
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
import { MeetingView } from "@/components/rapport/MeetingView";
import { getReport, isMeetingState, type ReportRecord } from "@/lib/reportsStore";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Save, CheckCircle2 } from "lucide-react";

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

const weeklySections: SectionId[] = ["kpi", "checkin", "ids"];
const monthlySections: SectionId[] = ["kpi", "checkin", "responsabilites", "todo", "objectifs", "ids", "cloture"];

export default function RapportDetail() {
  const { id } = useParams<{ id: string }>();
  const record = getReport(id);
  const report = record ?? {
    id: id ?? "",
    type: "monthly" as ReportType,
    label: `Rapport ${id}`,
    period: "",
    state: "draft_preparation" as const,
    meetingDate: null,
    updatedAt: "",
    completion: 0,
  };

  // MEETING MODE — read-only, full focus
  if (isMeetingState(report.state)) {
    return <MeetingView report={report} />;
  }

  // PREPARATION MODE — keep existing editable layout
  return <PreparationMode report={report} />;
}

function PreparationMode({ report }: { report: ReportRecord }) {
  const { activeSection, sectionStatuses, setSectionStatuses } = useOutletContext<OutletContext>();
  const isWeekly = report.type === "weekly";
  const sections = isWeekly ? weeklySections : monthlySections;

  const updateSectionStatus = useCallback(
    (section: SectionId, status: SectionStatus) => {
      setSectionStatuses((prev) => ({ ...prev, [section]: status }));
    },
    [setSectionStatuses],
  );

  const completedCount = useMemo(
    () => sections.filter((s) => sectionStatuses[s] === "complete").length,
    [sectionStatuses, sections],
  );

  const canSubmit = sectionStatuses.kpi === "complete" && sectionStatuses.checkin === "complete";

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
        <SectionResponsabilites reportType={report.type} onStatusChange={(s) => updateSectionStatus("responsabilites", s)} />
      )}
      {activeSection === "todo" && !isWeekly && <SectionTodo />}
      {activeSection === "objectifs" && !isWeekly && <SectionObjectifs reportType={report.type} />}
      {activeSection === "ids" && !isWeekly && <SectionIds reportType={report.type} />}
      {activeSection === "ids" && isWeekly && (
        <SectionIdsWeekly onStatusChange={(s) => updateSectionStatus("ids", s)} />
      )}
      {activeSection === "cloture" && !isWeekly && <SectionCloture reportType={report.type} />}

      {/* STICKY BOTTOM BAR — Preparation mode */}
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
                <CheckCircle2 className="h-4 w-4" />
                Finaliser le rapport
              </Button>
            </span>
          </TooltipTrigger>
          {!canSubmit && <TooltipContent>Complétez KPI et Check-in minimum</TooltipContent>}
        </Tooltip>
      </div>
    </div>
  );
}
