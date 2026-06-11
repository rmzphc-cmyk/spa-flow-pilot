import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  Hourglass,
  Sparkles,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import type {
  ExceptionCommitment,
  ExceptionProblem,
  ProblemSeverity,
} from "@/lib/weeklyException";
import type { DiffusionStatus, SpaDigest } from "@/hooks/useDirectionDigest";

const verdictRing: Record<"red" | "amber" | "green", string> = {
  red: "border-l-destructive",
  amber: "border-l-amber-500",
  green: "border-l-emerald-500",
};

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

function DiffusionPill({ status }: { status: DiffusionStatus }) {
  const { t } = useTranslation();
  if (status === "diffuse") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        {t("direction.digest.diffusion.diffuse")}
      </span>
    );
  }
  if (status === "en_cours") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
        <Hourglass className="h-3 w-3" />
        {t("direction.digest.diffusion.inProgress")}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
      <Clock className="h-3 w-3" />
      {t("direction.digest.diffusion.none")}
    </span>
  );
}

function ProblemLine({ problem }: { problem: ExceptionProblem }) {
  const { t } = useTranslation();
  const label = t(`direction.digest.severity.${problem.severity}`);
  return (
    <div className="flex flex-wrap items-start gap-2 text-sm">
      <Badge variant="outline" className={`shrink-0 text-xs ${severityChip[problem.severity]}`}>
        {label}
      </Badge>
      <span className="text-foreground flex-1 min-w-0">{problem.text || "—"}</span>
      {problem.action && (
        <span className="text-xs text-muted-foreground shrink-0">
          → {problem.action}
        </span>
      )}
    </div>
  );
}

function CommitmentLine({
  commitment,
  late,
}: {
  commitment: ExceptionCommitment;
  late: boolean;
}) {
  const { t } = useTranslation();
  const kindLabel =
    commitment.kind === "todo"
      ? t("direction.digest.kind.todo")
      : t("direction.digest.kind.objective");
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <Badge variant="outline" className="text-xs border-muted-foreground/30 bg-muted text-muted-foreground shrink-0">
        {kindLabel}
      </Badge>
      <span className="text-foreground flex-1 min-w-0 truncate">{commitment.title}</span>
      {commitment.responsible && commitment.responsible !== "—" && (
        <span className="text-xs text-muted-foreground shrink-0">{commitment.responsible}</span>
      )}
      <span className="text-xs text-muted-foreground shrink-0">{commitment.dueLabel}</span>
      {late ? (
        <Badge variant="outline" className="text-xs border-destructive/40 bg-destructive/5 text-destructive shrink-0">
          {t("direction.digest.lateDays", { count: commitment.lateDays })}
        </Badge>
      ) : (
        <Badge variant="outline" className="text-xs border-amber-400/40 bg-amber-50 text-amber-800 shrink-0">
          {t("direction.digest.atRiskBadge")}
        </Badge>
      )}
      {commitment.deferredCount > 0 && (
        <Badge variant="outline" className="text-xs border-muted-foreground/30 bg-muted text-muted-foreground shrink-0">
          {t("direction.digest.deferredBadge", { count: commitment.deferredCount })}
        </Badge>
      )}
      {commitment.detail && (
        <span className="text-xs text-muted-foreground shrink-0">{commitment.detail}</span>
      )}
    </div>
  );
}

export interface DirectionSpaDigestCardProps {
  digest: SpaDigest;
  /** Forcer l'état d'ouverture (override par défaut). */
  defaultOpen?: boolean;
}

export function DirectionSpaDigestCard({
  digest,
  defaultOpen,
}: DirectionSpaDigestCardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isGreen = digest.verdict.level === "green";
  const isNone = digest.diffusionStatus === "aucun";
  const initialOpen =
    defaultOpen ??
    (!isNone && (digest.verdict.level === "red" || digest.verdict.level === "amber"));
  const [open, setOpen] = useState(initialOpen);

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
                onClick={() => navigate(`/direction/spa/${digest.spaId}`)}
                title={t("direction.digest.actions.pdfHint") ?? undefined}
              >
                <FileText className="h-3.5 w-3.5" />
                {t("direction.digest.actions.pdf")}
              </Button>
              <Button
                variant="default"
                size="sm"
                className="gap-1.5 ml-auto"
                onClick={() => navigate(`/direction/spa/${digest.spaId}`)}
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
