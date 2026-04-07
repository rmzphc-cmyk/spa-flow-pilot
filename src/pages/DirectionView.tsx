import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import {
  ChevronLeft,
  ArrowRight,
  Check,
  Sparkles,
  Target,
  AlertTriangle,
} from "lucide-react";

// --- Types & Mock Data ---

type ReportType = "monthly" | "weekly";

interface DirectionReport {
  id: string;
  spa: string;
  manager: string;
  period: string;
  type: ReportType;
  meetingDate: string | null;
  status: string;
  situationGlobale: string;
  meteoEquipe: number;
  meteoEquipeN1: number;
  energieManager: number;
  energieManagerN1: number;
  kpis: { label: string; unit: string; value: number; target: number; status: "green" | "amber" | "red"; comment: string }[];
  respCompletion: number;
  todoCompleted: number;
  todoTotal: number;
  todoOverdue: number;
  objectifs: { title: string; status: "on_track" | "at_risk" | "behind"; progress: number }[];
  ids: { problem: string; solution: string; conversion: string | null }[];
  weeklySignals: string[];
  aiSummary: string;
  aiActions: string[];
}

const reports: Record<string, DirectionReport> = {
  r1: {
    id: "r1", spa: "Spa Le Domaine", manager: "Marie Dupont",
    period: "1 mars → 31 mars 2026", type: "monthly", meetingDate: "28 mars 2026", status: "validated",
    situationGlobale: "Le spa tourne bien malgré deux arrêts maladie imprévus. L'équipe reste engagée et les résultats commerciaux sont proches des objectifs.",
    meteoEquipe: 7, meteoEquipeN1: 8, energieManager: 6, energieManagerN1: 7,
    kpis: [
      { label: "CA du mois", unit: "€", value: 42000, target: 45000, status: "amber", comment: "Légère baisse due aux vacances scolaires" },
      { label: "Taux d'occupation", unit: "%", value: 78, target: 80, status: "amber", comment: "" },
      { label: "Panier moyen", unit: "€", value: 125, target: 120, status: "green", comment: "" },
      { label: "NPS clients", unit: "/10", value: 8.2, target: 8.5, status: "amber", comment: "Quelques retours négatifs sur l'accueil" },
      { label: "Ventes produits", unit: "€", value: 9200, target: 8000, status: "green", comment: "" },
      { label: "Absentéisme", unit: "j", value: 4, target: 2, status: "red", comment: "2 arrêts maladie non prévus" },
    ],
    respCompletion: 73,
    todoCompleted: 5, todoTotal: 8, todoOverdue: 2,
    objectifs: [
      { title: "Augmenter le NPS clients", status: "at_risk", progress: 65 },
      { title: "Réduire l'absentéisme", status: "behind", progress: 30 },
    ],
    ids: [
      { problem: "Temps d'attente trop long à l'accueil les samedis", solution: "Système de file d'attente numérique", conversion: "to-do" },
      { problem: "Produits de soin périmés en cabine 2", solution: "Audit complet des stocks", conversion: "to-do" },
      { problem: "Conflits de planning vendredi", solution: "Rotation des praticiens", conversion: "objectif" },
    ],
    weeklySignals: [],
    aiSummary: "Mars 2026 marque un mois correct pour le Spa Le Domaine. Le CA de 42k€ reste légèrement sous l'objectif de 45k€, principalement en raison des vacances scolaires. Les ventes produits dépassent l'objectif (+15%). Le point de vigilance principal concerne l'absentéisme (4 jours vs 2 ciblés) et le NPS en légère baisse. Trois problèmes structurels ont été identifiés et convertis en actions concrètes.",
    aiActions: [
      "Installer le système de file d'attente numérique d'ici le 15 avril",
      "Réaliser l'audit produits dans toutes les cabines avant le 5 avril",
      "Proposer un nouveau planning vendredi avec rotation des praticiens",
    ],
  },
  r2: {
    id: "r2", spa: "Spa Le Domaine", manager: "Marie Dupont",
    period: "18 → 24 mars 2026", type: "weekly", meetingDate: null, status: "validated",
    situationGlobale: "Semaine stable, bonne dynamique commerciale.",
    meteoEquipe: 8, meteoEquipeN1: 7, energieManager: 7, energieManagerN1: 7,
    kpis: [
      { label: "CA hebdo", unit: "€", value: 11200, target: 11000, status: "green", comment: "" },
      { label: "Taux d'occupation", unit: "%", value: 82, target: 80, status: "green", comment: "" },
      { label: "Panier moyen", unit: "€", value: 118, target: 120, status: "amber", comment: "Légèrement sous la cible" },
      { label: "NPS clients", unit: "/10", value: 8.6, target: 8.5, status: "green", comment: "" },
    ],
    respCompletion: 88,
    todoCompleted: 6, todoTotal: 7, todoOverdue: 0,
    objectifs: [
      { title: "Augmenter le NPS clients", status: "on_track", progress: 75 },
      { title: "Réduire l'absentéisme", status: "at_risk", progress: 50 },
    ],
    ids: [],
    weeklySignals: ["Climatisation cabine 4 défaillante", "Stock bas sur huiles essentielles"],
    aiSummary: "Semaine 12 stable avec un bon rythme commercial. Le CA dépasse légèrement l'objectif. Le panier moyen est à surveiller. Pas de retard sur les to-do.",
    aiActions: [],
  },
};

