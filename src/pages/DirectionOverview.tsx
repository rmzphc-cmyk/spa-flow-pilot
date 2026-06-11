import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Badge } from "@/components/ui/badge";
import { useDirectionDigest, type SpaDigest } from "@/hooks/useDirectionDigest";
import { DirectionSpaDigestCard } from "@/components/direction/DirectionSpaDigestCard";
import type {
  ExceptionCommitment,
  ExceptionProblem,
  ProblemSeverity,
} from "@/lib/weeklyException";

const verdictDot: Record<"red" | "amber" | "green", string> = {
  red: "bg-destructive",
  amber: "bg-amber-500",
  green: "bg-emerald-500",
};

const severityChip: Record<ProblemSeverity, string> = {
  bloquant: "border-destructive/40 bg-destructive/5 text-destructive",
  deleguer: "border-blue-300 bg-blue-50 text-blue-800",
  priorite: "border-amber-400/40 bg-amber-50 text-amber-800",
  veille: "border-muted-foreground/30 bg-muted text-muted-foreground",
  untriaged: "border-muted-foreground/30 bg-muted text-muted-foreground",
};

function severityRank(d: SpaDigest): number {
  if (d.verdict.level === "red") return 0;
  if (d.verdict.level === "amber") return 1;
  return 2;
}

function formatRange(start: Date, end: Date, locale: string): string {
  const sameMonth = start.getMonth() === end.getMonth();
  const startDay = start.getDate();
  const endDay = end.getDate();
  const month = new Intl.DateTimeFormat(locale, { month: "short" }).format(end);
  if (sameMonth) return `${startDay}–${endDay} ${month}`;
  const startMonth = new Intl.DateTimeFormat(locale, { month: "short" }).format(start);
  return `${startDay} ${startMonth} – ${endDay} ${month}`;
}

