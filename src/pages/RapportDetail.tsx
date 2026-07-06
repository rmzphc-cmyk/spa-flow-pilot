import { useMemo, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useIsMutating } from "@tanstack/react-query";
import { useParams, useOutletContext, useNavigate, Navigate } from "react-router-dom";
import { ReportHeader } from "@/components/rapport/ReportHeader";
import { SectionKpi } from "@/components/rapport/SectionKpi";
import { SectionCheckin } from "@/components/rapport/SectionCheckin";
import { SectionCheckinWeekly } from "@/components/rapport/SectionCheckinWeekly";
import { SectionResponsabilites } from "@/components/rapport/SectionResponsabilites";
import { SectionResponsabilitesWeekly } from "@/components/rapport/SectionResponsabilitesWeekly";
import { SectionTodo } from "@/components/rapport/SectionTodo";
import { SectionTodoWeekly } from "@/components/rapport/SectionTodoWeekly";
import { SectionObjectifs } from "@/components/rapport/SectionObjectifs";
import { SectionIds } from "@/components/rapport/SectionIds";
import { SectionNotes } from "@/components/rapport/SectionNotes";

import { type ReportRecord } from "@/lib/reportsStore";
import { useReport, mapReportRowToRecord, useUpdateReportStatus, useStartMeeting, useFinalizeWeekly, useCloseMeeting } from "@/hooks/useReports";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { useUploadMeetingAudio } from "@/hooks/useAudioUpload";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { CheckCircle2, Play, Square, Mic } from "lucide-react";
import { toast } from "@/hooks/use-toast";

function formatDuration(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export type ReportType = "monthly" | "weekly";
export type SectionId = "kpi" | "checkin" | "responsabilites" | "todo" | "objectifs" | "ids" | "notes";
export type SectionStatus = "complete" | "incomplete" | "warning";

interface OutletContext {
  activeSection: SectionId;
  setActiveSection: (s: SectionId) => void;
  sectionStatuses: Record<SectionId, SectionStatus>;
  setSectionStatuses: React.Dispatch<React.SetStateAction<Record<SectionId, SectionStatus>>>;
  reportType: ReportType;
}

const weeklySections: SectionId[] = ["kpi", "checkin", "responsabilites", "todo", "objectifs", "ids", "notes"];
const monthlySections: SectionId[] = ["kpi", "checkin", "responsabilites", "todo", "objectifs", "ids", "notes"];

export default function RapportDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: row, isLoading, error } = useReport(id);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> {t("rapportDetail.loading")}
      </div>
    );
  }

  if (error || !row) {
    return (
      <div className="py-20 text-center">
        <p className="text-foreground font-medium mb-2">{t("rapportDetail.notFound")}</p>
        <p className="text-sm text-muted-foreground">{t("rapportDetail.notFoundDesc")}</p>
      </div>
    );
  }

  const report: ReportRecord = mapReportRowToRecord(row);

  // LIVE MEETING — monthly in_meeting : sections éditables EN DIRECT + enregistrement.
  // (Refonte : plus de slides lecture seule ; on édite les vraies sections.)
  if (report.type === "monthly" && report.state === "in_meeting") {
    return <PreparationMode report={report} periodStart={row.period_start} periodEnd={row.period_end} spaId={row.spa_id} />;
  }

  // POST-RÉUNION & ARCHIVE — monthly post_meeting_generated OU validated :
  // tout passe par l'écran /post-reunion (arbitrage si en cours, lecture seule si validé).
  if (report.type === "monthly" && (report.state === "post_meeting_generated" || report.state === "validated")) {
    return <Navigate to={`/post-reunion/${report.id}`} replace />;
  }

  // PREPARATION MODE — prépa monthly + tous les weekly (validé = lecture seule intégrée)
  return <PreparationMode report={report} periodStart={row.period_start} periodEnd={row.period_end} spaId={row.spa_id} />;
}