// --- Helpers ---

const statusBadge: Record<string, { label: string; classes: string }> = {
  validated: { label: "Validé", classes: "bg-emerald-100 text-emerald-800" },
  post_meeting_generated: { label: "Post-réunion", classes: "bg-violet-100 text-violet-800" },
};

const kpiStatusDot: Record<string, string> = {
  green: "bg-emerald-500", amber: "bg-amber-500", red: "bg-red-500",
};

const objStyles: Record<string, { label: string; bg: string; text: string }> = {
  on_track: { label: "En bonne voie", bg: "bg-emerald-50", text: "text-emerald-800" },
  at_risk: { label: "À risque", bg: "bg-amber-50", text: "text-amber-800" },
  behind: { label: "En retard", bg: "bg-red-50", text: "text-red-800" },
};

function GaugeArc({ value, label, n1 }: { value: number; label: string; n1: number }) {
  const pct = Math.min(100, (value / 10) * 100);
  const color = value >= 7 ? "#10B981" : value >= 5 ? "#F59E0B" : "#EF4444";
  const circumference = Math.PI * 60; // half circle r=60
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <svg width="120" height="70" viewBox="0 0 120 70">
        <path d="M 10 65 A 50 50 0 0 1 110 65" fill="none" stroke="hsl(var(--border))" strokeWidth="8" strokeLinecap="round" />
        <path
          d="M 10 65 A 50 50 0 0 1 110 65"
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={`${offset}`}
        />
      </svg>
      <span className="text-2xl font-bold text-foreground -mt-8">{value}</span>
      <span className="text-xs text-muted-foreground mt-1">{label}</span>
      <span className="text-xs text-muted-foreground/60">N-1 : {n1}/10</span>
    </div>
  );
}

// --- Main ---

