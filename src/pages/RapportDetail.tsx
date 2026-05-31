import { useMemo, useCallback, useEffect } from "react";
import { useIsMutating } from "@tanstack/react-query";
import { useParams, useOutletContext, useNavigate } from "react-router-dom";
import { ReportHeader } from "@/components/rapport/ReportHeader";
import { SectionKpi } from "@/components/rapport/SectionKpi";
import { SectionCheckin } from "@/components/rapport/SectionCheckin";
import { SectionCheckinWeekly } from "@/components/rapport/SectionCheckinWeekly";
import { SectionResponsabilites } from "@/components/rapport/SectionResponsabilites";
import { SectionTodo } from "@/components/rapport/SectionTodo";
import { SectionTodoWeekly } from "@/components/rapport/SectionTodoWeekly";
import { SectionObjectifs } from "@/components/rapport/SectionObjectifs";
import { SectionIds } from "@/components/rapport/SectionIds";
import { SectionIdsWeekly } from "@/components/rapport/SectionIdsWeekly";
import { SectionNotes } from "@/components/rapport/SectionNotes";
import { SectionCloture } from "@/components/rapport/SectionCloture";

import { MeetingView } from "@/components/rapport/MeetingView";
import { type ReportRecord } from "@/lib/reportsStore";
import { useReport, mapReportRowToRecord, useUpdateReportStatus, useStartMeeting, useFinalizeWeekly } from "@/hooks/useReports";
import { Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { CheckCircle2, Play, Send } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export type ReportType = "monthly" | "weekly";
export type SectionId = "kpi" | "checkin" | "responsabilites" | "todo" | "objectifs" | "ids" | "cloture" | "notes";
export type SectionStatus = "complete" | "incomplete" | "warning";

interface OutletContext {
  activeSection: SectionId;
  setActiveSection: (s: SectionId) => void;
  sectionStatuses: Record<SectionId, SectionStatus>;
  setSectionStatuses: React.Dispatch<React.SetStateAction<Record<SectionId, SectionStatus>>>;
  reportType: ReportType;
}

const weeklySections: SectionId[] = ["kpi", "checkin", "todo", "ids", "notes"];
const monthlySections: SectionId[] = ["kpi", "checkin", "responsabilites", "todo", "objectifs", "ids", "notes", "cloture"];

export default function RapportDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: row, isLoading, error } = useReport(id);

  const state = row?.status;
  useEffect(() => {
    if (state === "post_meeting_generated" && id) {
      navigate("/post-reunion/" + id, { replace: true });
    }
  }, [state, id, navigate]);

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

  // MEETING MODE — only during active meeting
  if (report.state === "in_meeting") {
    return <MeetingView report={report} />;
  }

  // PREPARATION MODE (incl. validated read-only) — keep existing editable layout
  return <PreparationMode report={report} periodStart={row.period_start} periodEnd={row.period_end} />;
}


