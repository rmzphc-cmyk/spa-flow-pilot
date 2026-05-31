import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, AlertTriangle, Sparkles, CheckCircle2, Target, Calendar, Plus, FileText, Eye, Loader2, CalendarClock } from "lucide-react";
import {
  useMeetingSchedule,
  nextWeeklyMeeting,
  nextMonthlyMeeting,
  daysUntil,
  computeWeeklyPeriodForNextMeeting,
  computePreviousWeeklyPeriod,
  computeWeeklyLabel,
} from "@/lib/meetingSchedule";
import {
  isPreparationState,
  type ReportRecord,
  type ReportState,
} from "@/lib/reportsStore";
import { useReports, useCreateReport, mapReportRowToRecord, type ReportRow } from "@/hooks/useReports";
import { useAuth } from "@/contexts/AuthContext";
import { useTodos } from "@/hooks/useTodos";
import { useObjectives, parseObjectiveDescription } from "@/hooks/useObjectives";
import { useKpiEntries } from "@/hooks/useKpiEntries";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useToast } from "@/hooks/use-toast";

type ReportStatus = ReportState;

type OverdueTodo = { id: string; title: string; daysOverdue: number };
type AiBriefItem = { icon: string; text: string };
type RecentActivityItem = { id: string; label: string; date: string };

const WEEKLY_SECTION_KEYS = ["kpi", "checkin", "ids"] as const;
const MONTHLY_SECTION_KEYS = ["kpi", "checkin", "responsabilites", "todo", "objectifs", "ids", "cloture"] as const;

function getSectionKeysFor(type: "weekly" | "monthly"): readonly string[] {
  return type === "weekly" ? WEEKLY_SECTION_KEYS : MONTHLY_SECTION_KEYS;
}

function computeCompletion(report: ReportRecord): { completed: number; total: number; percent: number } {
  const keys = getSectionKeysFor(report.type);
  const details = (report.details ?? {}) as unknown as Record<string, unknown>;
  const completed = keys.filter((k) => details[k] != null).length;
  return { completed, total: keys.length, percent: Math.round((completed / keys.length) * 100) };
}

// --- Status config ---

const statusConfig: Record<ReportStatus, { label: string; bg: string; text: string }> = {
  draft_preparation: { label: "En préparation", bg: "bg-muted", text: "text-muted-foreground" },
  ready_for_review: { label: "Soumis pour revue", bg: "bg-blue-100", text: "text-blue-800" },
  in_meeting: { label: "Réunion en cours", bg: "bg-orange-100", text: "text-orange-800" },
  post_meeting_generated: { label: "Synthèse IA prête à valider", bg: "bg-violet-100", text: "text-violet-800" },
  validated: { label: "Validé et diffusé", bg: "bg-emerald-100", text: "text-emerald-800" },
};

function getCtaConfig(status: ReportStatus, type: "weekly" | "monthly") {
  switch (status) {
    case "draft_preparation":
      return { label: "Continuer la préparation", icon: ArrowRight };
    case "ready_for_review":
      return type === "monthly" ? { label: "Démarrer la réunion", icon: ArrowRight } : null;
    case "in_meeting":
      return { label: "Accéder à la réunion", icon: ArrowRight };
    case "post_meeting_generated":
      return { label: "Valider la synthèse IA — 5 min", icon: CheckCircle2 };
    case "validated":
      return { label: "Voir le rapport validé", icon: Eye };
    default:
      return null;
  }
}

// --- Components ---

function OverdueAlert({ todos }: { todos: OverdueTodo[] }) {
  if (todos.length === 0) return null;
  return (
    <div className="rounded-xl p-5 mb-4" style={{ backgroundColor: "#FEE2E2" }}>
      <h2 className="text-base font-bold text-destructive flex items-center gap-2 mb-3">
        <AlertTriangle className="h-5 w-5" />
        {todos.length} action{todos.length > 1 ? "s" : ""} en retard
      </h2>
      <ul className="space-y-1.5">
        {todos.slice(0, 3).map((todo) => (
          <li key={todo.id} className="text-sm text-foreground flex justify-between">
            <span>{todo.title}</span>
            <span className="text-destructive font-medium text-xs shrink-0 ml-3">+{todo.daysOverdue}j</span>
          </li>
        ))}
      </ul>
      {todos.length > 3 && (
        <button className="text-sm text-destructive font-medium mt-3 hover:underline">
          Voir tous les retards →
        </button>
      )}
    </div>
  );
}

