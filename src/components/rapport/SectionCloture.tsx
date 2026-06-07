import { useMemo } from "react";
import { useTranslation } from "react-i18next";
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

const engagements = [
  { qui: "Sophie M.", quoi: "Lancer formation Maria — protocole cabine humidité", quand: "5 avril" },
  { qui: "Marie D.", quoi: "Négocier nouveau contrat Phytomer (clause délais)", quand: "10 avril" },
  { qui: "Marie D.", quoi: "Présenter plan rebooking +30j à l'équipe", quand: "Prochaine réunion" },
  { qui: "Sophie M.", quoi: "Finaliser planning cabines semaines 14-17", quand: "3 avril" },
];

interface TodoLike { id: string; title: string; status: string }

function buildSummary(reportId: string, reportType: "monthly" | "weekly", t: (k: string) => string): string {
  const ids = (getReportSection(reportId, "ids") as string[] | null) ?? [];
  const todos = (getReportSection(reportId, "todo") as TodoLike[] | null) ?? [];
  const kpiVals = (getReportSection(reportId, "kpi") as Record<string, KpiCardValue> | null) ?? {};

  const doneTodos = todos.filter((td) => td.status === "done");

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
    ? t("report.cloture.generated.weekly")
    : t("report.cloture.generated.monthly");
  lines.push(intro);

  if (topKpis.length) {
    lines.push(
      "\n• " + t("report.cloture.generated.kpiLabel") + " " +
        topKpis
          .map((k) => `${k.label} ${k.above ? t("report.cloture.generated.above") : t("report.cloture.generated.below")} de l'objectif (${k.pct >= 0 ? "+" : ""}${k.pct.toFixed(0)}%)`)
          .join(" ; ") +
        ".",
    );
  }

  if (doneTodos.length) {
    lines.push(
      `\n• ${t("report.cloture.generated.actionsLabel")} (${doneTodos.length}) : ` +
        doneTodos.slice(0, 4).map((td) => td.title).join(" · ") +
        (doneTodos.length > 4 ? "…" : "") +
        ".",
    );
  }

  if (ids.length) {
    lines.push(
      `\n• ${t("report.cloture.generated.idsLabel")} (${ids.length}) : ` +
        ids.slice(0, 4).join(" · ") +
        (ids.length > 4 ? "…" : "") +
        ".",
    );
  }

  if (lines.length === 1) {
    lines.push("\n" + t("report.cloture.generated.noData"));
  }

  return lines.join("");
}

export function SectionCloture({ reportId, reportType }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const generated = useMemo(() => buildSummary(reportId, reportType, t), [reportId, reportType, t]);

  const [state, setState] = usePersistedSection<ClotureState>(reportId, "cloture", {
    summary: generated,
    nextMeeting: "2026-04-15",
    nextMeetingTime: "10:00",
    summaryEdited: false,
  });
  const { summary, nextMeeting, nextMeetingTime, summaryEdited } = state;

  const displayedSummary = summaryEdited ? summary : generated;

  const setSummary = (v: string) => setState((p) => ({ ...p, summary: v, summaryEdited: true }));
  const setNextMeeting = (v: string) => setState((p) => ({ ...p, nextMeeting: v }));
  const setNextMeetingTime = (v: string) => setState((p) => ({ ...p, nextMeetingTime: v }));

  const handleValidate = () => {
    setState((p) => ({ ...p, summary: displayedSummary, summaryEdited: true }));
    updateReportStatus(reportId, "validated");
    toast.success(t("report.cloture.toast.validated"));
    setTimeout(() => navigate("/rapports"), 300);
  };

  if (reportType === "monthly") {
    return (
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-foreground">{t("report.cloture.title.monthly")}</h2>
        <p className="text-sm text-muted-foreground mb-4">{t("report.cloture.subtitle.monthly")}</p>

        <div className="bg-card border border-border rounded-xl p-5 shadow-sm mb-4">
          <div className="flex items-center justify-between mb-3">
            <label className="font-medium text-foreground text-sm">{t("report.cloture.summary.monthly")}</label>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
              <Sparkles className="h-3 w-3" />
              {t("report.cloture.aiSuggestion")}
            </span>
          </div>
          <Textarea
            className="text-sm min-h-[140px]"
            value={displayedSummary}
            onChange={(e) => setSummary(e.target.value)}
          />
          <div className="text-xs text-muted-foreground text-right mt-1">
            {displayedSummary.split(/\s+/).filter(Boolean).length} {t("report.cloture.words")}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5 shadow-sm mb-4">
          <div className="flex items-center gap-2 mb-3">
            <ListChecks className="h-4 w-4 text-primary" />
            <label className="font-medium text-foreground text-sm">{t("report.cloture.engagements.title")}</label>
          </div>
          <p className="text-xs text-muted-foreground mb-3 italic">
            {t("report.cloture.engagements.subtitle")}
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
            <label className="font-medium text-foreground text-sm">{t("report.cloture.nextMeeting")}</label>
          </div>
          <div className="flex gap-3">
            <Input type="date" value={nextMeeting} onChange={(e) => setNextMeeting(e.target.value)} className="text-sm max-w-xs" />
            <Input type="time" value={nextMeetingTime} onChange={(e) => setNextMeetingTime(e.target.value)} className="text-sm max-w-[120px]" />
          </div>
        </div>

        <Button onClick={handleValidate} className="gap-1.5">
          <Send className="h-4 w-4" />
          {t("report.cloture.validate")}
        </Button>
      </section>
    );
  }

  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold text-foreground">{t("report.cloture.title.weekly")}</h2>
      <p className="text-sm text-muted-foreground mb-4">{t("report.cloture.subtitle.weekly")}</p>

      <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <label className="font-medium text-foreground text-sm">{t("report.cloture.summary.weekly")}</label>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
            <Sparkles className="h-3 w-3" />
            {t("report.cloture.aiSuggestion")}
          </span>
        </div>
        <Textarea
          className="text-sm min-h-[140px]"
          value={displayedSummary}
          onChange={(e) => setSummary(e.target.value)}
        />
        <div className="text-xs text-muted-foreground text-right mt-1">
          {displayedSummary.split(/\s+/).filter(Boolean).length} {t("report.cloture.words")}
        </div>

        <Button onClick={handleValidate} className="mt-4 gap-1.5">
          <Send className="h-4 w-4" />
          {t("report.cloture.validate")}
        </Button>
      </div>
    </section>
  );
}
