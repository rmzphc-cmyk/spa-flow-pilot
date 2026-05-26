import { useState, useMemo, useEffect } from "react";
import { useReport } from "@/hooks/useReports";
import { useMeetingSummary, useGenerateMeetingSummary } from "@/hooks/useMeetingSummary";
import { useIdsItems } from "@/hooks/useIdsItems";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
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
import {
  Sparkles,
  Check,
  X,
  Plus,
  RefreshCw,
  Edit2,
  Calendar,
  AlertTriangle,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

// --- Types ---

type ReportType = "monthly" | "weekly";

interface CapturedIssue {
  id: string;
  text: string;
  cause: string;
  solution: string;
  conversion: "todo" | "objective" | "both" | "none" | null;
}

// --- Mock data ---

const reportInfo: Record<string, { label: string; period: string; type: ReportType; spa: string }> = {
  r1: { label: "Monthly — Mars 2026", period: "1 mars → 31 mars 2026", type: "monthly", spa: "Par Gran Canaria" },
  r2: { label: "Weekly — Semaine 12", period: "18 → 24 mars 2026", type: "weekly", spa: "Par Gran Canaria" },
};

const mockCapturedIssues: CapturedIssue[] = [
  { id: "i1", text: "Temps d'attente trop long à l'accueil les samedis", cause: "", solution: "", conversion: null },
  { id: "i2", text: "Produits de soin périmés retrouvés en cabine 2", cause: "", solution: "", conversion: null },
  { id: "i3", text: "Conflits de planning entre praticiens le vendredi", cause: "", solution: "", conversion: null },
];

const aiSummary = "La réunion de mars 2026 a permis de faire le point sur les performances du spa. Le chiffre d'affaires est légèrement en dessous de l'objectif (42k€ vs 45k€), principalement en raison des vacances scolaires. Le taux d'occupation reste correct à 78%. Trois problèmes ont été identifiés : le temps d'attente à l'accueil, des produits périmés en cabine, et des conflits de planning. L'équipe reste engagée malgré deux arrêts maladie imprévus.";

const aiDecisions = [
  "Mettre en place un système de file d'attente numérique à l'accueil",
  "Audit complet des stocks produits dans toutes les cabines",
  "Revoir le planning vendredi avec rotation des praticiens",
];

const aiTodoSuggestions = [
  { title: "Installer le système de file d'attente numérique", responsible: "Marie D.", deadline: "15 avr 2026" },
  { title: "Réaliser l'audit produits cabines 1 à 5", responsible: "Sophie M.", deadline: "5 avr 2026" },
  { title: "Proposer nouveau planning vendredi", responsible: "Marie D.", deadline: "Prochaine réunion" },
];

const aiObjectiveSuggestions = [
  { title: "Réduire le temps d'attente accueil", metric: "Temps moyen attente", target: "< 5 min" },
  { title: "Zéro produit périmé en cabine", metric: "Nb incidents produits", target: "0" },
];

// --- AI Badge ---

function AiBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
      <Sparkles className="h-3 w-3" />
      Suggestion IA
    </span>
  );
}

// --- IDS Structuration Card ---

