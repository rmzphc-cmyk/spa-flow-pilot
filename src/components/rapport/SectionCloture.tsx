import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sparkles, Send, Calendar, ListChecks, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { usePersistedSection } from "@/lib/usePersistedSection";
import { getReportSection, updateReportStatus } from "@/lib/reportsStore";
import { baseKpis } from "./SectionKpi";
import type { KpiCardValue } from "@/components/KpiCard";

interface Props {
  reportId: string;
  reportType: "monthly" | "weekly";
}

interface ClotureState {
  summary: string;
  nextMeeting: string;
  nextMeetingTime: string;
  summaryEdited: boolean;
}

// Engagements consolidés (statique pour l'instant)
const engagements = [
  { qui: "Sophie M.", quoi: "Lancer formation Maria — protocole cabine humidité", quand: "5 avril" },
  { qui: "Marie D.", quoi: "Négocier nouveau contrat Phytomer (clause délais)", quand: "10 avril" },
  { qui: "Marie D.", quoi: "Présenter plan rebooking +30j à l'équipe", quand: "Prochaine réunion" },
  { qui: "Sophie M.", quoi: "Finaliser planning cabines semaines 14-17", quand: "3 avril" },
];

interface TodoLike { id: string; title: string; status: string }

function buildSummary(reportId: string, reportType: "monthly" | "weekly"): string {
  const ids = (getReportSection(reportId, "ids") as string[] | null) ?? [];
  const todos = (getReportSection(reportId, "todo") as TodoLike[] | null) ?? [];
  const kpiVals = (getReportSection(reportId, "kpi") as Record<string, KpiCardValue> | null) ?? {};

  const doneTodos = todos.filter((t) => t.status === "done");

  // KPI deltas
  type Delta = { label: string; pct: number; above: boolean };
  const deltas: Delta[] = [];
  for (const kpi of baseKpis) {
    const cv = kpiVals[kpi.id];
    if (!cv || cv.isNa || !cv.value) continue;
    const v = Number(cv.value);
    if (isNaN(v) || !kpi.target) continue;
    const pct = ((v - kpi.target) / kpi.target) * 100;
    deltas.push({ label: kpi.label, pct, above: v >= kpi.target });
  }
  deltas.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));
  const topKpis = deltas.slice(0, 2);

  const lines: string[] = [];
  const intro = reportType === "weekly"
    ? "Cette semaine :"
    : "Ce mois-ci :";
  lines.push(intro);

  if (topKpis.length) {
    lines.push(
      "\n• KPI clés : " +
        topKpis
          .map((k) => `${k.label} ${k.above ? "au-dessus" : "en-dessous"} de l'objectif (${k.pct >= 0 ? "+" : ""}${k.pct.toFixed(0)}%)`)
          .join(" ; ") +
        ".",
    );
  }

  if (doneTodos.length) {
    lines.push(
      `\n• Actions terminées (${doneTodos.length}) : ` +
        doneTodos.slice(0, 4).map((t) => t.title).join(" · ") +
        (doneTodos.length > 4 ? "…" : "") +
        ".",
    );
  }

  if (ids.length) {
    lines.push(
      `\n• Problèmes IDS traités (${ids.length}) : ` +
        ids.slice(0, 4).join(" · ") +
        (ids.length > 4 ? "…" : "") +
        ".",
    );
  }

  if (lines.length === 1) {
    lines.push("\nAucune donnée saisie pour générer une synthèse automatique. Rédigez votre résumé ci-dessous.");
  }

  return lines.join("");
}

