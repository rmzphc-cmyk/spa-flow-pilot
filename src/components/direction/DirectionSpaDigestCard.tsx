import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  FileText,
  Sparkles,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { AiBadge } from "@/components/AiBadge";
import type { SpaDigest } from "@/hooks/useDirectionDigest";
import {
  CommitmentLine,
  DiffusionPill,
  ProblemLine,
  verdictDot,
  verdictRing,
} from "./digestParts";

export interface DirectionSpaDigestCardProps {
  digest: SpaDigest;
  /** Forcer l'état d'ouverture (override par défaut). */
  defaultOpen?: boolean;
  /** Décalage de semaine à propager dans l'URL du détail. */
  weekOffset?: number;
}

export function DirectionSpaDigestCard({
  digest,
  defaultOpen,
  weekOffset,
}: DirectionSpaDigestCardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isGreen = digest.verdict.level === "green";
  const isNone = digest.diffusionStatus === "aucun";
  const initialOpen =
    defaultOpen ??
    (!isNone && (digest.verdict.level === "red" || digest.verdict.level === "amber"));
  const [open, setOpen] = useState(initialOpen);

  const detailHref = (() => {
    const offset = weekOffset ?? Number(searchParams.get("week") ?? 0);
    const qs = offset ? `?week=${offset}` : "";
    return `/direction/spa/${digest.spaId}${qs}`;
  })();

  const summary = digest.counters;
  const summaryParts: string[] = [];
  if (summary.bloquants > 0)
    summaryParts.push(t("direction.digest.counters.blocking", { count: summary.bloquants }));
  if (summary.autresProblemes > 0)
    summaryParts.push(
      t("direction.digest.counters.other", { count: summary.autresProblemes }),
    );
  if (summary.enRetard > 0)
    summaryParts.push(t("direction.digest.counters.overdue", { count: summary.enRetard }));
  if (summary.aRisque > 0)
    summaryParts.push(t("direction.digest.counters.atRisk", { count: summary.aRisque }));

  return (
    <Card className={`border-l-4 ${verdictRing[digest.verdict.level]} shadow-sm`}>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="w-full text-left p-4 flex items-center gap-3 hover:bg-muted/30 transition-colors"
          >
            <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${verdictDot[digest.verdict.level]}`} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <h3 className="text-base font-semibold text-foreground truncate">
                  {digest.spaName}
                </h3>
                <span className="text-xs text-muted-foreground">
                  {digest.managerName}
                </span>
                <DiffusionPill status={digest.diffusionStatus} />
              </div>
              {(digest.kpis.ca !== "—" || digest.kpis.satisfaction !== "—") && (
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  {digest.kpis.ca !== "—" && (
                    <span>
                      {t("direction.kpiCA")}{" "}
                      <span className="font-medium text-foreground">{digest.kpis.ca}</span>
                    </span>
                  )}
                  {digest.kpis.satisfaction !== "—" && (
                    <span>
                      {t("direction.kpiSatisfaction")}{" "}
                      <span className="font-medium text-foreground">
                        {digest.kpis.satisfaction}
                      </span>
                    </span>
                  )}
                </div>
              )}
            </div>
            {open ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-4 border-t border-border">
            {summaryParts.length > 0 && (
              <p className="text-xs text-muted-foreground mt-3">
                {summaryParts.join(" · ")}
              </p>
            )}

            {isNone && (
              <p className="text-sm text-muted-foreground italic">
                {t("direction.digest.noWeeklyReport")}
              </p>
            )}

            {!isNone && isGreen && digest.problems.length === 0 && digest.commitmentsOverdue.length === 0 && digest.commitmentsAtRisk.length === 0 && (
              <p className="text-sm text-emerald-700">
                {t("direction.digest.allGreen")}
              </p>
            )}

            {digest.problems.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("direction.digest.sections.problems")}
                </h4>
                <div className="space-y-1.5">
                  {digest.problems.map((p, i) => (
                    <ProblemLine key={i} problem={p} />
                  ))}
                </div>
              </div>
            )}

            {digest.commitmentsOverdue.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-destructive">
                  {t("direction.digest.sections.overdue")}
                </h4>
                <div className="space-y-1.5">
                  {digest.commitmentsOverdue.map((c, i) => (
                    <CommitmentLine key={`o-${i}`} commitment={c} late />
                  ))}
                </div>
              </div>
            )}

            {digest.commitmentsAtRisk.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                  {t("direction.digest.sections.atRisk")}
                </h4>
                <div className="space-y-1.5">
                  {digest.commitmentsAtRisk.map((c, i) => (
                    <CommitmentLine key={`r-${i}`} commitment={c} late={false} />
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              {digest.executiveSummary && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <Sparkles className="h-3.5 w-3.5" />
                      {t("direction.digest.actions.aiSummary")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-96 relative">
                    <AiBadge />
                    <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed pr-16">
                      {digest.executiveSummary}
                    </p>
                  </PopoverContent>
                </Popover>
              )}
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => navigate(detailHref)}
                title={t("direction.digest.actions.pdfHint") ?? undefined}
              >
                <FileText className="h-3.5 w-3.5" />
                {t("direction.digest.actions.pdf")}
              </Button>
              <Button
                variant="default"
                size="sm"
                className="gap-1.5 ml-auto"
                onClick={() => navigate(detailHref)}
              >
                {t("direction.digest.actions.detail")}
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