function CurrentReportCard({ report }: { report: ReportRecord }) {
  const navigate = useNavigate();
  const status = statusConfig[report.state];
  const cta = getCtaConfig(report.state, report.type);
  const { completed, total } = computeCompletion(report);

  const sectionColors = Array.from({ length: total }, (_, i) =>
    i < completed ? "bg-primary" : "bg-border"
  );


  return (
    <div className="bg-card rounded-xl shadow-sm border border-border p-6 mb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
              report.type === "weekly" ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-blue-800"
            }`}
          >
            {report.type === "weekly" ? "🟢 Weekly" : "🔵 Monthly"}
          </span>
          <span className="text-sm text-muted-foreground">{report.period}</span>
        </div>
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${status.bg} ${status.text}`}>
          {status.label}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mb-1">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-foreground">Progression</span>
          <span className="text-xs text-muted-foreground">{completed}/{total} sections</span>
        </div>
        <div className="flex gap-1 h-2">
          {sectionColors.map((color, i) => (
            <div key={i} className={`flex-1 rounded-full ${color} transition-colors`} />
          ))}
        </div>
      </div>

      {/* CTA */}
      {cta && (
        <div className="mt-5 flex flex-col items-start gap-2">
          <Button
            onClick={() => navigate(`/rapport/${report.id}`)}
            className="gap-2"
            size="lg"
          >
            <cta.icon className="h-4 w-4" />
            {cta.label}
          </Button>
          <button
            onClick={() => navigate(`/rapport/${report.id}`)}
            className="text-sm text-muted-foreground hover:text-foreground hover:underline transition-colors"
          >
            Voir le rapport complet
          </button>
        </div>
      )}
    </div>
  );
}

function NoCurrentReportCard() {
  const navigate = useNavigate();
  return (
    <div className="bg-card rounded-xl shadow-sm border border-dashed border-border p-8 mb-4 text-center">
      <FileText className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
      <p className="text-foreground font-medium">Aucun rapport en cours</p>
      <p className="text-sm text-muted-foreground mt-1 mb-4">Créez un rapport pour démarrer un nouveau cycle.</p>
      <Button onClick={() => navigate("/rapports")} className="gap-1.5">
        <Plus className="h-4 w-4" /> Créer un rapport
      </Button>
    </div>
  );
}

function AiBriefCard({ items }: { items: AiBriefItem[] }) {
  const navigate = useNavigate();
  if (items.length === 0) return null;
  return (
    <div className="rounded-xl border border-primary/20 p-5 mb-4" style={{ backgroundColor: "hsl(174, 95%, 95%)" }}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-foreground">Votre réunion est dans 2 jours</h2>
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
          <Sparkles className="h-3 w-3" />
          Suggestion IA
        </span>
      </div>
      <ul className="space-y-2 mb-4">
        {items.map((item, i) => (
          <li key={i} className="text-sm text-foreground flex items-start gap-2">
            <span>{item.icon}</span>
            <span>{item.text}</span>
          </li>
        ))}
      </ul>
      <button
        onClick={() => navigate("/rapport/r1")}
        className="text-sm text-primary font-medium hover:underline"
      >
        Commencer la préparation →
      </button>
    </div>
  );
}

