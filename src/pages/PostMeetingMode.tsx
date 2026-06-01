import { useMemo } from "react";
import { useReport, useReopenMeeting } from "@/hooks/useReports";
import {
  useMeetingSummary,
  useTranscribeMeeting,
} from "@/hooks/useMeetingSummary";
import { useIdsItems } from "@/hooks/useIdsItems";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Check,
  RefreshCw,
  Loader2,
  Mic,
  Eye,
  RotateCcw,
  AlertCircle,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

// --- Main Component — Archive lecture seule ---

export default function PostMeetingMode() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: row } = useReport(id);
  const { data: summaryRow } = useMeetingSummary(id);
  const { data: dbIds } = useIdsItems(id);
  const transcribeMeeting = useTranscribeMeeting();
  const reopenMeeting = useReopenMeeting();

  const isMonthly = row?.cycle_type === "monthly";
  const isPostMeeting = row?.status === "post_meeting_generated";

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

  return (
    <div className="min-h-screen bg-background">
      {/* Top banner */}
      <div className="px-6 py-3 border-b bg-muted/40 border-border">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-emerald-600" />
            <span className="text-sm font-medium text-foreground">
              Compte-rendu — {row?.cycle_label ?? "Monthly"}
            </span>
            {row?.status === "validated" && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                Validé ✓
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
                Relancer la réunion
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => navigate(`/rapport/${id}`)}
            >
              <Eye className="h-3.5 w-3.5" />
              Voir la présentation
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-[900px] mx-auto px-6 py-6 pb-12">

        {/* ===== SYNTHÈSE IA ===== */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-lg font-semibold text-foreground">Synthèse IA</h2>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
              <Sparkles className="h-3 w-3" /> Générée en réunion
            </span>
          </div>

          {!aiReady ? (
            <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                <p className="text-sm font-medium text-muted-foreground mb-2">Résumé exécutif</p>
                <p className="text-sm text-foreground leading-relaxed">{summaryRow?.executive_summary}</p>
              </div>
              {decisionsFromAi.length > 0 && (
                <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                  <p className="text-sm font-medium text-muted-foreground mb-3">Décisions clés</p>
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

        {/* ===== IDS ARCHIVÉS ===== */}
        {isMonthly && (dbIds ?? []).length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-foreground mb-4">
              IDS — {(dbIds ?? []).length} point{(dbIds ?? []).length !== 1 ? "s" : ""} traité{(dbIds ?? []).length !== 1 ? "s" : ""}
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
                          <span className="font-medium">Cause :</span> {item.root_cause}
                        </p>
                      )}
                      <p className="text-xs text-foreground">
                        <span className="font-medium">Solution :</span> {item.proposed_solution}
                      </p>
                    </div>
                  )}
                  {!item.proposed_solution && (
                    <p className="ml-5 text-xs text-amber-600 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> Sans solution
                    </p>
                  )}
                  <div className="ml-5 mt-2 flex gap-2 flex-wrap">
                    {item.converted_to_todo_id && (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full font-medium">
                        <Check className="h-3 w-3" /> Todo créé
                      </span>
                    )}
                    {item.converted_to_objective_id && (
                      <span className="inline-flex items-center gap-1 text-xs text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full font-medium">
                        <Check className="h-3 w-3" /> Objectif créé
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
            <h2 className="text-lg font-semibold text-foreground mb-4">Enregistrement & Transcript</h2>
            {(!summaryRow?.transcript_status || summaryRow.transcript_status === "none") && (
              <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                <p className="text-sm text-muted-foreground mb-3">
                  Enregistrement disponible. Lancez la transcription Whisper pour archiver les échanges.
                </p>
                <Button size="sm" className="gap-1.5" disabled={transcribeMeeting.isPending}
                  onClick={() => id && transcribeMeeting.mutate({ reportId: id })}>
                  {transcribeMeeting.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
                  Transcrire l'enregistrement
                </Button>
              </div>
            )}
            {summaryRow?.transcript_status === "pending" && (
              <div className="bg-card border border-border rounded-xl p-5 shadow-sm flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />
                <p className="text-sm font-medium text-foreground">Transcription Whisper en cours…</p>
              </div>
            )}
            {summaryRow?.transcript_status === "done" && summaryRow.transcript_text && (
              <details className="bg-card border border-border rounded-xl shadow-sm">
                <summary className="px-5 py-4 cursor-pointer font-medium text-sm text-foreground flex items-center gap-2 select-none list-none">
                  <Mic className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="flex-1">Transcript complet (Whisper)</span>
                  <span className="text-xs text-muted-foreground">{summaryRow.transcript_text.length.toLocaleString("fr-FR")} car.</span>
                </summary>
                <div className="px-5 pb-5 border-t border-border pt-4">
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{summaryRow.transcript_text}</p>
                </div>
              </details>
            )}
            {summaryRow?.transcript_status === "error" && (
              <div className="bg-card border border-destructive/30 rounded-xl p-5 shadow-sm">
                <p className="text-sm text-destructive mb-3">Transcription échouée.</p>
                <Button size="sm" variant="outline" className="gap-1.5" disabled={transcribeMeeting.isPending}
                  onClick={() => id && transcribeMeeting.mutate({ reportId: id })}>
                  {transcribeMeeting.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  Réessayer
                </Button>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