function PreparationMode({ report, periodStart, periodEnd }: { report: ReportRecord; periodStart: string; periodEnd: string }) {
  const { activeSection, sectionStatuses, setSectionStatuses } = useOutletContext<OutletContext>();
  const isWeekly = report.type === "weekly";
  const mutatingCount = useIsMutating();
  const sections = isWeekly ? weeklySections : monthlySections;

  const updateSectionStatus = useCallback(
    (section: SectionId, status: SectionStatus) => {
      setSectionStatuses((prev) => ({ ...prev, [section]: status }));
    },
    [setSectionStatuses],
  );

  const onKpiStatusChange = useCallback(
    (s: SectionStatus) => updateSectionStatus("kpi", s),
    [updateSectionStatus],
  );

  const onCheckinStatusChange = useCallback(
    (s: SectionStatus) => updateSectionStatus("checkin", s),
    [updateSectionStatus],
  );

  const onResponsabilitesStatusChange = useCallback(
    (s: SectionStatus) => updateSectionStatus("responsabilites", s),
    [updateSectionStatus],
  );

  const onIdsStatusChange = useCallback(
    (s: SectionStatus) => updateSectionStatus("ids", s),
    [updateSectionStatus],
  );

  const onNotesStatusChange = useCallback(
    (s: SectionStatus) => updateSectionStatus("notes", s),
    [updateSectionStatus],
  );

  const onTodoWeeklyStatusChange = useCallback(
    (s: SectionStatus) => updateSectionStatus("todo", s),
    [updateSectionStatus],
  );

  const completedCount = useMemo(
    () => sections.filter((s) => sectionStatuses[s] === "complete").length,
    [sectionStatuses, sections],
  );

  const canSubmit = sectionStatuses.kpi === "complete" && sectionStatuses.checkin === "complete";

  const updateStatus = useUpdateReportStatus();
  const startMeeting = useStartMeeting();
  const finalizeWeekly = useFinalizeWeekly();
  const isValidated = report.state === "validated";
  const isLockedForSave = isValidated || finalizeWeekly.isPending;

  const renderActionButton = () => {
    if (isValidated) return null;
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
    // weekly: finalize button wired to edge function
    const weeklyDisabled = !canSubmit || finalizeWeekly.isPending;
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <Button
              size="sm"
              disabled={weeklyDisabled}
              className="gap-1.5"
              onClick={() =>
                finalizeWeekly.mutate(
                  { reportId: report.id },
                  {
                    onError: (e) =>
                      toast({
                        title: "Erreur",
                        description: (e as Error).message,
                        variant: "destructive",
                      }),
                    onSuccess: () =>
                      toast({ title: "Rapport finalisé" }),
                  },
                )
              }
            >
              {finalizeWeekly.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
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
        reportId={report.id}
        reportState={report.state}
        periodStart={periodStart}
        periodEnd={periodEnd}
      />

      {isValidated && (
        <div className="mx-6 mt-4 mb-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-center gap-2 text-emerald-900">
          <Lock className="h-4 w-4" />
          <span className="text-sm font-medium">Rapport validé — lecture seule</span>
        </div>
      )}



      {activeSection === "kpi" && (
        <SectionKpi reportId={report.id} reportType={report.type} period={report.period} yearMonth={report.yearMonth} onStatusChange={onKpiStatusChange} />
      )}
      {activeSection === "checkin" && !isWeekly && (
        <SectionCheckin reportId={report.id} onStatusChange={onCheckinStatusChange} isLocked={isLockedForSave} />
      )}
      {activeSection === "checkin" && isWeekly && (
        <SectionCheckinWeekly reportId={report.id} onStatusChange={onCheckinStatusChange} isLocked={isLockedForSave} />
      )}
      {activeSection === "responsabilites" && !isWeekly && (
        <SectionResponsabilites reportId={report.id} reportType={report.type} onStatusChange={onResponsabilitesStatusChange} />
      )}
      {activeSection === "todo" && !isWeekly && <SectionTodo reportId={report.id} />}
      {activeSection === "todo" && isWeekly && (
        <SectionTodoWeekly
          reportId={report.id}
          periodStart={periodStart}
          periodEnd={periodEnd}
          onStatusChange={onTodoWeeklyStatusChange}
        />
      )}
      {activeSection === "objectifs" && !isWeekly && <SectionObjectifs reportId={report.id} reportType={report.type} />}
      {activeSection === "ids" && !isWeekly && (
        <SectionIds
          reportId={report.id}
          reportType={report.type}
          periodStart={periodStart}
          periodEnd={periodEnd}
        />
      )}
      {activeSection === "ids" && isWeekly && (
        <SectionIdsWeekly reportId={report.id} onStatusChange={onIdsStatusChange} />
      )}
      {activeSection === "notes" && (
        <SectionNotes reportId={report.id} onStatusChange={onNotesStatusChange} isLocked={isLockedForSave} />
      )}
      {activeSection === "cloture" && !isWeekly && <SectionCloture reportId={report.id} reportType={report.type} />}

      {/* STICKY BOTTOM BAR */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-[0_-2px_8px_rgba(0,0,0,0.06)] px-6 py-3 flex items-center justify-between z-50">
        <div className="flex items-center gap-4">
          {mutatingCount > 0 ? (
            <span className="flex items-center gap-1.5 text-xs text-amber-600">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Enregistrement…
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-emerald-600">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Sauvegardé
            </span>
          )}
        </div>
        {renderActionButton()}
      </div>
    </div>
  );
}