function QuickMetrics() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
      {/* Responsabilités */}
      <div className="bg-card rounded-xl shadow-sm border border-border p-5 flex items-center gap-4">
        <div className="relative h-14 w-14 shrink-0">
          <svg viewBox="0 0 36 36" className="h-14 w-14 -rotate-90">
            <circle cx="18" cy="18" r="15.5" fill="none" strokeWidth="3" className="stroke-border" />
            <circle
              cx="18" cy="18" r="15.5" fill="none" strokeWidth="3"
              className="stroke-primary"
              strokeDasharray={`${0.75 * 97.4} ${97.4}`}
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-foreground">75%</span>
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">Responsabilités</p>
          <p className="text-xs text-muted-foreground">complétion globale</p>
        </div>
      </div>

      {/* To-do */}
      <div className="bg-card rounded-xl shadow-sm border border-border p-5 flex items-center gap-4">
        <div className="relative h-14 w-14 shrink-0">
          <svg viewBox="0 0 36 36" className="h-14 w-14 -rotate-90">
            <circle cx="18" cy="18" r="15.5" fill="none" strokeWidth="3" className="stroke-border" />
            <circle
              cx="18" cy="18" r="15.5" fill="none" strokeWidth="3"
              className="stroke-primary"
              strokeDasharray={`${(5 / 8) * 97.4} ${97.4}`}
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-foreground">5/8</span>
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">To-do actifs</p>
          <p className="text-xs text-muted-foreground">réalisés ce cycle</p>
        </div>
      </div>

      {/* Objectifs */}
      <div className="bg-card rounded-xl shadow-sm border border-border p-5 flex items-center gap-4">
        <div className="flex items-center gap-1.5 shrink-0">
          {[true, true, false].map((active, i) => (
            <div
              key={i}
              className={`h-10 w-10 rounded-full flex items-center justify-center text-lg ${
                active ? "bg-emerald-100" : "bg-muted"
              }`}
            >
              <Target className={`h-5 w-5 ${active ? "text-emerald-700" : "text-muted-foreground"}`} />
            </div>
          ))}
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">2/3 objectifs</p>
          <p className="text-xs text-muted-foreground">actifs ce mois</p>
        </div>
      </div>
    </div>
  );
}

function RecentActivity({ items }: { items: RecentActivityItem[] }) {
  const navigate = useNavigate();
  if (items.length === 0) return null;
  return (
    <div className="bg-card rounded-xl shadow-sm border border-border p-5">
      <h2 className="text-base font-semibold text-foreground mb-3">Activité récente</h2>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span className="text-foreground">{item.label}</span>
              <span className="text-muted-foreground">— {item.date}</span>
            </div>
            <button
              onClick={() => navigate(`/rapport/${item.id}`)}
              className="text-sm text-primary hover:underline font-medium"
            >
              Voir
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

const FR_DAY_MONTH = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" });
const FR_FULL = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const FR_MONTH_YEAR = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });

function formatIsoFr(iso: string): string {
  return FR_DAY_MONTH.format(new Date(iso + "T12:00:00"));
}

type PendingDialog =
  | { kind: "weekly"; period: { meetingDate: Date; periodStart: string; periodEnd: string }; previousMissing: boolean; previousMeetingDate: Date }
  | { kind: "monthly"; period: { meetingDate: Date; periodStart: string; periodEnd: string; label: string } };

