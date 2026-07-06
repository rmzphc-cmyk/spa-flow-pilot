import { useMemo, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useReport, useReopenMeeting } from "@/hooks/useReports";
import {
  useMeetingSummary,
  useTranscribeMeeting,
  useGenerateMeetingSummary,
  useValidateMonthlySummary,
  useUpdateMeetingSummary,
} from "@/hooks/useMeetingSummary";
import {
  parseAiOutput,
  useArbitrateProposal,
  type AiProposal,
  type AiProposalType,
  type AiSeverity,
  type AiTriage,
  type AiVerdict,
  type ObjectiveFields,
} from "@/hooks/useAiArbitrage";
import type { ObjectiveKind } from "@/hooks/useObjectives";
import { useIdsItems } from "@/hooks/useIdsItems";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import {
  Sparkles,
  Check,
  RefreshCw,
  Loader2,
  Mic,
  Eye,
  RotateCcw,
  AlertCircle,
  AlertTriangle,
  Pencil,
  Lightbulb,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

// --- Styles verdict / gravité (charte : échelle statut = sens) ---

const VERDICT_STYLE: Record<AiVerdict, string> = {
  on_track: "bg-emerald-100 text-emerald-800",
  attention: "bg-amber-100 text-amber-800",
  at_risk: "bg-rose-100 text-rose-800",
};

const SEVERITY_DOT: Record<AiSeverity, string> = {
  info: "bg-slate-400",
  watch: "bg-amber-500",
  alert: "bg-rose-500",
};

const TRIAGE_STYLE: Record<AiTriage, string> = {
  bloquant: "bg-rose-100 text-rose-800",
  priorite: "bg-amber-100 text-amber-800",
  deleguer: "bg-blue-100 text-blue-800",
  veille: "bg-slate-200 text-slate-700",
};

// --- Dialog d'ajustement d'une proposition (aussi requis pour accepter un objectif) ---

interface EditState {
  index: number;
  proposal: AiProposal;
}

function ProposalEditDialog({
  editState,
  onClose,
  onConfirm,
  isPending,
}: {
  editState: EditState | null;
  onClose: () => void;
  onConfirm: (index: number, proposal: AiProposal, objective?: ObjectiveFields) => void;
  isPending: boolean;
}) {
  const { t } = useTranslation();
  const p = editState?.proposal;

  const [type, setType] = useState<AiProposalType>("ids");
  const [title, setTitle] = useState("");
  const [problem, setProblem] = useState("");
  const [triage, setTriage] = useState<AiTriage | "none">("none");
  const [owner, setOwner] = useState("");
  const [due, setDue] = useState("");
  const [kind, setKind] = useState<ObjectiveKind>("numeric");
  const [metric, setMetric] = useState("");
  const [unit, setUnit] = useState("");
  const [startValue, setStartValue] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [steps, setSteps] = useState("");
  const [targetDate, setTargetDate] = useState("");

  // Ré-initialise les champs à chaque ouverture.
  useEffect(() => {
    if (!p) return;
    setType(p.type);
    setTitle(p.title);
    setProblem(p.problem ?? "");
    setTriage(p.suggested_triage ?? "none");
    setOwner(p.owner ?? "");
    setDue(p.due ?? "");
    setKind("numeric");
    setMetric("");
    setUnit("");
    setStartValue("");
    setTargetValue("");
    setSteps("");
    setTargetDate(p.due ?? "");
  }, [p]);

  if (!editState || !p) return null;

  const stepLines = steps.split("\n").map((s) => s.trim()).filter(Boolean);
  const targetNum = targetValue.trim() === "" ? null : Number(targetValue);
  const startNum = startValue.trim() === "" ? null : Number(startValue);
  const objectiveValid =
    kind === "steps"
      ? stepLines.length > 0
      : targetNum !== null && Number.isFinite(targetNum) &&
        (startNum === null || (Number.isFinite(startNum) && startNum !== targetNum));
  const canConfirm = !!title.trim() && (type !== "objective" || objectiveValid);

  const handleConfirm = () => {
    const edited: AiProposal = {
      ...p,
      type,
      title: title.trim(),
      problem: problem.trim() || null,
      suggested_triage: triage === "none" ? null : triage,
      owner: owner.trim() || null,
      due: due || null,
    };
    const objective: ObjectiveFields | undefined =
      type === "objective"
        ? {
            kind,
            metric: metric.trim() || undefined,
            unit: unit.trim() || undefined,
            startValue: startNum ?? undefined,
            targetValue: targetNum ?? undefined,
            steps: kind === "steps" ? stepLines : undefined,
            targetDate: targetDate || null,
          }
        : undefined;
    onConfirm(editState.index, edited, objective);
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("postMeeting.ai.editDialogTitle")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>{t("postMeeting.ai.typeLabel")}</Label>
            <Select value={type} onValueChange={(v) => setType(v as AiProposalType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ids">{t("postMeeting.ai.type.ids")}</SelectItem>
                <SelectItem value="todo">{t("postMeeting.ai.type.todo")}</SelectItem>
                <SelectItem value="objective">{t("postMeeting.ai.type.objective")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>{t("postMeeting.ai.titleLabel")}</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>{t("postMeeting.ai.problemLabel")}</Label>
            <Textarea rows={2} value={problem} onChange={(e) => setProblem(e.target.value)} />
          </div>

          {type === "ids" && (
            <div className="space-y-1.5">
              <Label>{t("postMeeting.ai.triageLabel")}</Label>
              <Select value={triage} onValueChange={(v) => setTriage(v as AiTriage | "none")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("postMeeting.ai.triage.none")}</SelectItem>
                  <SelectItem value="bloquant">{t("postMeeting.ai.triage.bloquant")}</SelectItem>
                  <SelectItem value="priorite">{t("postMeeting.ai.triage.priorite")}</SelectItem>
                  <SelectItem value="deleguer">{t("postMeeting.ai.triage.deleguer")}</SelectItem>
                  <SelectItem value="veille">{t("postMeeting.ai.triage.veille")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {type === "todo" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("postMeeting.ai.ownerLabel")}</Label>
                <Input value={owner} onChange={(e) => setOwner(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("postMeeting.ai.dueLabel")}</Label>
                <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
              </div>
            </div>
          )}

          {type === "objective" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t("postMeeting.ai.kindLabel")}</Label>
                  <Select value={kind} onValueChange={(v) => setKind(v as ObjectiveKind)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="numeric">{t("postMeeting.ai.kindNumeric")}</SelectItem>
                      <SelectItem value="steps">{t("postMeeting.ai.kindSteps")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{t("postMeeting.ai.targetDateLabel")}</Label>
                  <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
                </div>
              </div>
              {kind === "numeric" ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>{t("postMeeting.ai.metricLabel")}</Label>
                    <Input value={metric} onChange={(e) => setMetric(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("postMeeting.ai.unitLabel")}</Label>
                    <Input value={unit} onChange={(e) => setUnit(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("postMeeting.ai.startLabel")}</Label>
                    <Input type="number" value={startValue} onChange={(e) => setStartValue(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("postMeeting.ai.targetLabel")}</Label>
                    <Input type="number" value={targetValue} onChange={(e) => setTargetValue(e.target.value)} />
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label>{t("postMeeting.ai.stepsLabel")}</Label>
                  <Textarea rows={4} value={steps} onChange={(e) => setSteps(e.target.value)} />
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            {t("postMeeting.ai.cancelBtn")}
          </Button>
          <Button size="sm" disabled={!canConfirm || isPending} onClick={handleConfirm} className="gap-1.5">
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            {t("postMeeting.ai.createBtn")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Main Component — Arbitrage post-réunion + archive ---

export default function PostMeetingMode() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const { data: row } = useReport(id);
  const { data: summaryRow } = useMeetingSummary(id);
  const { data: dbIds } = useIdsItems(id);
  const transcribeMeeting = useTranscribeMeeting();
  const reopenMeeting = useReopenMeeting();
  const generateSummary = useGenerateMeetingSummary();
  const validateSummary = useValidateMonthlySummary();
  const updateSummary = useUpdateMeetingSummary();

  const isMonthly = row?.cycle_type === "monthly";
  const isPostMeeting = row?.status === "post_meeting_generated";

  const aiOutput = useMemo(() => parseAiOutput(summaryRow?.ai_output), [summaryRow]);
  const arbitrate = useArbitrateProposal(id, aiOutput);
  const [pendingIndex, setPendingIndex] = useState<number | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);

  // Édition du compte-rendu (autosave debouncé via useUpdateMeetingSummary)
  const [editingSummary, setEditingSummary] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState<string | null>(null);

  // ── Orchestration post-réunion : transcription PUIS synthèse coach ──────────
  // À l'arrivée sur l'écran (après "Fin de réunion") : si un audio existe et
  // n'est pas transcrit → Whisper ; quand le transcript est prêt (ou pas d'audio)
  // et que le coach n'a pas encore tourné → génération. Résilient au reload.
  const transcribeStartedRef = useRef(false);
  const generateStartedRef = useRef(false);
  useEffect(() => {
    if (!isPostMeeting || !isMonthly || !id) return;
    if (summaryRow?.ai_output) return; // coach déjà passé
    const hasAudio = !!row?.audio_storage_path;
    const tStatus = summaryRow?.transcript_status;
    // 1) transcription : une seule tentative, si audio et pas encore de transcript
    if (hasAudio && !transcribeStartedRef.current && (!tStatus || tStatus === "none")) {
      transcribeStartedRef.current = true;
      transcribeMeeting.mutate({ reportId: id });
      return;
    }
    // 2) transcription en cours → on attend (poll auto de useMeetingSummary)
    if (transcribeMeeting.isPending || tStatus === "pending") return;
    // 3) génération : transcript prêt/échoué, pas d'audio, OU transcription déjà
    //    tentée sans résultat exploitable → on ne reste jamais bloqué.
    if (!generateStartedRef.current && !generateSummary.isPending) {
      generateStartedRef.current = true;
      generateSummary.mutate({ reportId: id });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPostMeeting, isMonthly, id, summaryRow, row?.audio_storage_path, transcribeMeeting.isPending, generateSummary.isPending]);

  const decisionsFromAi = useMemo<string[]>(() => {
    if (!summaryRow?.key_actions) return [];
    try {
      const p = JSON.parse(summaryRow.key_actions);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }, [summaryRow?.key_actions]);

  const aiReady = !!summaryRow?.executive_summary;
  const displayedSummary = summaryDraft ?? summaryRow?.executive_summary ?? "";

  const arbitrateError = (e: Error) => {
    const msg = e.message === "OBJECTIVE_LIMIT_REACHED"
      ? t("postMeeting.ai.objectiveLimit")
      : e.message;
    toast({ title: t("common.error"), description: msg, variant: "destructive" });
  };

  const runArbitrate = (
    index: number,
    decision: "accept" | "dismiss" | "restore",
    proposal: AiProposal,
    objective?: ObjectiveFields,
  ) => {
    setPendingIndex(index);
    arbitrate.mutate(
      { index, decision, proposal, objective },
      {
        onSuccess: () => {
          if (decision === "accept") toast({ title: t("postMeeting.ai.acceptedToast") });
          setEditState(null);
        },
        onError: arbitrateError,
        onSettled: () => setPendingIndex(null),
      },
    );
  };

  const handleAccept = (index: number, proposal: AiProposal) => {
    // Un objectif exige kind + cible/étapes → passage obligatoire par le dialog.
    if (proposal.type === "objective") {
      setEditState({ index, proposal });
      return;
    }
    runArbitrate(index, "accept", proposal);
  };

  const handleSummaryChange = (value: string) => {
    setSummaryDraft(value);
    if (!id) return;
    updateSummary.mutate({
      reportId: id,
      newSummary: value,
      newKeyActions: decisionsFromAi,
      managerNote: summaryRow?.manager_note ?? null,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top banner */}
      <div className="px-6 py-3 border-b bg-muted/40 border-border">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-emerald-600" />
            <span className="text-sm font-medium text-foreground">
              {t("postMeeting.minutesTitle")} — {row?.cycle_label ?? t("reportType.monthly")}
            </span>
            {row?.status === "validated" && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                {t("status.validated")} ✓
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isPostMeeting && isMonthly && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                disabled={reopenMeeting.isPending}
                onClick={() => {
                  if (id) {
                    reopenMeeting.mutate(
                      { reportId: id },
                      { onSuccess: () => navigate(`/rapport/${id}`) },
                    );
                  }
                }}
              >
                {reopenMeeting.isPending
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <RotateCcw className="h-3.5 w-3.5" />}
                {t("postMeeting.reopenMeeting")}
              </Button>
            )}
            {isPostMeeting && isMonthly && (
              <Button
                size="sm"
                className="gap-1.5 text-xs bg-teal-600 hover:bg-teal-700 text-white"
                disabled={!aiReady || validateSummary.isPending}
                onClick={() => id && validateSummary.mutate({ reportId: id })}
              >
                {validateSummary.isPending
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Check className="h-3.5 w-3.5" />}
                {t("postMeeting.closeMonthly")}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => navigate(`/rapport/${id}`, { state: { readOnly: true } })}
            >
              <Eye className="h-3.5 w-3.5" />
              {t("postMeeting.viewPresentation")}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-[900px] mx-auto px-6 py-6 pb-12">

        {/* ===== SYNTHÈSE IA ===== */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <h2 className="text-lg font-semibold text-foreground">{t("ai.executiveSummary")}</h2>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
              <Sparkles className="h-3 w-3" /> {t("postMeeting.generatedInMeeting")}
            </span>
            {aiOutput && (
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${VERDICT_STYLE[aiOutput.verdict]}`}>
                {t(`postMeeting.ai.verdict.${aiOutput.verdict}`)}
              </span>
            )}
          </div>

          {aiOutput && !aiOutput.audio_used && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">{t("postMeeting.ai.noAudio")}</p>
            </div>
          )}

          {!aiReady ? (
            <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("postMeeting.generating")}
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : (
          <div className="space-y-4">
              {/* Compte-rendu (éditable tant que non clôturé) */}
              <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-muted-foreground">{t("report.meeting.aiSummary.executiveSummary")}</p>
                  {isPostMeeting && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-xs h-7"
                      onClick={() => {
                        if (!editingSummary) setSummaryDraft(summaryRow?.executive_summary ?? "");
                        setEditingSummary((v) => !v);
                      }}
                    >
                      {editingSummary ? <Check className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
                      {editingSummary ? t("postMeeting.ai.doneEditing") : t("postMeeting.ai.editSummary")}
                    </Button>
                  )}
                </div>
                {editingSummary ? (
                  <Textarea
                    rows={7}
                    value={displayedSummary}
                    onChange={(e) => handleSummaryChange(e.target.value)}
                    className="text-sm leading-relaxed"
                  />
                ) : (
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{displayedSummary}</p>
                )}
              </div>

              {/* ===== Coach : points saillants ===== */}
              {aiOutput && aiOutput.highlights.length > 0 && (
                <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                  <p className="text-sm font-medium text-muted-foreground mb-3">{t("postMeeting.ai.highlightsTitle")}</p>
                  <ul className="space-y-2.5">
                    {aiOutput.highlights.map((h, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm">
                        <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${SEVERITY_DOT[h.severity] ?? SEVERITY_DOT.info}`} />
                        <span className="text-foreground">
                          <span className="font-medium">{h.label}</span>
                          {h.detail && <span className="text-muted-foreground"> — {h.detail}</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* ===== Coach : décisions actées ===== */}
              {aiOutput && aiOutput.decisions.length > 0 && (
                <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                  <p className="text-sm font-medium text-muted-foreground mb-3">{t("postMeeting.ai.decisionsTitle")}</p>
                  <ul className="space-y-3">
                    {aiOutput.decisions.map((d, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <span className="text-foreground">{d.statement}</span>
                          <span className="block mt-0.5 text-xs text-muted-foreground">
                            {d.owner && <>{t("postMeeting.ai.ownerLabel")} : {d.owner} · </>}
                            {d.due && <>{t("postMeeting.ai.dueLabel")} : {d.due} · </>}
                            {t(`postMeeting.ai.confidence.${d.confidence}`)}
                            {d.source && <> · {t("postMeeting.ai.sourceLabel")} : {d.source}</>}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Legacy (anciens rapports sans ai_output) */}
              {!aiOutput && summaryRow?.kpi_synthesis && (
                <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                  <p className="text-sm font-medium text-muted-foreground mb-2">{t("report.meeting.aiSummary.kpiSynthesis")}</p>
                  <p className="text-sm text-foreground leading-relaxed">{summaryRow.kpi_synthesis}</p>
                </div>
              )}
              {!aiOutput && summaryRow?.management_synthesis && (
                <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                  <p className="text-sm font-medium text-muted-foreground mb-2">{t("report.meeting.aiSummary.managementSynthesis")}</p>
                  <p className="text-sm text-foreground leading-relaxed">{summaryRow.management_synthesis}</p>
                </div>
              )}
              {!aiOutput && summaryRow?.ids_synthesis && (
                <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                  <p className="text-sm font-medium text-muted-foreground mb-2">{t("report.meeting.aiSummary.idsSynthesis")}</p>
                  <p className="text-sm text-foreground leading-relaxed">{summaryRow.ids_synthesis}</p>
                </div>
              )}
              {!aiOutput && decisionsFromAi.length > 0 && (
                <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                  <p className="text-sm font-medium text-muted-foreground mb-3">{t("report.meeting.aiSummary.keyDecisions")}</p>
                  <ul className="space-y-2">
                    {decisionsFromAi.map((d, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                        <span className="text-foreground">{d}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>

        {/* ===== PROPOSITIONS DU COACH (arbitrage) ===== */}
        {aiOutput && aiOutput.proposals.length > 0 && (
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-1">
              <Lightbulb className="h-4 w-4 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">{t("postMeeting.ai.proposalsTitle")}</h2>
            </div>
            {isPostMeeting && (
              <p className="text-sm text-muted-foreground mb-4">{t("postMeeting.ai.proposalsHint")}</p>
            )}
            <div className="space-y-3 mt-3">
              {aiOutput.proposals.map((p, i) => {
                const arb = p.arbitration ?? null;
                const cardPending = pendingIndex === i && arbitrate.isPending;
                return (
                  <div
                    key={i}
                    className={`bg-card border rounded-xl p-4 shadow-sm ${arb?.status === "dismissed" ? "opacity-60 border-border" : "border-border"}`}
                  >
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-teal-100 text-teal-800">
                            {t(`postMeeting.ai.type.${p.type}`)}
                          </span>
                          {p.suggested_triage && (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TRIAGE_STYLE[p.suggested_triage]}`}>
                              {t(`postMeeting.ai.triage.${p.suggested_triage}`)}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">{t(`postMeeting.ai.confidence.${p.confidence}`)}</span>
                          {arb?.status === "accepted" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                              <Check className="h-3 w-3" /> {t("postMeeting.ai.acceptedBadge")}
                            </span>
                          )}
                          {arb?.status === "dismissed" && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-200 text-slate-700">
                              {t("postMeeting.ai.dismissedBadge")}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-foreground">{p.title}</p>
                        {p.problem && (
                          <p className="text-xs text-muted-foreground mt-1">
                            <span className="font-medium">{t("postMeeting.ai.problemLabel")} :</span> {p.problem}
                          </p>
                        )}
                        {p.justification && (
                          <p className="text-xs text-muted-foreground mt-1">
                            <span className="font-medium">{t("postMeeting.ai.whyLabel")} :</span> {p.justification}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {p.owner && <>{t("postMeeting.ai.ownerLabel")} : {p.owner} · </>}
                          {p.due && <>{t("postMeeting.ai.dueLabel")} : {p.due} · </>}
                          {p.source && <>{t("postMeeting.ai.sourceLabel")} : {p.source}</>}
                        </p>
                      </div>

                      {isPostMeeting && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          {!arb && (
                            <>
                              <Button
                                size="sm"
                                className="gap-1 text-xs h-8 bg-teal-600 hover:bg-teal-700 text-white"
                                disabled={arbitrate.isPending}
                                onClick={() => handleAccept(i, p)}
                              >
                                {cardPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                                {t("postMeeting.ai.accept")}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1 text-xs h-8"
                                disabled={arbitrate.isPending}
                                onClick={() => setEditState({ index: i, proposal: p })}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                {t("postMeeting.ai.adjust")}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-xs h-8 text-muted-foreground"
                                disabled={arbitrate.isPending}
                                onClick={() => runArbitrate(i, "dismiss", p)}
                              >
                                {t("postMeeting.ai.dismiss")}
                              </Button>
                            </>
                          )}
                          {arb?.status === "dismissed" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-xs h-8 text-muted-foreground gap-1"
                              disabled={arbitrate.isPending}
                              onClick={() => runArbitrate(i, "restore", { ...p, arbitration: null })}
                            >
                              {cardPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                              {t("postMeeting.ai.restore")}
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ===== ANGLES MORTS (coach franc — écran manager uniquement) ===== */}
        {aiOutput && aiOutput.blind_spots.length > 0 && (
          <section className="mb-8">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <h2 className="text-sm font-semibold text-amber-900">{t("postMeeting.ai.blindSpotsTitle")}</h2>
              </div>
              {isPostMeeting && (
                <p className="text-xs text-amber-700 mb-3">{t("postMeeting.ai.blindSpotsHint")}</p>
              )}
              <ul className="space-y-1.5 mt-2">
                {aiOutput.blind_spots.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-amber-900">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {/* ===== IDS ARCHIVÉS ===== */}
        {isMonthly && (dbIds ?? []).length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-foreground mb-4">
              {t("postMeeting.idsArchivedTitle", { count: (dbIds ?? []).length })}
            </h2>
            <div className="space-y-3">
              {(dbIds ?? []).map((item, i) => (
                <div key={item.id} className="bg-card border border-border rounded-xl p-4 shadow-sm">
                  <div className="flex items-start gap-2 mb-2">
                    <span className="text-xs font-bold text-muted-foreground shrink-0 mt-0.5">#{i + 1}</span>
                    <p className="text-sm font-medium text-foreground">{item.capture_text}</p>
                  </div>
                  {item.proposed_solution && (
                    <div className="ml-5 space-y-1">
                      {item.root_cause && (
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium">{t("postMeeting.causeLabel")}</span> {item.root_cause}
                        </p>
                      )}
                      <p className="text-xs text-foreground">
                        <span className="font-medium">{t("postMeeting.solutionLabel")}</span> {item.proposed_solution}
                      </p>
                    </div>
                  )}
                  {!item.proposed_solution && (
                    <p className="ml-5 text-xs text-amber-600 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> {t("postMeeting.noSolution")}
                    </p>
                  )}
                  <div className="ml-5 mt-2 flex gap-2 flex-wrap">
                    {item.converted_to_todo_id && (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full font-medium">
                        <Check className="h-3 w-3" /> {t("postMeeting.todoCreated")}
                      </span>
                    )}
                    {item.converted_to_objective_id && (
                      <span className="inline-flex items-center gap-1 text-xs text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full font-medium">
                        <Check className="h-3 w-3" /> {t("postMeeting.objectiveCreated")}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ===== TRANSCRIPT ===== */}
        {isMonthly && row?.audio_storage_path && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-foreground mb-4">{t("postMeeting.recordingTranscript")}</h2>
            {(!summaryRow?.transcript_status || summaryRow.transcript_status === "none") && (
              <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                <p className="text-sm text-muted-foreground mb-3">
                  {t("postMeeting.recordingAvailable")}
                </p>
                <Button size="sm" className="gap-1.5" disabled={transcribeMeeting.isPending}
                  onClick={() => id && transcribeMeeting.mutate({ reportId: id })}>
                  {transcribeMeeting.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
                  {t("postMeeting.transcribeRecording")}
                </Button>
              </div>
            )}
            {summaryRow?.transcript_status === "pending" && (
              <div className="bg-card border border-border rounded-xl p-5 shadow-sm flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />
                <p className="text-sm font-medium text-foreground">{t("postMeeting.transcriptionInProgress")}</p>
              </div>
            )}
            {summaryRow?.transcript_status === "done" && summaryRow.transcript_text && (
              <details className="bg-card border border-border rounded-xl shadow-sm">
                <summary className="px-5 py-4 cursor-pointer font-medium text-sm text-foreground flex items-center gap-2 select-none list-none">
                  <Mic className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="flex-1">{t("postMeeting.fullTranscript")}</span>
                  <span className="text-xs text-muted-foreground">{t("postMeeting.charCount", { count: summaryRow.transcript_text.length })}</span>
                </summary>
                <div className="px-5 pb-5 border-t border-border pt-4">
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{summaryRow.transcript_text}</p>
                </div>
              </details>
            )}
            {summaryRow?.transcript_status === "error" && (
              <div className="bg-card border border-destructive/30 rounded-xl p-5 shadow-sm">
                <p className="text-sm text-destructive mb-3">{t("postMeeting.transcriptionFailed")}</p>
                <Button size="sm" variant="outline" className="gap-1.5" disabled={transcribeMeeting.isPending}
                  onClick={() => id && transcribeMeeting.mutate({ reportId: id })}>
                  {transcribeMeeting.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  {t("postMeeting.retry")}
                </Button>
              </div>
            )}
          </section>
        )}
      </div>

      {/* Dialog d'ajustement / acceptation d'objectif */}
      <ProposalEditDialog
        editState={editState}
        onClose={() => setEditState(null)}
        onConfirm={(index, proposal, objective) => runArbitrate(index, "accept", proposal, objective)}
        isPending={arbitrate.isPending}
      />
    </div>
  );
}
