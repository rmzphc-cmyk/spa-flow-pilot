import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import {
  useKpiRoleAssignments,
  ROLE_LABELS,
  type KpiRole,
} from "@/hooks/useKpiRoleAssignments";

import { useNavigate } from "react-router-dom";
import {
  ChevronLeft, ChevronRight, Mic, MicOff, Pause, Square,
  BarChart3, MessageSquare, Users, CheckSquare, Target,
  Lightbulb, FileText, CheckCircle, Loader2, Plus, X,
  PenLine, AlertCircle, Check, Upload, UploadCloud, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ReportRecord } from "@/lib/reportsStore";
import { useAuth } from "@/contexts/AuthContext";
import { useKpiEntries } from "@/hooks/useKpiEntries";
import { useKpiDefinitions } from "@/hooks/useKpiDefinitions";
import { useCheckin, parseKeyContext } from "@/hooks/useCheckin";
import { useTodos, parseTodoDescription } from "@/hooks/useTodos";
import { useObjectives, parseObjectiveDescription } from "@/hooks/useObjectives";
import {
  useIdsItems,
  useAddIdsItem,
  useConvertIdsToTodo,
  useConvertIdsToObjective,
  useIdsItemsForMonthlyPeriod,
  useUpdateIdsStructure,
  TRIAGE_CONFIG,
  type DbIdsItem,
  type TriageMode,
} from "@/hooks/useIdsItems";
import { useResponsabilityTemplates, useResponsabilityLogs } from "@/hooks/useResponsabilites";
import { useCloseMeeting } from "@/hooks/useReports";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { useUploadMeetingAudio } from "@/hooks/useAudioUpload";
import {
  useMeetingSummary,
  useGenerateMeetingSummary,
  useUpdateMeetingSummary,
  useValidateMonthlySummary,
} from "@/hooks/useMeetingSummary";
import { toast } from "@/hooks/use-toast";

/* ── helpers ── */

const statusDotClass = (s: string) =>
  s === "green" ? "bg-emerald-500"
  : s === "amber" ? "bg-amber-500"
  : s === "red" ? "bg-red-500"
  : "bg-muted-foreground/40";

const objectiveStatusBadge = (s: "on_track" | "at_risk" | "behind") => {
  if (s === "on_track") return { label: "En bonne voie", cls: "bg-emerald-100 text-emerald-800" };
  if (s === "at_risk") return { label: "À risque", cls: "bg-amber-100 text-amber-800" };
  return { label: "En retard", cls: "bg-red-100 text-red-800" };
};

function formatDelta(current: number | null, n1: number | null): string {
  if (current === null || n1 === null || n1 === 0) return "—";
  const diff = ((current - n1) / Math.abs(n1)) * 100;
  return `${diff > 0 ? "+" : ""}${diff.toFixed(1)} %`;
}