export function SectionCloture({ reportId, reportType }: Props) {
  const navigate = useNavigate();
  const generated = useMemo(() => buildSummary(reportId, reportType), [reportId, reportType]);

  const [state, setState] = usePersistedSection<ClotureState>(reportId, "cloture", {
    summary: generated,
    nextMeeting: "2026-04-15",
    nextMeetingTime: "10:00",
    summaryEdited: false,
  });
  const { summary, nextMeeting, nextMeetingTime, summaryEdited } = state;

  // Show generated when user hasn't edited yet
  const displayedSummary = summaryEdited ? summary : generated;

  const setSummary = (v: string) => setState((p) => ({ ...p, summary: v, summaryEdited: true }));
  const setNextMeeting = (v: string) => setState((p) => ({ ...p, nextMeeting: v }));
  const setNextMeetingTime = (v: string) => setState((p) => ({ ...p, nextMeetingTime: v }));

  const handleValidate = () => {
    // Persist final summary
    setState((p) => ({ ...p, summary: displayedSummary, summaryEdited: true }));
    updateReportStatus(reportId, "validated");
    toast.success("Rapport validé — visible par la Direction");
    setTimeout(() => navigate("/rapports"), 300);
  };

  if (reportType === "monthly") {
    return (
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-foreground">Clôture & engagements</h2>
        <p className="text-sm text-muted-foreground mb-4">Synthèse, engagements pris en réunion et prochaine échéance</p>

        <div className="bg-card border border-border rounded-xl p-5 shadow-sm mb-4">
          <div className="flex items-center justify-between mb-3">
            <label className="font-medium text-foreground text-sm">Synthèse du mois</label>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
              <Sparkles className="h-3 w-3" />
              Suggestion IA
            </span>
          </div>
          <Textarea
            className="text-sm min-h-[140px]"
            value={displayedSummary}
            onChange={(e) => setSummary(e.target.value)}
          />
          <div className="text-xs text-muted-foreground text-right mt-1">
            {displayedSummary.split(/\s+/).filter(Boolean).length} mots
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5 shadow-sm mb-4">
          <div className="flex items-center gap-2 mb-3">
            <ListChecks className="h-4 w-4 text-primary" />
            <label className="font-medium text-foreground text-sm">Engagements pris — qui fait quoi pour quand</label>
          </div>
          <p className="text-xs text-muted-foreground mb-3 italic">
            Consolidé depuis les sections IDS, Objectifs et To-do de ce cycle.
          </p>
          <div className="space-y-2">
            {engagements.map((e, i) => (
              <div key={i} className="flex items-start gap-3 text-sm py-2 border-b border-border/50 last:border-0">
                <span className="font-medium text-foreground w-24 shrink-0">{e.qui}</span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground mt-1 shrink-0" />
                <span className="flex-1 text-foreground">{e.quoi}</span>
                <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded shrink-0">{e.quand}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5 shadow-sm mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="h-4 w-4 text-primary" />
            <label className="font-medium text-foreground text-sm">Prochaine réunion mensuelle</label>
          </div>
          <div className="flex gap-3">
            <Input type="date" value={nextMeeting} onChange={(e) => setNextMeeting(e.target.value)} className="text-sm max-w-xs" />
            <Input type="time" value={nextMeetingTime} onChange={(e) => setNextMeetingTime(e.target.value)} className="text-sm max-w-[120px]" />
          </div>
        </div>

        <Button onClick={handleValidate} className="gap-1.5">
          <Send className="h-4 w-4" />
          Valider et envoyer à la Direction
        </Button>
      </section>
    );
  }

  // Weekly
  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold text-foreground">Clôture — Résumé de la semaine</h2>
      <p className="text-sm text-muted-foreground mb-4">Résumé pré-rempli à partir de vos saisies, modifiable</p>

      <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <label className="font-medium text-foreground text-sm">Résumé hebdomadaire</label>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
            <Sparkles className="h-3 w-3" />
            Suggestion IA
          </span>
        </div>
        <Textarea
          className="text-sm min-h-[140px]"
          value={displayedSummary}
          onChange={(e) => setSummary(e.target.value)}
        />
        <div className="text-xs text-muted-foreground text-right mt-1">
          {displayedSummary.split(/\s+/).filter(Boolean).length} mots
        </div>

        <Button onClick={handleValidate} className="mt-4 gap-1.5">
          <Send className="h-4 w-4" />
          Valider et envoyer à la Direction
        </Button>
      </div>
    </section>
  );
}
