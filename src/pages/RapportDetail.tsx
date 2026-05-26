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
import { isMeetingState, type ReportRecord } from "@/lib/reportsStore";
import { useReport, mapReportRowToRecord, useUpdateReportStatus, useStartMeeting } from "@/hooks/useReports";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Save, CheckCircle2, Play, Send } from "lucide-react";
import { toast } from "@/hooks/use-toast";

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
  const { data: row, isLoading, error } = useReport(id);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Chargement du rapport…
      </div>
    );
  }

  if (error || !row) {
    return (
      <div className="py-20 text-center">
        <p className="text-foreground font-medium mb-2">Rapport introuvable</p>
        <p className="text-sm text-muted-foreground">Ce rapport n'existe pas ou vous n'y avez pas accès.</p>
      </div>
    );
  }

  const report: ReportRecord = mapReportRowToRecord(row);

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

  const updateStatus = useUpdateReportStatus();
  const startMeeting = useStartMeeting();

  const renderActionButton = () => {
    if (report.type === "monthly" && report.state === "draft_preparation") {
      return (
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={updateStatus.isPending}
          onClick={() =>
            updateStatus.mutate(
              { reportId: report.id, status: "ready_for_review" },
              {
                onError: (e) =>
                  toast({ title: "Erreur", description: (e as Error).message, variant: "destructive" }),
              },
            )
          }
        >
          <Send className="h-4 w-4" />
          Soumettre pour révision
        </Button>
      );
    }
    if (report.type === "monthly" && report.state === "ready_for_review") {
      return (
        <Button
          size="sm"
          className="gap-1.5 bg-teal-600 hover:bg-teal-700 text-white"
          disabled={startMeeting.isPending}
          onClick={() =>
            startMeeting.mutate(
              { reportId: report.id },
              {
                onError: (e) =>
                  toast({ title: "Erreur", description: (e as Error).message, variant: "destructive" }),
              },
            )
          }
        >
          <Play className="h-4 w-4" />
          Lancer la réunion
        </Button>
      );
    }
    // weekly: keep existing finalize button
    return (
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
    );
  };

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
        <SectionKpi reportId={report.id} reportType={report.type} period={report.period} onStatusChange={(s) => updateSectionStatus("kpi", s)} />
      )}
      {activeSection === "checkin" && !isWeekly && (
        <SectionCheckin reportId={report.id} onStatusChange={(s) => updateSectionStatus("checkin", s)} />
      )}
      {activeSection === "checkin" && isWeekly && (
        <SectionCheckinWeekly reportId={report.id} onStatusChange={(s) => updateSectionStatus("checkin", s)} />
      )}
      {activeSection === "responsabilites" && !isWeekly && (
        <SectionResponsabilites reportId={report.id} reportType={report.type} onStatusChange={(s) => updateSectionStatus("responsabilites", s)} />
      )}
      {activeSection === "todo" && !isWeekly && <SectionTodo reportId={report.id} />}
      {activeSection === "objectifs" && !isWeekly && <SectionObjectifs reportId={report.id} reportType={report.type} />}
      {activeSection === "ids" && !isWeekly && <SectionIds reportId={report.id} reportType={report.type} />}
      {activeSection === "ids" && isWeekly && (
        <SectionIdsWeekly reportId={report.id} onStatusChange={(s) => updateSectionStatus("ids", s)} />
      )}
      {activeSection === "cloture" && !isWeekly && <SectionCloture reportId={report.id} reportType={report.type} />}

      {/* STICKY BOTTOM BAR — Preparation mode */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-[0_-2px_8px_rgba(0,0,0,0.06)] px-6 py-3 flex items-center justify-between z-50">
        <div className="flex items-center gap-4">
          <Button variant="ghost" className="gap-1.5">
            <Save className="h-4 w-4" />
            Enregistrer
          </Button>
          <AutosaveIndicator />
        </div>
        {renderActionButton()}
      </div>
    </div>
  );
}