function formatDuration(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

const LIVE_SLIDE_META = [
  { icon: BarChart3,     label: "KPI" },
  { icon: MessageSquare, label: "Check-in" },
  { icon: Users,         label: "Responsabilités" },
  { icon: CheckSquare,   label: "Todos" },
  { icon: Target,        label: "Objectifs" },
  { icon: Lightbulb,     label: "IDS" },
  { icon: FileText,      label: "Notes" },
  { icon: CheckCircle,   label: "Clôture" },
];

const CLOSING_SLIDE_META = [
  ...LIVE_SLIDE_META,
  { icon: Sparkles,      label: "Synthèse IA" },
  { icon: Lightbulb,     label: "IDS — Structuration" },
  { icon: CheckCircle,   label: "Validation" },
];

/* ── component ── */

interface Props {
  report: ReportRecord;
  periodStart?: string;
  periodEnd?: string;
  readOnly?: boolean;
}

export function MeetingView({ report, periodStart, periodEnd, readOnly = false }: Props) {
  const navigate = useNavigate();
  const { spaId } = useAuth();

  const [currentSlide, setCurrentSlide] = useState(0);
  const [meetingPhase, setMeetingPhase] = useState<"live" | "closing">("live");
  const SLIDE_META = meetingPhase === "closing" ? CLOSING_SLIDE_META : LIVE_SLIDE_META;
  const TOTAL = SLIDE_META.length;
  const [editedSummary, setEditedSummary] = useState("");
  const [editedDecisions, setEditedDecisions] = useState<string[]>([]);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [slideDecisions, setSlideDecisions] = useState<Record<number, string[]>>({});
  const [newDecision, setNewDecision] = useState("");
  const [newIdsText, setNewIdsText] = useState("");
  const [closeConfirm, setCloseConfirm] = useState(false);
  const [audioStoragePath, setAudioStoragePath] = useState<string | null>(null);
  const [audioMimeType, setAudioMimeType] = useState<string | null>(null);
  const [audioDurationS, setAudioDurationS] = useState<number | null>(null);

  const recorder = useAudioRecorder();
  const uploadAudio = useUploadMeetingAudio();

  const kpiEntriesQ  = useKpiEntries(report.id);
  const kpiDefsQ     = useKpiDefinitions(spaId);
  const checkinQ     = useCheckin(report.id);
  const todosQ       = useTodos(report.id, spaId);
  const objectivesQ  = useObjectives(spaId);
  const idsQ         = useIdsItems(report.id);
  const monthlyIdsQ  = useIdsItemsForMonthlyPeriod(
    report.type === "monthly" ? spaId ?? undefined : undefined,
    periodStart,
    periodEnd,
  );
  const respTemplatesQ = useResponsabilityTemplates(spaId);
  const respLogsQ      = useResponsabilityLogs(report.id);
  const addIds           = useAddIdsItem(report.id, report.type);
  const convertToTodo    = useConvertIdsToTodo(report.id);
  const convertToObjective = useConvertIdsToObjective(report.id);
  const closeMeeting     = useCloseMeeting();

  // Hooks Phase 2
  const summaryQ        = useMeetingSummary(meetingPhase === "closing" ? report.id : undefined);
  const generateSummary = useGenerateMeetingSummary();
  const updateSummary   = useUpdateMeetingSummary();
  const validateMonthly = useValidateMonthlySummary();
  const updateIdsStructure = useUpdateIdsStructure();

  /* debounced summary update */
  const summaryDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedUpdateSummary = useCallback((newSummary: string, newKeyActions: string[]) => {
    if (summaryDebounceRef.current) clearTimeout(summaryDebounceRef.current);
    summaryDebounceRef.current = setTimeout(() => {
      updateSummary.mutate(
        { reportId: report.id, newSummary, newKeyActions },
        {
          onError: () => {
            toast({ title: "Erreur", description: "Une erreur est survenue. Réessayez.", variant: "destructive" });
          },
        },
      );
    }, 1000);
  }, [report.id, updateSummary]);

  /* auto-start enregistrement dès le lancement de la réunion */
  useEffect(() => {
    if (!readOnly && recorder.status === "idle") {
      recorder.startRecording().catch(() => {/* micro refusé — la réunion continue sans audio */});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* sync état local d'édition quand la synthèse IA arrive (init une seule fois) */
  useEffect(() => {
    if (summaryQ.data?.executive_summary && !editedSummary) {
      setEditedSummary(summaryQ.data.executive_summary);
    }
    if (summaryQ.data?.key_actions && editedDecisions.length === 0) {
      try {
        const parsed = JSON.parse(summaryQ.data.key_actions);
        if (Array.isArray(parsed)) setEditedDecisions(parsed);
      } catch { /* ignore */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summaryQ.data]);

  /* derived */
  const defsById = new Map((kpiDefsQ.data ?? []).map((d) => [d.id, d]));
  const kpiRows  = (kpiEntriesQ.data ?? [])
    .map((e) => ({ entry: e, def: defsById.get(e.kpi_definition_id) }))
    .filter((r) => r.def)
    .sort((a, b) => (a.def!.display_order ?? 0) - (b.def!.display_order ?? 0));

  // Role assignments
  const kpiDefIds = useMemo(
    () => (kpiDefsQ.data ?? []).map((d) => d.id),
    [kpiDefsQ.data]
  );
  const { data: roleAssignments = [] } = useKpiRoleAssignments(kpiDefIds);

  const ROLE_PRIORITY: KpiRole[] = ["spa_manager", "therapist", "spa_concierge", "ambassador"];
  const primaryRoleByKpiId = useMemo(() => {
    const map = new Map<string, KpiRole>();
    for (const role of ROLE_PRIORITY) {
      for (const a of roleAssignments) {
        if (a.role === role && !map.has(a.kpi_definition_id)) {
          map.set(a.kpi_definition_id, a.role);
        }
      }
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleAssignments]);

  const primaryNiveauByKpiId = useMemo(() => {
    const map = new Map<string, string>();
    for (const role of ROLE_PRIORITY) {
      for (const a of roleAssignments) {
        if (a.role === role && !map.has(a.kpi_definition_id)) {
          map.set(a.kpi_definition_id, a.niveau);
        }
      }
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleAssignments]);

  const ROLE_SECTION_ORDER_VIEW: KpiRole[] = ["spa_manager", "therapist", "spa_concierge", "ambassador"];
  const kpiRowsByRole = useMemo(() => {
    const groups = new Map<KpiRole | "other", typeof kpiRows>();
    groups.set("other", []);
    for (const r of ROLE_SECTION_ORDER_VIEW) groups.set(r, []);
    for (const row of kpiRows) {
      const role = primaryRoleByKpiId.get(row.entry.kpi_definition_id);
      if (role) groups.get(role)!.push(row);
      else groups.get("other")!.push(row);
    }
    return groups;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kpiRows, primaryRoleByKpiId]);


  const checkin        = checkinQ.data;
  const checkinKc      = parseKeyContext(checkin?.key_context);
  const reportTodos    = (todosQ.data ?? []).filter((t) => t.status !== "done");
  const respLogs       = respLogsQ.data ?? {};
  const totalDecisions = Object.values(slideDecisions).flat().length;
  const currentDecisions = slideDecisions[currentSlide] ?? [];

  /* handlers */
  const goTo = useCallback((idx: number) => {
    setCurrentSlide(Math.max(0, Math.min(TOTAL - 1, idx)));
    setIsPanelOpen(false);
  }, [TOTAL]);

  const addDecision = () => {
    const text = newDecision.trim();
    if (!text) return;
    setSlideDecisions((prev) => ({
      ...prev,
      [currentSlide]: [...(prev[currentSlide] ?? []), text],
    }));
    setNewDecision("");
  };

  const removeDecision = (slideIdx: number, decIdx: number) => {
    setSlideDecisions((prev) => ({
      ...prev,
      [slideIdx]: (prev[slideIdx] ?? []).filter((_, i) => i !== decIdx),
    }));
  };

  const handleAddIds = () => {
    const text = newIdsText.trim();
    if (!text) return;
    addIds.mutate(text, { onSuccess: () => setNewIdsText("") });
  };

  const handleClose = () => {
    setCloseConfirm(false);
    if (recorder.status === "recording" || recorder.status === "paused") {
      recorder.stopRecording();
    }
    closeMeeting.mutate(
      {
        reportId: report.id,
        audioStoragePath: audioStoragePath ?? undefined,
        audioMimeType: audioMimeType ?? undefined,
        audioDurationS: audioDurationS ?? undefined,
      },
      {
        onSuccess: (res) => {
          if (res.warning) toast({ title: "Réunion clôturée", description: res.warning });
          else toast({ title: "Réunion clôturée ✓", description: "Génération de la synthèse IA en cours…" });
          setMeetingPhase("closing");
          setCurrentSlide(8);
          generateSummary.mutate({ reportId: report.id });
        },
        onError: (e) =>
          toast({ title: "Erreur", description: (e as Error).message, variant: "destructive" }),
      },
    );
  };

  /* recording controls (inline render) */
  const renderRecordingControls = () => {
    const { status, durationSeconds, error: recErr, startRecording, stopRecording, pauseRecording, resumeRecording } = recorder;
    return (
      <div className="flex items-center gap-2">
        {recErr && (
          <span className="text-xs text-destructive bg-destructive/10 px-2 py-1 rounded-full max-w-[160px] truncate" title={recErr}>
            {recErr}
          </span>
        )}
        {status === "idle" && (
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={startRecording}>
            <Mic className="h-3.5 w-3.5 text-rose-500" /> Enregistrer
          </Button>
        )}
        {status === "acquiring" && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Accès micro…
          </span>
        )}
        {(status === "recording" || status === "paused") && (
          <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 rounded-lg px-2 py-1">
            {status === "recording"
              ? <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
              : <span className="h-2 w-2 rounded-full bg-amber-400" />}
            <span className="text-xs font-mono font-medium text-rose-800">{formatDuration(durationSeconds)}</span>
            {status === "recording"
              ? <button onClick={pauseRecording} className="text-rose-700 hover:text-rose-900 ml-1" title="Pause"><Pause className="h-3.5 w-3.5" /></button>
              : <button onClick={resumeRecording} className="text-amber-700 hover:text-amber-900 ml-1" title="Reprendre"><Mic className="h-3.5 w-3.5" /></button>}
            <button onClick={stopRecording} className="text-rose-700 hover:text-rose-900" title="Arrêter"><Square className="h-3.5 w-3.5" /></button>
          </div>
        )}
        {status === "stopped" && (
          <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-1">
            <Check className="h-3.5 w-3.5" />
            Enregistré ({formatDuration(durationSeconds)})
          </div>
        )}
        {status === "error" && (
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={startRecording}>
            <MicOff className="h-3.5 w-3.5 text-rose-500" /> Réessayer
          </Button>
        )}
      </div>
    );
  };

  /* slides */
  const renderSlide = () => {
    switch (currentSlide) {

      /* ── 0 : KPI ── */
      case 0: {
        const ROLE_COLORS_VIEW: Record<KpiRole | "other", { bg: string; text: string; border: string; icon: string }> = {
          spa_manager:   { bg: "bg-teal-50",   text: "text-teal-800",   border: "border-teal-200",   icon: "👤" },
          therapist:     { bg: "bg-violet-50", text: "text-violet-800", border: "border-violet-200", icon: "💆" },
          spa_concierge: { bg: "bg-amber-50",  text: "text-amber-800",  border: "border-amber-200",  icon: "🛎️" },
          ambassador:    { bg: "bg-rose-50",   text: "text-rose-800",   border: "border-rose-200",   icon: "⭐" },
          other:         { bg: "bg-gray-50",   text: "text-gray-600",   border: "border-gray-200",   icon: "📊" },
        };
        const ROLE_LABELS_VIEW: Record<KpiRole | "other", string> = {
          ...ROLE_LABELS,
          other: "Autres KPIs",
        };
        const allSections: (KpiRole | "other")[] = [...ROLE_SECTION_ORDER_VIEW, "other"];

        return (
          <div className="space-y-6">
            {kpiRows.length === 0 ? (
              <p className="text-muted-foreground">Aucun KPI renseigné.</p>
            ) : (
              allSections.map((role) => {
                const rows = kpiRowsByRole.get(role) ?? [];
                if (rows.length === 0) return null;
                const colors = ROLE_COLORS_VIEW[role];
                return (
                  <div key={role}>
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg mb-3 ${colors.bg} border ${colors.border}`}>
                      <span>{colors.icon}</span>
                      <span className={`text-xs font-bold uppercase tracking-wide ${colors.text}`}>
                        {ROLE_LABELS_VIEW[role]}
                      </span>
                      <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full ${colors.bg} ${colors.text} border ${colors.border}`}>
                        {rows.length} KPI{rows.length > 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-base">
                        <thead>
                          <tr className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            <th className="pb-2 pr-4">Indicateur</th>
                            <th className="pb-2 px-4 text-right">N-1</th>
                            <th className="pb-2 px-4 text-right">Réel</th>
                            <th className="pb-2 pl-4 text-right">Évolution</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {rows.map(({ entry, def }) => (
                            <tr key={entry.id} className="hover:bg-muted/30 transition-colors">
                              <td className="py-3 pr-4 font-medium text-foreground">
                                <span className="inline-flex items-center gap-2 flex-wrap">
                                  <span className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${statusDotClass(entry.status)}`} />
                                  {def!.name}
                                  {def!.unit && <span className="text-muted-foreground text-sm">({def!.unit})</span>}
                                  {(() => {
                                    const niveau = primaryNiveauByKpiId.get(entry.kpi_definition_id);
                                    if (!niveau) return null;
                                    return (
                                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                                        niveau === "prioritaire" ? "bg-teal-100 text-teal-700" :
                                        niveau === "secondaire"  ? "bg-blue-100 text-blue-700" :
                                        "bg-gray-100 text-gray-600"
                                      }`}>{niveau}</span>
                                    );
                                  })()}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right text-muted-foreground tabular-nums">{entry.value_n1 ?? "—"}</td>
                              <td className="py-3 px-4 text-right font-semibold text-foreground tabular-nums text-lg">{entry.value_current ?? "—"}</td>
                              <td className="py-3 pl-4 text-right font-semibold tabular-nums text-muted-foreground">{formatDelta(entry.value_current, entry.value_n1)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        );
      }



      /* ── 1 : Check-in ── */
      case 1:
        return (
          <div className="space-y-5">
            {!checkin
              ? <p className="text-muted-foreground">Pas de check-in renseigné.</p>
              : (
                <>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-border p-5 bg-muted/30">
                      <p className="text-sm text-muted-foreground">Météo équipe</p>
                      <p className="text-3xl font-bold text-foreground mt-1">{checkin.mood_score} / 5</p>
                      {checkinKc.equipeComment && <p className="text-sm text-muted-foreground mt-2 italic">{checkinKc.equipeComment}</p>}
                    </div>
                    <div className="rounded-xl border border-border p-5 bg-muted/30">
                      <p className="text-sm text-muted-foreground">Énergie manager</p>
                      <p className="text-3xl font-bold text-foreground mt-1">{checkin.focus_level} / 5</p>
                      {checkinKc.managerComment && <p className="text-sm text-muted-foreground mt-2 italic">{checkinKc.managerComment}</p>}
                    </div>
                  </div>
                  {checkinKc.situation && (
                    <div className="rounded-xl border border-border p-5 bg-card">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Situation globale</p>
                      <p className="text-foreground whitespace-pre-line">{checkinKc.situation}</p>
                    </div>
                  )}
                </>
              )}
          </div>
        );

      /* ── 2 : Responsabilités ── */
      case 2:
        return (
          <div className="space-y-2">
            {(respTemplatesQ.data ?? []).length === 0
              ? <p className="text-muted-foreground">Aucune responsabilité configurée.</p>
              : (respTemplatesQ.data ?? []).map((tmpl) => {
                  const log  = respLogs[tmpl.id];
                  const rate = log?.completion_rate ?? null;
                  const badge = rate === 100 ? { label: "100 %", cls: "bg-emerald-100 text-emerald-800" }
                    : rate === 50  ? { label: "50 %",  cls: "bg-amber-100 text-amber-800" }
                    : rate === 0   ? { label: "0 %",   cls: "bg-red-100 text-red-800" }
                    : { label: "—", cls: "bg-muted text-muted-foreground" };
                  return (
                    <div key={tmpl.id} className="rounded-xl border border-border p-4 bg-card flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-medium text-foreground text-sm">{tmpl.title}</p>
                        {log?.comment && <p className="text-xs text-muted-foreground mt-0.5 italic">{log.comment}</p>}
                      </div>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${badge.cls}`}>{badge.label}</span>
                    </div>
                  );
                })}
          </div>
        );

      /* ── 3 : Todos ── */
      case 3:
        return (
          <div className="space-y-2">
            {reportTodos.length === 0
              ? <p className="text-muted-foreground">Aucune to-do active.</p>
              : reportTodos.map((t) => {
                  const meta = parseTodoDescription(t.description);
                  return (
                    <div key={t.id} className="rounded-xl border border-border p-4 bg-card flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-medium text-foreground text-sm">{t.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          👤 {meta.responsible || "—"}{t.due_date && <> · 📅 {t.due_date}</>}
                        </p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 font-medium ${
                        t.status === "in_progress" ? "bg-blue-100 text-blue-800" : "bg-muted text-muted-foreground"
                      }`}>
                        {t.status === "in_progress" ? "En cours" : "À faire"}
                      </span>
                    </div>
                  );
                })}
          </div>
        );

      /* ── 4 : Objectifs ── */
      case 4:
        return (
          <div className="space-y-4">
            {(objectivesQ.data ?? []).length === 0
              ? <p className="text-muted-foreground">Aucun objectif actif.</p>
              : (objectivesQ.data ?? []).map((o) => {
                  const parsed   = parseObjectiveDescription(o.description);
                  const badge    = objectiveStatusBadge(parsed.status_ui);
                  const progress = parsed.target > 0 ? Math.min(100, Math.round((parsed.current / parsed.target) * 100)) : 0;
                  return (
                    <div key={o.id} className="rounded-xl border border-border p-5 bg-card">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-semibold text-foreground">{o.title}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.cls}`}>{badge.label}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-foreground tabular-nums">{parsed.current}{parsed.unit}</span>
                        <div className="flex-1 h-2.5 bg-border rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
                        </div>
                        <span className="text-sm text-muted-foreground tabular-nums">{parsed.target}{parsed.unit}</span>
                      </div>
                      {parsed.comment && <p className="text-xs text-muted-foreground mt-2 italic">{parsed.comment}</p>}
                    </div>
                  );
                })}
          </div>
        );

      /* ── 5 : IDS ── */
      case 5:
        return (
          <div className="space-y-6">
            {/* Bloc A — IDS weekly du mois */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-amber-500" />
                Problèmes du mois (weekly)
              </h3>
              {monthlyIdsQ.isLoading
                ? <div className="flex items-center gap-2 text-muted-foreground text-sm py-4"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</div>
                : monthlyIdsQ.data.length === 0
                  ? <p className="text-sm text-muted-foreground italic">Aucun IDS remonté lors des weekly de ce mois.</p>
                  : (
                    <div className="space-y-2">
                      {monthlyIdsQ.data.map((item) => {
                        const hasTodo  = item.converted_to_todo_id !== null;
                        const hasObj   = item.converted_to_objective_id !== null;
                        const isResolved = hasTodo || hasObj;
                        return (
                          <div key={item.id} className="rounded-xl border border-border p-3 bg-card">
                            <div className="flex items-start gap-3">
                              <Lightbulb className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                                    {item.report_cycle_label}
                                  </span>
                                  {hasTodo && (
                                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                                      <Check className="h-3 w-3" /> Todo
                                    </span>
                                  )}
                                  {hasObj && (
                                    <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                                      <Check className="h-3 w-3" /> Objectif
                                    </span>
                                  )}
                                  {!isResolved && (
                                    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                                      <AlertCircle className="h-3 w-3" /> Non traité
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-foreground">{item.capture_text}</p>
                              </div>
                            </div>
                            {!isResolved && (
                              <div className="flex gap-2 mt-2.5 ml-7 flex-wrap">
                                <Button
                                  size="sm" variant="outline" className="h-7 text-xs gap-1"
                                  disabled={convertToTodo.isPending}
                                  onClick={() => convertToTodo.mutate(item)}
                                >
                                  <CheckSquare className="h-3 w-3" /> → Todo
                                </Button>
                                <Button
                                  size="sm" variant="outline" className="h-7 text-xs gap-1"
                                  disabled={convertToObjective.isPending}
                                  onClick={() => convertToObjective.mutate(item)}
                                >
                                  <Target className="h-3 w-3" /> → Objectif
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
            </div>

            {/* Bloc B — Nouveaux IDS monthly */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">Nouveaux points soulevés en réunion</h3>
              <div className="flex gap-2 mb-3">
                <Input
                  placeholder="Décrire le problème (max 150 car.)"
                  maxLength={150}
                  value={newIdsText}
                  onChange={(e) => setNewIdsText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddIds()}
                  className="flex-1"
                />
                <Button size="sm" onClick={handleAddIds} disabled={addIds.isPending || !newIdsText.trim()} className="gap-1.5 shrink-0">
                  <Plus className="h-4 w-4" /> Ajouter
                </Button>
              </div>
              {(idsQ.data ?? []).length === 0
                ? <p className="text-sm text-muted-foreground italic">Aucun nouveau point capturé.</p>
                : (
                  <div className="space-y-2">
                    {(idsQ.data ?? []).map((item, i) => (
                      <div key={item.id} className="rounded-xl border border-border bg-amber-50 p-3 flex gap-3 items-start">
                        <span className="text-xs font-bold text-amber-700 w-5 shrink-0">#{i + 1}</span>
                        <p className="text-sm text-foreground flex-1">{item.capture_text}</p>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          </div>
        );

      /* ── 6 : Notes libres ── */
      case 6:
        return (
          <div>
            {checkinKc.free_note
              ? (
                <div className="rounded-xl border border-border p-5 bg-card">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-1.5">
                    <PenLine className="h-3.5 w-3.5" /> Notes libres
                  </p>
                  <p className="text-foreground whitespace-pre-line leading-relaxed">{checkinKc.free_note}</p>
                </div>
              )
              : <p className="text-muted-foreground">Aucune note libre saisie en préparation.</p>}
          </div>
        );

      /* ── 7 : Clôture ── */
      case 7:
        return (
          <div className="space-y-6">
            {/* Récap chiffres */}
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-xl border border-border p-4 bg-muted/30 text-center">
                <p className="text-2xl font-bold text-foreground">{monthlyIdsQ.data.length}</p>
                <p className="text-xs text-muted-foreground mt-0.5">IDS du mois</p>
              </div>
              <div className="rounded-xl border border-border p-4 bg-muted/30 text-center">
                <p className="text-2xl font-bold text-foreground">{(idsQ.data ?? []).length}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Nouveaux IDS</p>
              </div>
              <div className="rounded-xl border border-border p-4 bg-muted/30 text-center">
                <p className="text-2xl font-bold text-foreground">{totalDecisions}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Décisions prises</p>
              </div>
            </div>

            {/* Décisions groupées par slide */}
            {totalDecisions > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">Décisions de la réunion</h3>
                <div className="space-y-2">
                  {SLIDE_META.map((meta, idx) => {
                    const decisions = slideDecisions[idx] ?? [];
                    if (decisions.length === 0) return null;
                    return (
                      <div key={idx} className="rounded-xl border border-border p-3 bg-card">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">{meta.label}</p>
                        <ul className="space-y-1">
                          {decisions.map((d, di) => (
                            <li key={di} className="text-sm text-foreground flex items-start gap-2">
                              <span className="text-primary mt-0.5">•</span>{d}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Section enregistrement audio */}
            <div className="rounded-xl border border-border p-4 bg-card space-y-3">
              <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                <UploadCloud className="h-4 w-4 text-muted-foreground" />
                Enregistrement audio
              </p>

              {recorder.blob && !audioStoragePath && (
                <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                  <span className="text-sm text-emerald-800 flex items-center gap-2">
                    <Check className="h-4 w-4" /> Enregistré in-app ({formatDuration(recorder.durationSeconds)})
                  </span>
                  <Button
                    size="sm" variant="outline" className="gap-1.5 text-xs shrink-0"
                    disabled={uploadAudio.isPending}
                    onClick={() => {
                      const mime = recorder.blob!.type || "audio/webm";
                      const ext = mime.includes("mp4") ? "mp4" : mime.includes("ogg") ? "ogg" : "webm";
                      uploadAudio.mutate(
                        { reportId: report.id, spaId: spaId ?? "", blob: recorder.blob!, mimeType: mime, durationSeconds: recorder.durationSeconds, filename: `audio.${ext}` },
                        {
                          onSuccess: (res) => {
                            setAudioStoragePath(res.storagePath);
                            setAudioMimeType(res.mimeType);
                            setAudioDurationS(res.durationSeconds);
                            toast({ title: "Audio sauvegardé ✓" });
                          },
                          onError: () => {
                            toast({ title: "Erreur", description: "Une erreur est survenue. Réessayez.", variant: "destructive" });
                          },
                        },
                      );
                    }}
                  >
                    {uploadAudio.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    Sauvegarder
                  </Button>
                </div>
              )}

              {!audioStoragePath && (
                <div>
                  <input type="file" id="audio-import-input"
                    accept="audio/mp3,audio/mpeg,audio/mp4,audio/x-m4a,audio/m4a,audio/wav,audio/webm,audio/ogg"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 20 * 1024 * 1024) {
                        toast({ title: "Fichier trop volumineux", description: "Recommandé < 20 Mo (limite Whisper : 25 Mo)", variant: "destructive" });
                        e.target.value = ""; return;
                      }
                      const mime = file.type || "audio/mpeg";
                      const filename = `import_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
                      uploadAudio.mutate(
                        { reportId: report.id, spaId: spaId ?? "", blob: file, mimeType: mime, durationSeconds: 0, filename },
                        {
                          onSuccess: (res) => {
                            setAudioStoragePath(res.storagePath);
                            setAudioMimeType(res.mimeType);
                            setAudioDurationS(res.durationSeconds);
                            toast({ title: "Audio sauvegardé ✓" });
                          },
                          onError: () => {
                            toast({ title: "Erreur", description: "Une erreur est survenue. Réessayez.", variant: "destructive" });
                          },
                        },
                      );
                      e.target.value = "";
                    }}
                  />
                  <label htmlFor="audio-import-input"
                    className={`flex items-center gap-2 text-sm text-muted-foreground border border-dashed border-border rounded-lg px-3 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors ${uploadAudio.isPending ? "opacity-50 pointer-events-none" : ""}`}
                  >
                    {uploadAudio.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                    Importer un fichier audio (MP3, M4A, MP4, WAV)
                  </label>
                </div>
              )}

              {audioStoragePath && (
                <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                  <Check className="h-4 w-4 shrink-0" />
                  <span>Audio sauvegardé — transcription disponible après clôture</span>
                </div>
              )}

              {!recorder.blob && !audioStoragePath && !uploadAudio.isPending && (
                <p className="text-xs text-muted-foreground">
                  Utilisez l'enregistrement in-app (header) ou importez un fichier audio externe.
                </p>
              )}
            </div>

            <Button
              className="w-full gap-2 bg-teal-600 hover:bg-teal-700 text-white"
              disabled={closeMeeting.isPending}
              onClick={() => setCloseConfirm(true)}
            >
              {closeMeeting.isPending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <CheckCircle className="h-4 w-4" />}
              Clôturer la réunion
            </Button>
          </div>
        );

      /* ── 8 : Synthèse IA (Phase 2) ── */
      case 8:
        return (
          <div className="space-y-6">
            {(generateSummary.isPending || summaryQ.isLoading || !summaryQ.data?.executive_summary) ? (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm font-medium text-foreground">Génération de la synthèse IA en cours…</p>
                <p className="text-xs text-muted-foreground">~10–15 secondes</p>
              </div>
            ) : (
              <>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-foreground">Résumé exécutif</h3>
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                      <Sparkles className="h-3 w-3" /> Synthèse IA
                    </span>
                  </div>
                  <Textarea
                    className="text-sm min-h-[140px]"
                    value={editedSummary}
                    onChange={(e) => {
                      setEditedSummary(e.target.value);
                      debouncedUpdateSummary(e.target.value, editedDecisions);
                    }}
                    placeholder="Résumé de la réunion…"
                  />
                </div>
                {editedDecisions.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-3">Décisions clés</h3>
                    <div className="space-y-2">
                      {editedDecisions.map((d, i) => (
                        <div key={i} className="flex items-start gap-2 bg-muted/40 rounded-lg px-3 py-2">
                          <span className="text-primary mt-0.5 shrink-0">•</span>
                          <p className="text-sm text-foreground">{d}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <Button className="w-full gap-2" onClick={() => goTo(9)}>
                  <CheckSquare className="h-4 w-4" /> Passer à la structuration IDS →
                </Button>
              </>
            )}
          </div>
        );

      /* ── 9 : IDS Structuration collaborative (Phase 2) ── */
      case 9: {
        const idsItems = (idsQ.data ?? []) as DbIdsItem[];
        const TRIAGE_ORDER: (TriageMode | null)[] = ["bloquant", "deleguer", "priorite", "veille", null];
        const grouped = new Map<TriageMode | null, DbIdsItem[]>([
          ["bloquant", []],
          ["deleguer", []],
          ["priorite", []],
          ["veille", []],
          [null, []],
        ]);
        for (const item of idsItems) {
          const mode = (item.triage_mode ?? null) as TriageMode | null;
          grouped.get(mode)!.push(item);
        }
        const untriaged = grouped.get(null) ?? [];
        const hasUntriaged = untriaged.length > 0;

        return (
          <div className="space-y-5">
            {hasUntriaged && (
              <div className="flex items-center gap-2 px-4 py-2.5 bg-orange-50 border border-orange-200 rounded-lg">
                <AlertCircle className="h-4 w-4 text-orange-500 shrink-0" />
                <p className="text-sm text-orange-800 font-medium">
                  {untriaged.length} IDS non qualifié{untriaged.length > 1 ? "s" : ""} — à trier avant de clôturer
                </p>
              </div>
            )}

            {TRIAGE_ORDER.map((mode) => {
              const items = grouped.get(mode) ?? [];
              if (items.length === 0) return null;
              const cfg = mode ? TRIAGE_CONFIG[mode] : null;
              const sectionLabel = cfg ? `${cfg.icon} ${cfg.label.toUpperCase()}` : "❓ À TRIER";
              const sectionBg = cfg ? cfg.color : "bg-orange-50";
              const sectionText = cfg ? cfg.textColor : "text-orange-800";
              const sectionBorder = cfg ? cfg.borderColor : "border-orange-300";

              return (
                <div key={mode ?? "untriaged"}>
                  <div className={`flex items-center justify-between px-3 py-2 rounded-lg mb-2 ${sectionBg} border ${sectionBorder}`}>
                    <span className={`text-xs font-bold uppercase tracking-wide ${sectionText}`}>
                      {sectionLabel}
                    </span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full bg-white/60 ${sectionText}`}>
                      {items.length} item{items.length > 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="space-y-1.5 pl-2">
                    {items.map((item) => {
                      const hasTodo = item.converted_to_todo_id !== null;
                      const hasObj = item.converted_to_objective_id !== null;
                      return (
                        <div key={item.id} className="flex items-start gap-3 bg-card border border-border rounded-lg p-2.5">
                          <Lightbulb className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground">{item.capture_text}</p>
                            <div className="flex flex-wrap gap-1.5 mt-1">
                              {hasTodo && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full">
                                  <Check className="h-2.5 w-2.5" /> To-Do ✓
                                </span>
                              )}
                              {hasObj && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full">
                                  <Check className="h-2.5 w-2.5" /> Objectif ✓
                                </span>
                              )}
                              {!hasTodo && !hasObj && mode && mode !== "veille" && (
                                <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200">
                                  À convertir
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {idsItems.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                Aucun IDS remonté ce mois.
              </p>
            )}

            <Button className="w-full gap-2" onClick={() => goTo(10)}>
              <CheckCircle className="h-4 w-4" /> Passer à la validation →
            </Button>
          </div>
        );
      }


      /* ── 10 : Validation (Phase 2) ── */
      case 10: {
        const idsItems = (idsQ.data ?? []) as DbIdsItem[];
        const structured = idsItems.filter((i) => i.proposed_solution?.trim()).length;
        const incomplete = idsItems.length - structured;
        const hasSynthesis = !!summaryQ.data?.executive_summary;
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-xl border border-border p-4 bg-muted/30 text-center">
                <p className={`text-2xl font-bold ${hasSynthesis ? "text-emerald-600" : "text-amber-600"}`}>
                  {hasSynthesis ? "✓" : "…"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Synthèse IA</p>
              </div>
              <div className="rounded-xl border border-border p-4 bg-muted/30 text-center">
                <p className="text-2xl font-bold text-foreground">{structured}/{idsItems.length}</p>
                <p className="text-xs text-muted-foreground mt-0.5">IDS structurés</p>
              </div>
              <div className="rounded-xl border border-border p-4 bg-muted/30 text-center">
                <p className="text-2xl font-bold text-foreground">{Object.values(slideDecisions).flat().length}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Décisions</p>
              </div>
            </div>
            {incomplete > 0 && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{incomplete} IDS sans solution — le rapport sera tout de même diffusé.</span>
              </div>
            )}
            {!hasSynthesis && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-800">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>La synthèse IA est requise avant validation.</span>
              </div>
            )}
            <Button
              className="w-full gap-2 bg-teal-600 hover:bg-teal-700 text-white"
              disabled={!hasSynthesis || validateMonthly.isPending}
              onClick={() => validateMonthly.mutate({ reportId: report.id })}
            >
              {validateMonthly.isPending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <CheckCircle className="h-4 w-4" />}
              Valider et diffuser à la Direction
            </Button>
          </div>
        );
      }

      default:
        return null;
    }
  };

  /* ── RENDER ── */
  const currentMeta = SLIDE_META[currentSlide];
  const SlideIcon   = currentMeta.icon;

  return (
    <div className="fixed inset-0 bg-background z-40 flex flex-col overflow-hidden">

      {/* ── Header sticky ── */}
      <header className="shrink-0 bg-card border-b border-border shadow-sm z-10">
        <div className="max-w-[1100px] mx-auto px-5 py-3 flex items-center justify-between gap-3">
          {/* Left */}
          <div className="flex items-center gap-3 min-w-0">
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${
              report.type === "weekly" ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-blue-800"
            }`}>
              {report.type === "weekly" ? "🟢 Weekly" : "🔵 Monthly"}
            </span>
            <div className="min-w-0 hidden sm:block">
              <h1 className="text-sm font-bold text-foreground truncate">{report.label}</h1>
            </div>
            <span className="text-xs text-muted-foreground shrink-0 font-medium">
              {currentSlide + 1} / {TOTAL} — {currentMeta.label}
            </span>
          </div>
          {/* Center — badge selon phase */}
          <div className="shrink-0">
            {readOnly ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
                📋 Présentation archivée — lecture seule
              </span>
            ) : meetingPhase === "closing" ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                <Sparkles className="h-3 w-3" /> Phase 2 — Clôture
              </span>
            ) : (
              renderRecordingControls()
            )}
          </div>
          {/* Right — nav + action */}
          <div className="flex items-center gap-1.5 shrink-0">
            <Button variant="ghost" size="icon" className="h-8 w-8" disabled={currentSlide === 0} onClick={() => goTo(currentSlide - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" disabled={currentSlide === TOTAL - 1} onClick={() => goTo(currentSlide + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            {readOnly ? (
              <Button
                size="sm" variant="outline"
                className="gap-1.5 text-xs ml-1"
                onClick={() => navigate(report.state === "validated" ? "/rapports" : "/post-reunion/" + report.id)}
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Fermer
              </Button>
            ) : meetingPhase === "closing" ? (
              <Button
                size="sm" variant="outline"
                className="gap-1.5 text-xs ml-1"
                onClick={() => navigate("/post-reunion/" + report.id)}
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Voir le compte-rendu
              </Button>
            ) : (
              <Button
                size="sm" variant="outline"
                className="gap-1.5 text-xs border-destructive text-destructive hover:bg-destructive/10 ml-1"
                onClick={() => setCloseConfirm(true)}
                disabled={closeMeeting.isPending}
              >
                <Square className="h-3.5 w-3.5" /> Clôturer
              </Button>
            )}
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-1 bg-muted">
          <div className="h-full bg-primary transition-all duration-300" style={{ width: `${((currentSlide + 1) / TOTAL) * 100}%` }} />
        </div>
      </header>

      {/* ── Slide dots ── */}
      <div className="shrink-0 flex items-center justify-center gap-1.5 py-2 bg-card border-b border-border">
        {SLIDE_META.map((meta, idx) => (
          <button
            key={idx}
            onClick={() => goTo(idx)}
            title={meta.label}
            className={`h-2 rounded-full transition-all duration-200 ${
              idx === currentSlide ? "w-6 bg-primary" : "w-2 bg-border hover:bg-muted-foreground/40"
            }`}
          />
        ))}
      </div>

      {/* ── Slide content ── */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-[800px] mx-auto px-6 py-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <SlideIcon className="h-5 w-5" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">{currentMeta.label}</h2>
          </div>
          {renderSlide()}
        </div>
      </main>

      {/* ── Enrichissement panel (bottom drawer) ── */}
      <div className={`shrink-0 bg-card border-t border-border transition-all duration-200 ${isPanelOpen ? "max-h-64" : "max-h-12"} overflow-hidden`}>
        <button
          className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/50 transition-colors"
          onClick={() => setIsPanelOpen((v) => !v)}
        >
          <div className="flex items-center gap-2">
            <PenLine className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Décisions & notes — {currentMeta.label}</span>
            {currentDecisions.length > 0 && (
              <span className="text-xs bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 font-medium">
                {currentDecisions.length}
              </span>
            )}
          </div>
          <ChevronLeft className={`h-4 w-4 text-muted-foreground transition-transform ${isPanelOpen ? "-rotate-90" : "rotate-90"}`} />
        </button>
        {isPanelOpen && (
          <div className="px-5 pb-4 space-y-3">
            <div className="flex gap-2">
              <Textarea
                placeholder="Note une décision ou un point soulevé par la Direction…"
                className="text-sm min-h-[52px] resize-none flex-1"
                value={newDecision}
                onChange={(e) => setNewDecision(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addDecision(); }
                }}
              />
              <Button size="sm" onClick={addDecision} disabled={!newDecision.trim()} className="self-end gap-1.5 shrink-0">
                <Plus className="h-4 w-4" /> Ajouter
              </Button>
            </div>
            {currentDecisions.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {currentDecisions.map((d, i) => (
                  <span key={i} className="inline-flex items-center gap-1 text-xs bg-muted text-foreground px-2 py-1 rounded-full">
                    {d}
                    <button onClick={() => removeDecision(currentSlide, i)} className="text-muted-foreground hover:text-destructive ml-0.5">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Confirm close dialog ── */}
      {closeConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl border border-border shadow-lg p-6 max-w-sm w-full space-y-4">
            <h2 className="text-lg font-bold text-foreground">Clôturer la réunion ?</h2>
            <p className="text-sm text-muted-foreground">
              {(idsQ.data ?? []).length} nouveau{(idsQ.data ?? []).length !== 1 ? "x" : ""} IDS
              {" · "}{totalDecisions} décision{totalDecisions !== 1 ? "s" : ""}
              {recorder.blob ? ` · Enregistré (${formatDuration(recorder.durationSeconds)})` : ""}
            </p>
            <p className="text-sm text-muted-foreground">
              La synthèse IA sera générée automatiquement après la clôture.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setCloseConfirm(false)}>Annuler</Button>
              <Button
                className="bg-teal-600 hover:bg-teal-700 text-white gap-1.5"
                disabled={closeMeeting.isPending}
                onClick={handleClose}
              >
                {closeMeeting.isPending
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <CheckCircle className="h-4 w-4" />}
                Confirmer la clôture
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