function PortfolioBanner({ spas }: { spas: SpaDigest[] }) {
  const { t } = useTranslation();
  if (spas.length === 0) return null;

  const reds = spas.filter((s) => s.verdict.level === "red").length;
  const ambers = spas.filter((s) => s.verdict.level === "amber").length;
  const attention = reds + ambers;
  const totalBlocking = spas.reduce((s, x) => s + x.verdict.blocking, 0);
  const totalOverdue = spas.reduce((s, x) => s + x.verdict.overdue, 0);
  const notDiffused = spas.filter((s) => s.diffusionStatus !== "diffuse").length;

  const overallLevel: "red" | "amber" | "green" =
    reds > 0 ? "red" : ambers > 0 ? "amber" : "green";

  const tone =
    overallLevel === "red"
      ? "border-destructive/30 bg-destructive/5 text-destructive"
      : overallLevel === "amber"
        ? "border-amber-400/40 bg-amber-50 text-amber-800"
        : "border-emerald-300 bg-emerald-50 text-emerald-800";

  const segments: string[] = [];
  if (attention > 0)
    segments.push(t("direction.digest.banner.attention", { count: attention }));
  else segments.push(t("direction.digest.banner.allOk"));
  if (totalBlocking > 0)
    segments.push(t("direction.digest.banner.blocking", { count: totalBlocking }));
  if (totalOverdue > 0)
    segments.push(t("direction.digest.banner.overdue", { count: totalOverdue }));
  if (notDiffused > 0)
    segments.push(t("direction.digest.banner.notDiffused", { count: notDiffused }));

  return (
    <div className={`rounded-xl border p-4 mb-6 flex items-center gap-3 ${tone}`}>
      <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${verdictDot[overallLevel]}`} />
      <span className="text-sm font-medium">{segments.join(" · ")}</span>
    </div>
  );
}

function BySeverityFeed({ spas }: { spas: SpaDigest[] }) {
  const { t } = useTranslation();

  const allProblems = useMemo(() => {
    const order: ProblemSeverity[] = [
      "bloquant",
      "deleguer",
      "priorite",
      "veille",
      "untriaged",
    ];
    const list: Array<{ spa: string; problem: ExceptionProblem }> = [];
    for (const s of spas) {
      for (const p of s.problems) list.push({ spa: s.spaName, problem: p });
    }
    list.sort(
      (a, b) =>
        order.indexOf(a.problem.severity) - order.indexOf(b.problem.severity),
    );
    return list;
  }, [spas]);

  const allOverdue = useMemo(() => {
    const list: Array<{ spa: string; commitment: ExceptionCommitment }> = [];
    for (const s of spas) {
      for (const c of s.commitmentsOverdue) list.push({ spa: s.spaName, commitment: c });
    }
    list.sort((a, b) => b.commitment.lateDays - a.commitment.lateDays);
    return list;
  }, [spas]);

  if (allProblems.length === 0 && allOverdue.length === 0) {
    return (
      <Card className="p-6 text-center text-sm text-muted-foreground">
        {t("direction.digest.allGreen")}
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {allProblems.length > 0 && (
        <Card className="p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            {t("direction.digest.sections.problems")}
          </h3>
          <div className="space-y-2">
            {allProblems.map((entry, i) => (
              <div key={i} className="flex flex-wrap items-start gap-2 text-sm">
                <Badge
                  variant="outline"
                  className={`shrink-0 text-xs ${severityChip[entry.problem.severity]}`}
                >
                  {t(`direction.digest.severity.${entry.problem.severity}`)}
                </Badge>
                <span className="text-foreground flex-1 min-w-0">
                  {entry.problem.text || "—"}
                </span>
                <span className="text-xs text-muted-foreground shrink-0">{entry.spa}</span>
                {entry.problem.action && (
                  <span className="text-xs text-muted-foreground shrink-0">
                    → {entry.problem.action}
                  </span>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {allOverdue.length > 0 && (
        <Card className="p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-destructive mb-3">
            {t("direction.digest.sections.overdue")}
          </h3>
          <div className="space-y-2">
            {allOverdue.map((entry, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
                <Badge
                  variant="outline"
                  className="text-xs border-muted-foreground/30 bg-muted text-muted-foreground shrink-0"
                >
                  {entry.commitment.kind === "todo"
                    ? t("direction.digest.kind.todo")
                    : t("direction.digest.kind.objective")}
                </Badge>
                <span className="text-foreground flex-1 min-w-0 truncate">
                  {entry.commitment.title}
                </span>
                <span className="text-xs text-muted-foreground shrink-0">{entry.spa}</span>
                {entry.commitment.responsible && entry.commitment.responsible !== "—" && (
                  <span className="text-xs text-muted-foreground shrink-0">
                    {entry.commitment.responsible}
                  </span>
                )}
                <Badge
                  variant="outline"
                  className="text-xs border-destructive/40 bg-destructive/5 text-destructive shrink-0"
                >
                  {t("direction.digest.lateDays", { count: entry.commitment.lateDays })}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

export default function DirectionOverview() {
  const { t, i18n } = useTranslation();
  const [weekOffset, setWeekOffset] = useState(0);
  const [view, setView] = useState<"spa" | "severity">("spa");

  const { data: digests = [], isLoading, weekWindow } = useDirectionDigest(weekOffset);

  const sorted = useMemo(
    () => [...digests].sort((a, b) => severityRank(a) - severityRank(b)),
    [digests],
  );

  const diffusedCount = digests.filter((d) => d.diffusionStatus === "diffuse").length;
  const rangeLabel = formatRange(weekWindow.start, weekWindow.end, i18n.language);

  return (
    <div className="max-w-[960px] mx-auto px-6 py-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {t("direction.digest.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {digests.length > 0
              ? t("direction.digest.subtitle", {
                  count: digests.length,
                  diffused: diffusedCount,
                })
              : t("direction.digest.subtitleEmpty")}
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-border bg-card px-2 py-1 shadow-sm">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setWeekOffset((o) => o - 1)}
            aria-label={t("direction.digest.previousWeek")}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium px-1">
            {t("direction.digest.weekLabel", {
              week: weekWindow.weekNumber,
              range: rangeLabel,
            })}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setWeekOffset((o) => o + 1)}
            disabled={weekOffset >= 0}
            aria-label={t("direction.digest.nextWeek")}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : digests.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm text-muted-foreground">
            {t("direction.digest.emptyNoSpas")}
          </p>
        </Card>
      ) : (
        <>
          <PortfolioBanner spas={digests} />

          <div className="flex justify-end mb-4">
            <ToggleGroup
              type="single"
              value={view}
              onValueChange={(v) => v && setView(v as "spa" | "severity")}
              variant="outline"
              size="sm"
            >
              <ToggleGroupItem value="spa">
                {t("direction.digest.view.bySpa")}
              </ToggleGroupItem>
              <ToggleGroupItem value="severity">
                {t("direction.digest.view.bySeverity")}
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {view === "spa" ? (
            <div className="space-y-4">
              {sorted.map((d) => (
                <DirectionSpaDigestCard key={d.spaId} digest={d} />
              ))}
            </div>
          ) : (
            <BySeverityFeed spas={sorted} />
          )}
        </>
      )}
    </div>
  );
}