function UpcomingMeetingsCard({ reports, rows }: { reports: ReportRecord[]; rows: ReportRow[] }) {
  const navigate = useNavigate();
  const schedule = useMeetingSchedule();
  const createReport = useCreateReport();
  const { toast: showToast } = useToast();
  const now = new Date();
  const weeklyDate = nextWeeklyMeeting(schedule.weekly_day, now);
  const monthlyDate = nextMonthlyMeeting(schedule, now);

  const toLocalISO = (d: Date): string => {
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${mo}-${day}`;
  };

  const [pending, setPending] = useState<PendingDialog | null>(null);

  // Pre-compute current periods (timezone-safe)
  const currentWeeklyPeriod = computeWeeklyPeriodForNextMeeting(schedule.weekly_day, now);
  const currentMonthlyPeriodStart = toLocalISO(
    new Date(monthlyDate.getFullYear(), monthlyDate.getMonth(), 1)
  );

  // Find draft scoped to the current period (for completion %)
  const weeklyDraftRow = rows.find(
    (r) => r.cycle_type === "weekly" && r.status !== "validated" && r.period_start === currentWeeklyPeriod.periodStart
  );
  const monthlyDraftRow = rows.find(
    (r) => r.cycle_type === "monthly" && r.status !== "validated" && r.period_start === currentMonthlyPeriodStart
  );
  const weeklyDraft = weeklyDraftRow
    ? reports.find((r) => r.id === weeklyDraftRow.id && isPreparationState(r.state)) ?? null
    : null;
  const monthlyDraft = monthlyDraftRow
    ? reports.find((r) => r.id === monthlyDraftRow.id && isPreparationState(r.state)) ?? null
    : null;

  // Find any report for the current period (validated or not)
  const weeklyReportForCurrentPeriod = rows.find(
    (r) => r.cycle_type === "weekly" && r.period_start === currentWeeklyPeriod.periodStart
  ) ?? null;
  const monthlyReportForCurrentPeriod = rows.find(
    (r) => r.cycle_type === "monthly" && r.period_start === currentMonthlyPeriodStart
  ) ?? null;

  const readiness: Record<"weekly" | "monthly", { completion: number; reportId: string | null; isValidated: boolean }> = {
    weekly: {
      completion: weeklyReportForCurrentPeriod?.status === "validated"
        ? 100
        : weeklyDraft ? computeCompletion(weeklyDraft).percent : 0,
      reportId: weeklyReportForCurrentPeriod?.id ?? null,
      isValidated: weeklyReportForCurrentPeriod?.status === "validated",
    },
    monthly: {
      completion: monthlyReportForCurrentPeriod?.status === "validated"
        ? 100
        : monthlyDraft ? computeCompletion(monthlyDraft).percent : 0,
      reportId: monthlyReportForCurrentPeriod?.id ?? null,
      isValidated: monthlyReportForCurrentPeriod?.status === "validated",
    },
  };

  const meetings = [
    { type: "weekly" as const, date: weeklyDate, label: "🟢 Weekly", chip: "bg-emerald-100 text-emerald-800" },
    { type: "monthly" as const, date: monthlyDate, label: "🔵 Monthly", chip: "bg-blue-100 text-blue-800" },
  ];

  const fmt = FR_FULL;

  const handleWeeklyClick = () => {
    const currentPeriod = computeWeeklyPeriodForNextMeeting(schedule.weekly_day, now);
    const previousPeriod = computePreviousWeeklyPeriod(schedule.weekly_day, now);
    const allWeeklyReports = rows.filter((r) => r.cycle_type === "weekly");
    const isFirstWeeklyReport = allWeeklyReports.length === 0;
    const hasPreviousValidated = rows.some(
      (r) => r.cycle_type === "weekly" && r.period_start === previousPeriod.periodStart && r.status === "validated"
    );
    const previousPeriodMissing = !isFirstWeeklyReport && !hasPreviousValidated;
    const weeklyReportForPeriod = rows.find(
      (r) => r.cycle_type === "weekly" && r.period_start === currentPeriod.periodStart
    );
    if (weeklyReportForPeriod) {
      navigate(`/rapport/${weeklyReportForPeriod.id}`);
      return;
    }
    setPending({
      kind: "weekly",
      period: currentPeriod,
      previousMissing: previousPeriodMissing,
      previousMeetingDate: previousPeriod.meetingDate,
    });
  };

  const handleMonthlyClick = () => {
    const target = nextMonthlyMeeting(schedule, now);
    const y = target.getFullYear();
    const m = target.getMonth();
    const first = new Date(y, m, 1);
    const last = new Date(y, m + 1, 0);
    const toLocalISO = (d: Date): string => {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };
    const periodStart = toLocalISO(first);
    const periodEnd = toLocalISO(last);
    const label = FR_MONTH_YEAR.format(target).replace(/^./, (c) => c.toUpperCase());
    const monthlyDraftForPeriod = rows.find(
      (r) => r.cycle_type === "monthly" && r.period_start === periodStart && r.status !== "validated"
    );
    if (monthlyDraftForPeriod) {
      navigate(`/rapport/${monthlyDraftForPeriod.id}`);
      return;
    }
    setPending({ kind: "monthly", period: { meetingDate: target, periodStart, periodEnd, label } });
  };

  const handleConfirmCreate = async () => {
    if (!pending) return;
    try {
      if (pending.kind === "weekly") {
        const created = await createReport.mutateAsync({
          cycle_type: "weekly",
          cycle_label: computeWeeklyLabel(pending.period.periodStart),
          period_start: pending.period.periodStart,
          period_end: pending.period.periodEnd,
        });
        setPending(null);
        navigate(`/rapport/${created.id}`);
      } else {
        const created = await createReport.mutateAsync({
          cycle_type: "monthly",
          cycle_label: pending.period.label,
          period_start: pending.period.periodStart,
          period_end: pending.period.periodEnd,
        });
        setPending(null);
        navigate(`/rapport/${created.id}`);
      }
    } catch (e: any) {
      const msg: string = e?.message ?? "";
      if (msg.includes("rapport actif existe") || msg.includes("existe déjà")) {
        const existingDraft = rows.find(
          (r) => r.cycle_type === (pending?.kind ?? "weekly") && r.status !== "validated"
        );
        if (existingDraft) {
          setPending(null);
          navigate(`/rapport/${existingDraft.id}`);
          return;
        }
      }
      showToast({ title: "Erreur", description: msg || "Impossible de créer le rapport.", variant: "destructive" });
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        {meetings.map((m) => {
          const days = daysUntil(m.date, now);
          const ready = readiness[m.type];
          const isReady = ready.completion >= 80;
          const readinessBadge = isReady
            ? { label: "Prêt", cls: "bg-emerald-100 text-emerald-800" }
            : { label: "À préparer", cls: days <= 2 ? "bg-destructive/15 text-destructive" : "bg-amber-100 text-amber-800" };
          const daysLabel = days === 0 ? "Aujourd'hui" : days === 1 ? "Demain" : `Dans ${days} jours`;

          const handleClick = m.type === "weekly" ? handleWeeklyClick : handleMonthlyClick;

          return (
            <button
              key={m.type}
              onClick={handleClick}
              className="bg-card rounded-xl shadow-sm border border-border p-5 text-left hover:shadow-md hover:border-primary/40 transition-all"
            >
              <div className="flex items-center justify-between mb-3 gap-2">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${m.chip}`}>
                  {m.label}
                </span>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${readinessBadge.cls}`}>
                  {readinessBadge.label}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-foreground mb-1">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="capitalize">{fmt.format(m.date)}</span>
              </div>
              <p className="text-xs text-muted-foreground mb-4">{daysLabel}</p>
              {ready.reportId ? (
                <span className="inline-flex items-center gap-1 text-sm text-primary font-medium">
                  {isReady ? "Ouvrir la réunion" : "Continuer la préparation"}
                  <ArrowRight className="h-4 w-4" />
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-sm text-primary font-medium">
                  <Plus className="h-4 w-4" /> Créer le rapport
                </span>
              )}
            </button>
          );
        })}
      </div>

      <AlertDialog open={!!pending} onOpenChange={(v) => !v && !createReport.isPending && setPending(null)}>
        <AlertDialogContent>
          {pending?.kind === "weekly" && pending.previousMissing && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  Semaine précédente sans rapport
                </AlertDialogTitle>
                <AlertDialogDescription>
                  La réunion du {FR_FULL.format(pending.previousMeetingDate)} n'a pas de rapport validé.
                  Elle apparaîtra comme réunion non effectuée dans votre historique.
                  <br /><br />
                  Créer le rapport pour la semaine du {formatIsoFr(pending.period.periodStart)} au {formatIsoFr(pending.period.periodEnd)} ?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={createReport.isPending}>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleConfirmCreate}
                  disabled={createReport.isPending}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {createReport.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Créer quand même
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
          {pending?.kind === "weekly" && !pending.previousMissing && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Créer le rapport Weekly</AlertDialogTitle>
                <AlertDialogDescription>
                  Ce rapport couvrira la période du {formatIsoFr(pending.period.periodStart)} au {formatIsoFr(pending.period.periodEnd)}.
                  <br />
                  Réunion prévue le {FR_FULL.format(pending.period.meetingDate)}.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={createReport.isPending}>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={handleConfirmCreate} disabled={createReport.isPending}>
                  {createReport.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Créer le rapport
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
          {pending?.kind === "monthly" && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Créer le rapport Monthly</AlertDialogTitle>
                <AlertDialogDescription>
                  Ce rapport couvrira la période du {formatIsoFr(pending.period.periodStart)} au {formatIsoFr(pending.period.periodEnd)}.
                  <br />
                  Réunion prévue le {FR_FULL.format(pending.period.meetingDate)}.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={createReport.isPending}>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={handleConfirmCreate} disabled={createReport.isPending}>
                  {createReport.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Créer le rapport
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// --- Main Dashboard ---

const FR_LONG_DATE = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });

export default function Dashboard() {
  const { spaId } = useAuth();
  const { data: rows = [] } = useReports();
  const reports = useMemo(() => rows.map(mapReportRowToRecord), [rows]);

  const currentReport = reports
    .filter((r) => r.state !== "validated" && isPreparationState(r.state))
    .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""))[0];

  // Last validated report (raw row, for validated_at + KPI lookup)
  const validatedRows = useMemo(
    () =>
      [...rows]
        .filter((r) => r.status === "validated")
        .sort((a, b) => (b.validated_at ?? "").localeCompare(a.validated_at ?? "")),
    [rows]
  );
  const lastValidatedReportId = validatedRows[0]?.id;

  const { data: todos = [] } = useTodos("dashboard-overdue", spaId);
  const { data: kpiEntries = [] } = useKpiEntries(lastValidatedReportId);
  const { data: objectives = [] } = useObjectives(spaId);

  // 1. Overdue todos
  const overdueTodos = useMemo<OverdueTodo[]>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return todos
      .filter((t) => t.status !== "done" && t.due_date && new Date(t.due_date) < today)
      .map((t) => {
        const due = new Date(t.due_date as string);
        const days = Math.floor((today.getTime() - due.getTime()) / 86400000);
        return { id: t.id, title: t.title, daysOverdue: days };
      })
      .sort((a, b) => b.daysOverdue - a.daysOverdue);
  }, [todos]);

  // 2. AI brief items
  const aiBriefItems = useMemo<AiBriefItem[]>(() => {
    const overdueCount = overdueTodos.length;
    const redKpiCount = kpiEntries.filter((e) => e.status === "red").length;
    const atRiskObjectives = objectives.filter((o) => {
      const parsed = parseObjectiveDescription(o.description);
      return parsed.status_ui === "at_risk" || parsed.status_ui === "behind";
    }).length;

    const items: AiBriefItem[] = [];
    if (overdueCount > 0) {
      items.push({ icon: "📋", text: `${overdueCount} to-do en retard` });
    }
    if (redKpiCount > 0) {
      items.push({ icon: "📉", text: `${redKpiCount} KPI en alerte sur le dernier rapport validé` });
    }
    if (atRiskObjectives > 0) {
      items.push({ icon: "🎯", text: `${atRiskObjectives} objectif${atRiskObjectives > 1 ? "s" : ""} à risque` });
    }
    return items;
  }, [overdueTodos.length, kpiEntries, objectives]);

  // 3. Recent activity
  const recentActivity = useMemo<RecentActivityItem[]>(
    () =>
      validatedRows.slice(0, 3).map((r) => ({
        id: r.id,
        label: r.cycle_label,
        date: r.validated_at ? FR_LONG_DATE.format(new Date(r.validated_at)) : "",
      })),
    [validatedRows]
  );

  return (
    <>
      <h1 className="text-2xl font-bold text-foreground mb-6">Dashboard</h1>
      <ScheduleNotConfiguredBanner />
      <UpcomingMeetingsCard reports={reports} rows={rows} />
      <OverdueAlert todos={overdueTodos} />
      {currentReport ? <CurrentReportCard report={currentReport} /> : <NoCurrentReportCard />}
      <AiBriefCard items={aiBriefItems} />
      <QuickMetrics />
      <RecentActivity items={recentActivity} />
    </>
  );
}

function ScheduleNotConfiguredBanner() {
  const navigate = useNavigate();
  const { isScheduleConfigured } = useMeetingSchedule();
  if (isScheduleConfigured) return null;
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 mb-4 flex items-start gap-3">
      <CalendarClock className="h-5 w-5 text-amber-700 mt-0.5 shrink-0" />
      <div className="flex-1 text-sm text-amber-900">
        Calendrier de réunions non configuré — les dates affichées sont des valeurs par défaut.
      </div>
      <Button
        variant="outline"
        size="sm"
        className="shrink-0 border-amber-300 text-amber-900 hover:bg-amber-100"
        onClick={() => navigate("/admin/responsabilites")}
      >
        Configurer →
      </Button>
    </div>
  );
}