function IdsCard({
  issue,
  index,
  onChange,
}: {
  issue: CapturedIssue;
  index: number;
  onChange: (updated: CapturedIssue) => void;
}) {
  const [todoFormOpen, setTodoFormOpen] = useState(false);
  const [objFormOpen, setObjFormOpen] = useState(false);

  const setConversion = (c: CapturedIssue["conversion"]) => {
    onChange({ ...issue, conversion: c });
    if (c === "todo" || c === "both") setTodoFormOpen(true);
    if (c === "objective" || c === "both") setObjFormOpen(true);
  };

  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <span className="text-sm font-bold text-muted-foreground shrink-0">#{index + 1}</span>
        <p className="text-sm font-medium text-foreground">{issue.text}</p>
      </div>

      {/* Cause */}
      <div className="mb-3">
        <label className="text-xs font-medium text-foreground mb-1 block">Cause</label>
        <Textarea
          className="text-sm min-h-[50px]"
          placeholder="Facultatif — Quelle est selon vous la cause principale ?"
          maxLength={300}
          value={issue.cause}
          onChange={(e) => onChange({ ...issue, cause: e.target.value })}
        />
        <div className="text-xs text-muted-foreground text-right mt-0.5">{issue.cause.length}/300</div>
      </div>

      {/* Solution */}
      <div className="mb-3">
        <label className="text-xs font-medium text-foreground mb-1 block">
          Solution <span className="text-destructive">*</span>
        </label>
        <Textarea
          className={`text-sm min-h-[50px] ${!issue.solution.trim() ? "border-amber-500" : ""}`}
          placeholder="Quelle solution est retenue ?"
          maxLength={300}
          value={issue.solution}
          onChange={(e) => onChange({ ...issue, solution: e.target.value })}
        />
        <div className="text-xs text-muted-foreground text-right mt-0.5">{issue.solution.length}/300</div>
      </div>

      {/* Conversion buttons */}
      <div className="flex flex-wrap gap-2">
        {(["todo", "objective", "both", "none"] as const).map((c) => {
          const labels: Record<string, string> = {
            todo: "Créer un to-do",
            objective: "Créer un objectif",
            both: "Les deux",
            none: "Aucune conversion",
          };
          const isActive = issue.conversion === c;
          return (
            <button
              key={c}
              onClick={() => setConversion(c)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                isActive
                  ? c === "none"
                    ? "bg-amber-100 text-amber-800 border-amber-300"
                    : "bg-primary/10 text-primary border-primary/30"
                  : "bg-card text-muted-foreground border-border hover:bg-muted"
              }`}
            >
              {labels[c]}
            </button>
          );
        })}
      </div>

      {issue.conversion === "none" && (
        <p className="text-xs text-amber-700 mt-2 flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" /> Sans action — aucune suite donnée à ce problème
        </p>
      )}
    </div>
  );
}

// --- Main Component ---

export default function PostMeetingMode() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const report = reportInfo[id ?? ""] ?? { label: `Rapport ${id}`, period: "", type: "monthly" as ReportType, spa: "Spa" };

  const { data: row } = useReport(id);
  const { data: summaryRow, isLoading: summaryLoading } = useMeetingSummary(id);
  const generateSummary = useGenerateMeetingSummary();
  const { data: dbIds } = useIdsItems(id);

  const cycleType = (row?.cycle_type as ReportType | undefined) ?? report.type;
  const isMonthly = cycleType === "monthly";

  // Auto-trigger AI generation when needed
  useEffect(() => {
    if (
      id &&
      row?.status === "post_meeting_generated" &&
      !summaryRow &&
      !summaryLoading &&
      !generateSummary.isPending
    ) {
      generateSummary.mutate({ reportId: id });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row?.status, summaryRow, summaryLoading]);

  const aiReady = summaryRow?.executive_summary != null;
  const decisionsFromAi = useMemo<string[]>(() => {
    if (!summaryRow?.key_actions) return [];
    try {
      const p = JSON.parse(summaryRow.key_actions);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }, [summaryRow?.key_actions]);

  // AI synthesis editable state
  const [summary, setSummary] = useState("");
  const [editingSummary, setEditingSummary] = useState(false);
  const [decisions, setDecisions] = useState<string[]>([]);
  const [newDecision, setNewDecision] = useState("");

  // Sync editable state when summary arrives
  useEffect(() => {
    if (summaryRow?.executive_summary) setSummary(summaryRow.executive_summary);
  }, [summaryRow?.executive_summary]);
  useEffect(() => {
    if (decisionsFromAi.length) setDecisions(decisionsFromAi);
  }, [decisionsFromAi]);

  // IDS issues from DB
  const [issues, setIssues] = useState<CapturedIssue[]>([]);
  useEffect(() => {
    if (isMonthly && dbIds) {
      setIssues(
        dbIds.map((d) => ({
          id: d.id,
          text: d.capture_text,
          cause: "",
          solution: "",
          conversion: null,
        })),
      );
    }
  }, [dbIds, isMonthly]);

  // Todo suggestions
  const [todoSuggestions, setTodoSuggestions] = useState(
    (isMonthly ? aiTodoSuggestions : aiTodoSuggestions.slice(0, 1)).map((s) => ({ ...s, status: "pending" as "pending" | "confirmed" | "ignored" }))
  );

  // Objective suggestions (monthly only)
  const [objSuggestions, setObjSuggestions] = useState(
    isMonthly ? aiObjectiveSuggestions.map((s) => ({ ...s, status: "pending" as "pending" | "confirmed" | "ignored" })) : []
  );

  // Next meeting
  const [nextDate, setNextDate] = useState("2026-04-28");
  const [nextTime, setNextTime] = useState("10:00");

  // Validation
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [idsBlockOpen, setIdsBlockOpen] = useState(false);

  const issuesWithoutSolution = issues.filter((i) => !i.solution.trim());
  const structuredCount = issues.filter((i) => i.solution.trim()).length;
  const convertedCount = issues.filter((i) => i.conversion && i.conversion !== "none").length;

  const canValidate = useMemo(() => {
    if (isMonthly && issuesWithoutSolution.length > 0) return false;
    return true;
  }, [isMonthly, issuesWithoutSolution]);

  const handleValidate = () => {
    if (isMonthly && issuesWithoutSolution.length > 0) {
      setIdsBlockOpen(true);
      return;
    }
    setConfirmOpen(true);
  };

  const confirmValidation = () => {
    setConfirmOpen(false);
    navigate("/?validated=true");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top banner */}
      <div className={`px-6 py-3 border-b ${aiReady ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
        {isMonthly ? (
          aiReady ? (
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-600" />
              <span className="text-sm font-medium text-emerald-800">Synthèse IA prête à valider ✓</span>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Loader2 className="h-4 w-4 text-amber-700 animate-spin" />
              <span className="text-sm font-medium text-amber-800">Réunion clôturée — Synthèse IA en cours de génération...</span>
              <div className="flex-1 max-w-[200px] h-1.5 bg-amber-200 rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full animate-pulse" style={{ width: "60%" }} />
              </div>
            </div>
          )
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-amber-800">Rapport en attente de validation</span>
          </div>
        )}
      </div>

      <div className="max-w-[900px] mx-auto px-6 py-6 pb-24">
        {/* ===== MONTHLY: IDS STRUCTURATION ===== */}
        {isMonthly && issues.length > 0 && (
          <section className="mb-8">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-semibold text-foreground">IDS — Structuration</h2>
              <span className="text-sm text-muted-foreground">
                {structuredCount}/{issues.length} structurés — {convertedCount} convertis en actions
              </span>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Structurez les problèmes identifiés pendant que la mémoire de réunion est fraîche
            </p>

            {issuesWithoutSolution.length > 0 && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-xs text-amber-800">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{issuesWithoutSolution.length} problème{issuesWithoutSolution.length > 1 ? "s" : ""} sans solution — requis avant validation finale</span>
              </div>
            )}

            <div className="space-y-4">
              {issues.map((issue, i) => (
                <IdsCard
                  key={issue.id}
                  issue={issue}
                  index={i}
                  onChange={(updated) => setIssues((p) => p.map((x) => (x.id === updated.id ? updated : x)))}
                />
              ))}
            </div>
          </section>
        )}

        {/* ===== SECTION CLÔTURE ===== */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">Clôture — Synthèse</h2>

          {!aiReady ? (
            /* Skeleton loading */
            <div className="space-y-4">
              <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                <div className="flex justify-between mb-3">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-5 w-24" />
                </div>
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4" />
              </div>
              <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                <Skeleton className="h-5 w-32 mb-3" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-2/3" />
              </div>
              <Button variant="outline" onClick={() => navigate(-1)} className="gap-1.5">
                Revenir plus tard
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* BLOC A — Résumé */}
              <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <label className="font-medium text-foreground text-sm">
                    {isMonthly ? "Résumé de la réunion" : "Résumé de la période"}
                  </label>
                  <AiBadge />
                </div>
                {editingSummary ? (
                  <>
                    <Textarea
                      className="text-sm min-h-[100px] mb-2"
                      value={summary}
                      onChange={(e) => setSummary(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => setEditingSummary(false)}>Enregistrer</Button>
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => { setSummary(aiSummary); setEditingSummary(false); }}>
                        <RefreshCw className="h-3 w-3" /> Re-générer
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-foreground leading-relaxed mb-3">{summary}</p>
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => setEditingSummary(true)}>
                      <Edit2 className="h-3 w-3" /> Modifier
                    </Button>
                  </>
                )}
              </div>

              {/* BLOC B — Décisions */}
              <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <label className="font-medium text-foreground text-sm">Décisions prises</label>
                  <AiBadge />
                </div>
                <ul className="space-y-2 mb-3">
                  {decisions.map((d, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span className="flex-1 text-foreground">{d}</span>
                      <button
                        onClick={() => setDecisions((p) => p.filter((_, idx) => idx !== i))}
                        className="text-muted-foreground hover:text-destructive shrink-0"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="flex gap-2">
                  <Input
                    placeholder="Ajouter une décision..."
                    value={newDecision}
                    onChange={(e) => setNewDecision(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newDecision.trim()) {
                        setDecisions((p) => [...p, newDecision.trim()]);
                        setNewDecision("");
                      }
                    }}
                    className="flex-1"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (newDecision.trim()) {
                        setDecisions((p) => [...p, newDecision.trim()]);
                        setNewDecision("");
                      }
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* BLOC C — To-do suggérés */}
              <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <label className="font-medium text-foreground text-sm">To-do suggérés pour le prochain cycle</label>
                  <AiBadge />
                </div>
                <div className="space-y-3">
                  {todoSuggestions.map((s, i) => (
                    <div key={i} className={`rounded-lg border p-3 ${s.status === "ignored" ? "opacity-50 bg-muted" : s.status === "confirmed" ? "border-emerald-300 bg-emerald-50" : "border-border bg-card"}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">{s.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {s.responsible} — {s.deadline}
                          </p>
                        </div>
                        <AiBadge />
                      </div>
                      {s.status === "pending" && (
                        <div className="flex gap-2 mt-3">
                          <Button
                            size="sm"
                            className="gap-1 h-7 text-xs"
                            onClick={() => setTodoSuggestions((p) => p.map((x, j) => (j === i ? { ...x, status: "confirmed" } : x)))}
                          >
                            <Check className="h-3 w-3" /> Confirmer
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs">Modifier</Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-muted-foreground"
                            onClick={() => setTodoSuggestions((p) => p.map((x, j) => (j === i ? { ...x, status: "ignored" } : x)))}
                          >
                            Ignorer
                          </Button>
                        </div>
                      )}
                      {s.status === "confirmed" && (
                        <p className="text-xs text-emerald-700 mt-2 flex items-center gap-1">
                          <Check className="h-3 w-3" /> To-do créé
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* BLOC D — Objectifs suggérés (monthly only) */}
              {isMonthly && objSuggestions.length > 0 && (
                <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <label className="font-medium text-foreground text-sm">Objectifs suggérés</label>
                    <AiBadge />
                  </div>
                  <div className="space-y-3">
                    {objSuggestions.map((s, i) => (
                      <div key={i} className={`rounded-lg border p-3 ${s.status === "ignored" ? "opacity-50 bg-muted" : s.status === "confirmed" ? "border-emerald-300 bg-emerald-50" : "border-border bg-card"}`}>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">{s.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {s.metric} — Cible : {s.target}
                          </p>
                        </div>
                        {s.status === "pending" && (
                          <div className="flex gap-2 mt-3">
                            <Button
                              size="sm"
                              className="gap-1 h-7 text-xs"
                              onClick={() => setObjSuggestions((p) => p.map((x, j) => (j === i ? { ...x, status: "confirmed" } : x)))}
                            >
                              <Check className="h-3 w-3" /> Confirmer
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs">Modifier</Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-muted-foreground"
                              onClick={() => setObjSuggestions((p) => p.map((x, j) => (j === i ? { ...x, status: "ignored" } : x)))}
                            >
                              Ignorer
                            </Button>
                          </div>
                        )}
                        {s.status === "confirmed" && (
                          <p className="text-xs text-emerald-700 mt-2 flex items-center gap-1">
                            <Check className="h-3 w-3" /> Objectif créé
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* BLOC E — Prochaine réunion */}
              <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                <label className="font-medium text-foreground text-sm block mb-3">
                  {isMonthly ? "Date de prochaine réunion" : "Fréquence configurée"}
                </label>
                {isMonthly ? (
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <Input
                        type="date"
                        value={nextDate}
                        onChange={(e) => setNextDate(e.target.value)}
                        className="w-44"
                      />
                    </div>
                    <Input
                      type="time"
                      value={nextTime}
                      onChange={(e) => setNextTime(e.target.value)}
                      className="w-28"
                    />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Fréquence configurée : tous les 7 jours</p>
                )}
              </div>
            </div>
          )}
        </section>

        {/* VALIDATION BUTTON */}
        {aiReady && (
          <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-[0_-2px_8px_rgba(0,0,0,0.06)] px-6 py-3 flex items-center justify-end z-50">
            <Button size="lg" className="gap-2" onClick={handleValidate}>
              <Check className="h-4 w-4" />
              Valider et diffuser à la Direction
            </Button>
          </div>
        )}
      </div>

      {/* IDS blocking modal */}
      <Dialog open={idsBlockOpen} onOpenChange={setIdsBlockOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              IDS incomplets
            </DialogTitle>
          </DialogHeader>
          <div className="mt-2">
            <p className="text-sm text-muted-foreground mb-3">
              Les problèmes suivants n'ont pas de solution renseignée :
            </p>
            <ul className="space-y-1.5 mb-4">
              {issuesWithoutSolution.map((i) => (
                <li key={i.id} className="text-sm text-foreground flex items-center gap-2">
                  <span className="text-destructive">•</span> {i.text}
                </li>
              ))}
            </ul>
            <Button onClick={() => setIdsBlockOpen(false)} className="w-full">
              Compléter les solutions
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation modal */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Valider et diffuser ?</DialogTitle>
          </DialogHeader>
          <div className="mt-2 space-y-3">
            <p className="text-sm text-muted-foreground">
              Ce rapport sera partagé avec la Direction. Confirmer ?
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setConfirmOpen(false)}>Annuler</Button>
              <Button onClick={confirmValidation} className="gap-1.5">
                <Check className="h-4 w-4" /> Confirmer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
