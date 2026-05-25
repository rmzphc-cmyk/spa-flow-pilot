import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, AlertTriangle, Sparkles, CheckCircle2, Target, Calendar, Plus, FileText, Eye } from "lucide-react";
import {
  useMeetingSchedule,
  nextWeeklyMeeting,
  nextMonthlyMeeting,
  daysUntil,
} from "@/lib/meetingSchedule";
import {
  getReports,
  isPreparationState,
  type ReportRecord,
  type ReportState,
} from "@/lib/reportsStore";

type ReportStatus = ReportState;

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

const overdueTodos = [
  { id: "t1", title: "Finaliser planning cabines semaine 13", daysOverdue: 3 },
  { id: "t2", title: "Commander stocks produits soins visage", daysOverdue: 2 },
  { id: "t3", title: "Entretien annuel — Sophie M.", daysOverdue: 1 },
];

const aiBriefItems = [
  { icon: "📋", text: "2 to-do arrivent à deadline cette semaine" },
  { icon: "📉", text: "Panier moyen en baisse depuis 2 cycles" },
  { icon: "🎯", text: "Objectif « NPS > 8.5 » est à risque" },
];

const recentActivity = [
  { id: "r3", label: "Monthly — Février 2026", date: "3 mars 2026" },
];

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

function OverdueAlert({ todos }: { todos: typeof overdueTodos }) {
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

function AiBriefCard() {
  const navigate = useNavigate();
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
        {aiBriefItems.map((item, i) => (
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

function RecentActivity() {
  const navigate = useNavigate();
  if (recentActivity.length === 0) return null;
  return (
    <div className="bg-card rounded-xl shadow-sm border border-border p-5">
      <h2 className="text-base font-semibold text-foreground mb-3">Activité récente</h2>
      <ul className="space-y-2">
        {recentActivity.map((item) => (
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

function UpcomingMeetingsCard() {
  const navigate = useNavigate();
  const schedule = useMeetingSchedule();
  const now = new Date();
  const weeklyDate = nextWeeklyMeeting(schedule.weekly_day, now);
  const monthlyDate = nextMonthlyMeeting(schedule, now);

  // Readiness mock — derive from existing draft state.
  const readiness: Record<"weekly" | "monthly", { completion: number; reportId: string | null }> = {
    weekly: { completion: 0, reportId: draftReportsByType.weekly },
    monthly: { completion: 29, reportId: draftReportsByType.monthly },
  };

  const meetings = [
    { type: "weekly" as const, date: weeklyDate, label: "🟢 Weekly", chip: "bg-emerald-100 text-emerald-800" },
    { type: "monthly" as const, date: monthlyDate, label: "🔵 Monthly", chip: "bg-blue-100 text-blue-800" },
  ];

  const fmt = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
      {meetings.map((m) => {
        const days = daysUntil(m.date, now);
        const ready = readiness[m.type];
        const isReady = ready.completion >= 80;
        const readinessBadge = isReady
          ? { label: "Prêt", cls: "bg-emerald-100 text-emerald-800" }
          : { label: "À préparer", cls: days <= 2 ? "bg-destructive/15 text-destructive" : "bg-amber-100 text-amber-800" };
        const daysLabel = days === 0 ? "Aujourd'hui" : days === 1 ? "Demain" : `Dans ${days} jours`;

        const handleClick = () => {
          if (ready.reportId) navigate(`/rapport/${ready.reportId}`);
          else navigate("/rapports");
        };

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
  );
}

// --- Main Dashboard ---

export default function Dashboard() {
  return (
    <>
      <h1 className="text-2xl font-bold text-foreground mb-6">Dashboard</h1>
      <UpcomingMeetingsCard />
      <OverdueAlert todos={overdueTodos} />
      <CurrentReportCard report={currentReport} />
      <AiBriefCard />
      <QuickMetrics />
      <RecentActivity />
    </>
  );
}