function PreparationMode({ report, periodStart, periodEnd, spaId }: { report: ReportRecord; periodStart: string; periodEnd: string; spaId?: string }) {
  const { t } = useTranslation();
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

  const onObjectifsStatusChange = useCallback(
    (s: SectionStatus) => updateSectionStatus("objectifs", s),
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

  // ── Réunion EN DIRECT (monthly in_meeting) : enregistrement + fin de réunion ──
  const navigate = useNavigate();
  const { spaId: authSpaId } = useAuth();
  const effectiveSpaId = spaId ?? authSpaId ?? "";
  const isInMeeting = report.type === "monthly" && report.state === "in_meeting";
  const recorder = useAudioRecorder();
  const uploadAudio = useUploadMeetingAudio();
  const closeMeeting = useCloseMeeting();
  const [ending, setEnding] = useState(false);
  const closeStartedRef = useRef(false);

  // Auto-démarrage de l'enregistrement à l'entrée en réunion.
  useEffect(() => {
    if (isInMeeting && recorder.status === "idle") {
      recorder.startRecording().catch(() => {/* micro refusé — la réunion continue sans audio */});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInMeeting]);

  const finishClose = useCallback(
    (audio: { storagePath: string; mimeType: string; durationSeconds: number } | null) => {
      closeMeeting.mutate(
        {
          reportId: report.id,
          audioStoragePath: audio?.storagePath,
          audioMimeType: audio?.mimeType,
          audioDurationS: audio?.durationSeconds,
        },
        {
          onSuccess: () => navigate(`/post-reunion/${report.id}`),
          onError: (e) => {
            setEnding(false);
            closeStartedRef.current = false;
            toast({ title: t("common.error"), description: (e as Error).message, variant: "destructive" });
          },
        },
      );
    },
    [closeMeeting, report.id, navigate, t],
  );

  const handleEndMeeting = () => {
    setEnding(true);
    if (recorder.status === "recording" || recorder.status === "paused") {
      recorder.stopRecording(); // → onstop pose le blob ; l'effet ci-dessous enchaîne
    } else if (!closeStartedRef.current) {
      closeStartedRef.current = true;
      finishClose(null); // pas d'enregistrement actif → clôture sans audio
    }
  };

  // Après l'arrêt du micro : upload (si blob) puis clôture — une seule fois.
  useEffect(() => {
    if (!ending || closeStartedRef.current) return;
    if (recorder.status !== "stopped") return;
    closeStartedRef.current = true;
    if (recorder.blob && effectiveSpaId) {
      const mime = recorder.blob.type || "audio/webm";
      const ext = mime.includes("mp4") ? "mp4" : mime.includes("ogg") ? "ogg" : "webm";
      uploadAudio.mutate(
        {
          reportId: report.id,
          spaId: effectiveSpaId,
          blob: recorder.blob,
          mimeType: mime,
          durationSeconds: recorder.durationSeconds,
          filename: `audio.${ext}`,
        },
        {
          onSuccess: (res) =>
            finishClose({ storagePath: res.storagePath, mimeType: res.mimeType, durationSeconds: res.durationSeconds }),
          onError: () => finishClose(null), // upload raté → on clôture quand même
        },
      );
    } else {
      finishClose(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ending, recorder.status, recorder.blob]);

  const renderActionButton = () => {
    if (isValidated) return null;
    // Monthly : "Fin de réunion" pendant la réunion en direct
    if (isInMeeting) {
      return (
        <Button
          size="sm"
          className="gap-1.5 bg-rose-600 hover:bg-rose-700 text-white"
          disabled={ending}
          onClick={handleEndMeeting}
        >
          {ending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}
          {ending ? t("rapportDetail.endingMeeting") : t("rapportDetail.endMeeting")}
        </Button>
      );
    }
    // Monthly : "Lancer la réunion" depuis draft_preparation OU ready_for_review
    if (report.type === "monthly" && (report.state === "draft_preparation" || report.state === "ready_for_review")) {
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
                  toast({ title: t("common.error"), description: (e as Error).message, variant: "destructive" }),
              },
            )
          }
        >
          <Play className="h-4 w-4" />
          {t("rapportDetail.startMeeting")}
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
                        title: t("common.error"),
                        description: (e as Error).message,
                        variant: "destructive",
                      }),
                    onSuccess: () =>
                      toast({ title: t("rapportDetail.reportFinalized") }),
                  },
                )
              }
            >
              {finalizeWeekly.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              {t("rapportDetail.finalizeReport")}
            </Button>
          </span>
        </TooltipTrigger>
        {!canSubmit && <TooltipContent>{t("rapportDetail.completeMinimum")}</TooltipContent>}
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
          <span className="text-sm font-medium">{t("rapportDetail.validatedReadOnly")}</span>
        </div>
      )}

      {isInMeeting && (
        <div className="mx-6 mt-4 mb-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 flex items-center gap-3">
          {recorder.status === "recording" ? (
            <>
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-600" />
              </span>
              <span className="text-sm font-medium text-rose-900">
                {t("rapportDetail.recordingLive", { duration: formatDuration(recorder.durationSeconds) })}
              </span>
            </>
          ) : recorder.status === "acquiring" ? (
            <span className="text-sm text-rose-900 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> {t("rapportDetail.micStarting")}
            </span>
          ) : (
            <span className="text-sm text-amber-700 flex items-center gap-2">
              <Mic className="h-4 w-4" /> {t("rapportDetail.micUnavailable")}
            </span>
          )}
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
      {activeSection === "responsabilites" && isWeekly && (
        <SectionResponsabilitesWeekly
          reportId={report.id}
          isLocked={isLockedForSave}
          onStatusChange={onResponsabilitesStatusChange}
        />
      )}
      {activeSection === "responsabilites" && !isWeekly && (
        <SectionResponsabilites
          reportId={report.id}
          periodStart={periodStart}
          isLocked={isLockedForSave}
          onStatusChange={onResponsabilitesStatusChange}
        />
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
      {activeSection === "objectifs" && (
        <SectionObjectifs
          reportId={report.id}
          reportType={report.type}
          isLocked={isLockedForSave}
          onStatusChange={isWeekly ? onObjectifsStatusChange : undefined}
        />
      )}
      {activeSection === "ids" && !isWeekly && (
        <SectionIds
          reportId={report.id}
          reportType={report.type}
          periodStart={periodStart}
          periodEnd={periodEnd}
        />
      )}
      {activeSection === "ids" && isWeekly && (
        <SectionIds reportId={report.id} reportType="weekly" onStatusChange={onIdsStatusChange} />
      )}
      {activeSection === "notes" && (
        <SectionNotes reportId={report.id} onStatusChange={onNotesStatusChange} isLocked={isLockedForSave} />
      )}
      {/* STICKY BOTTOM BAR */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-[0_-2px_8px_rgba(0,0,0,0.06)] px-6 py-3 flex items-center justify-between z-50">
        <div className="flex items-center gap-4">
          {mutatingCount > 0 ? (
            <span className="flex items-center gap-1.5 text-xs text-amber-600">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {t("rapportDetail.saving")}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-emerald-600">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {t("rapportDetail.saved")}
            </span>
          )}
        </div>
        {renderActionButton()}
      </div>
    </div>
  );
}