export default function DirectionView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const report = reports[id ?? ""];

  if (!report) {
    return (
      <div className="max-w-[860px] mx-auto px-6 py-12 text-center">
        <p className="text-foreground font-medium">Rapport introuvable</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/rapports")}>
          Retour aux rapports
        </Button>
      </div>
    );
  }

  const isMonthly = report.type === "monthly";
  const sb = statusBadge[report.status] ?? statusBadge.validated;

  const sortedKpis = [...report.kpis].sort((a, b) => {
    const order = { red: 0, amber: 1, green: 2 };
    return order[a.status] - order[b.status];
  });

  const objOnTrack = report.objectifs.filter((o) => o.status === "on_track").length;
  const objAtRisk = report.objectifs.filter((o) => o.status === "at_risk").length;
  const objBehind = report.objectifs.filter((o) => o.status === "behind").length;

  return (
    <div className="max-w-[860px] mx-auto px-6 py-6 pb-20">
      {/* BLOC 0 — Header */}
      <header className="border-b border-border pb-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-foreground">{report.spa}</h1>
            <p className="text-sm text-muted-foreground">{report.manager}</p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${isMonthly ? "bg-blue-100 text-blue-800" : "bg-emerald-100 text-emerald-800"}`}>
                {isMonthly ? "🔵 Monthly" : "🟢 Weekly"}
              </span>
              <span className="text-sm text-foreground">{report.period}</span>
            </div>
            <div className="flex items-center gap-2">
              {report.meetingDate && <span className="text-xs text-muted-foreground">Réunion : {report.meetingDate}</span>}
              <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${sb.classes}`}>
                <Check className="h-3 w-3" /> {sb.label}
              </span>
            </div>
          </div>
        </div>
        <div className="mt-3">
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground gap-1" onClick={() => navigate("/rapports")}>
            Historique du spa <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
      </header>

      {/* BLOC 1 — Situation globale */}
      <section className="mb-8">
        <div className="mb-4">
          {report.situationGlobale ? (
            <p className="text-lg text-primary italic leading-relaxed">"{report.situationGlobale}"</p>
          ) : (
            <p className="text-lg text-muted-foreground/50 italic">[Non renseigné]</p>
          )}
        </div>
        <div className="flex justify-center gap-12">
          <GaugeArc value={report.meteoEquipe} label="Météo équipe" n1={report.meteoEquipeN1} />
          <GaugeArc value={report.energieManager} label="Énergie manager" n1={report.energieManagerN1} />
        </div>
      </section>

      {/* BLOC 2 — KPI */}
      <section className="mb-8">
        <h2 className="text-base font-semibold text-foreground mb-3">KPI clés</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {sortedKpis.map((kpi, i) => {
            const ecart = ((kpi.value - kpi.target) / kpi.target * 100).toFixed(1);
            return (
              <Tooltip key={i}>
                <TooltipTrigger asChild>
                  <div className="bg-card border border-border rounded-xl p-4 shadow-sm cursor-default">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-muted-foreground">{kpi.label}</span>
                      <div className={`w-2.5 h-2.5 rounded-full ${kpiStatusDot[kpi.status]}`} />
                    </div>
                    <p className="text-xl font-bold text-foreground">{kpi.value.toLocaleString("fr-FR")}<span className="text-sm font-normal text-muted-foreground">{kpi.unit}</span></p>
                    <p className={`text-xs font-medium mt-0.5 ${Number(ecart) >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                      {Number(ecart) >= 0 ? "+" : ""}{ecart}% vs cible
                    </p>
                  </div>
                </TooltipTrigger>
                {kpi.comment && <TooltipContent className="max-w-[250px]">{kpi.comment}</TooltipContent>}
              </Tooltip>
            );
          })}
        </div>
      </section>

      {/* BLOC 3 — Exécution */}
      <section className="mb-8">
        <h2 className="text-base font-semibold text-foreground mb-3">Exécution</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Responsabilités */}
          <div className="bg-card border border-border rounded-xl p-4 shadow-sm text-center">
            <p className="text-2xl font-bold text-foreground">{report.respCompletion}%</p>
            <p className="text-xs text-muted-foreground mt-1">Responsabilités complétées</p>
            <div className="h-1.5 bg-border rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-primary rounded-full" style={{ width: `${report.respCompletion}%` }} />
            </div>
          </div>
          {/* To-do */}
          <div className="bg-card border border-border rounded-xl p-4 shadow-sm text-center">
            <p className="text-2xl font-bold text-foreground">
              {report.todoCompleted}/{report.todoTotal}
            </p>
            <p className="text-xs text-muted-foreground mt-1">To-do réalisés</p>
            {report.todoOverdue > 0 && (
              <p className="text-xs text-destructive font-medium mt-1">{report.todoOverdue} en retard</p>
            )}
          </div>
          {/* Objectifs */}
          <div className="bg-card border border-border rounded-xl p-4 shadow-sm text-center">
            <div className="flex justify-center gap-3 text-xs font-medium">
              {objOnTrack > 0 && <span className="text-emerald-700">{objOnTrack} ✓</span>}
              {objAtRisk > 0 && <span className="text-amber-700">{objAtRisk} ⚠</span>}
              {objBehind > 0 && <span className="text-red-700">{objBehind} ✗</span>}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Objectifs</p>
          </div>
        </div>
      </section>

      {/* BLOC 4 — Problèmes & Décisions */}
      <section className="mb-8">
        <h2 className="text-base font-semibold text-foreground mb-3">
          {isMonthly ? "Problèmes traités en réunion" : "Signaux remontés cette semaine"}
        </h2>
        {isMonthly ? (
          report.ids.length > 0 ? (
            <div className="space-y-3">
              {report.ids.map((ids, i) => (
                <div key={i} className="bg-card border border-border rounded-xl p-4 shadow-sm">
                  <p className="text-sm font-semibold text-foreground mb-1">{ids.problem}</p>
                  <p className="text-sm text-muted-foreground">→ {ids.solution}</p>
                  {ids.conversion && (
                    <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full mt-2 ${ids.conversion === "to-do" ? "bg-primary/10 text-primary" : "bg-violet-100 text-violet-800"}`}>
                      {ids.conversion === "to-do" ? "→ To-do créé" : "→ Objectif créé"}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">[Aucun problème traité en réunion]</p>
          )
        ) : (
          report.weeklySignals.length > 0 ? (
            <ul className="space-y-2">
              {report.weeklySignals.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  {s}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground italic">Aucun signal remonté</p>
          )
        )}
      </section>

      {/* BLOC 5 — Objectifs */}
      {report.objectifs.length > 0 && (
        <section className="mb-8">
          <h2 className="text-base font-semibold text-foreground mb-3">Objectifs en cours</h2>
          <div className="space-y-3">
            {report.objectifs.map((obj, i) => {
              const s = objStyles[obj.status];
              return (
                <div key={i} className={`border rounded-xl p-4 shadow-sm ${obj.status === "behind" ? "bg-red-50 border-red-200" : "bg-card border-border"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-foreground">{obj.title}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}>{s.label}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-border rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${obj.status === "on_track" ? "bg-emerald-500" : obj.status === "at_risk" ? "bg-amber-500" : "bg-red-500"}`}
                        style={{ width: `${obj.progress}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-muted-foreground">{obj.progress}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* BLOC 6 — Synthèse IA */}
      <section className="mb-8">
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-foreground">
              {isMonthly ? "Synthèse IA" : "Résumé"}
            </h2>
            {isMonthly && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                <Sparkles className="h-3 w-3" />
                Validée par {report.manager.split(" ")[0]}
              </span>
            )}
          </div>
          <p className="text-sm text-foreground leading-relaxed mb-4">{report.aiSummary}</p>
          {isMonthly && report.aiActions.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2">
                3 actions prioritaires du prochain cycle
              </h3>
              <ul className="space-y-1.5">
                {report.aiActions.map((a, i) => (
                  <li key={i} className="text-sm text-foreground flex items-start gap-2">
                    <span className="text-primary font-bold">{i + 1}.</span> {a}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      {/* Bottom nav */}
      <div className="flex items-center justify-between pt-4 border-t border-border">
        <Button variant="ghost" className="gap-1.5 text-muted-foreground" onClick={() => navigate(-1)}>
          <ChevronLeft className="h-4 w-4" /> Rapport précédent
        </Button>
        <Button variant="ghost" className="gap-1.5 text-muted-foreground" onClick={() => navigate("/rapports")}>
          Historique complet <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
