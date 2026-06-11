import { useTranslation } from "react-i18next";
import { Clock, Hourglass } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type {
  ExceptionCommitment,
  ExceptionProblem,
  ProblemSeverity,
} from "@/lib/weeklyException";
import type { DiffusionStatus } from "@/hooks/useDirectionDigest";

export const verdictRing: Record<"red" | "amber" | "green", string> = {
  red: "border-l-destructive",
  amber: "border-l-amber-500",
  green: "border-l-emerald-500",
};

export const verdictDot: Record<"red" | "amber" | "green", string> = {
  red: "bg-destructive",
  amber: "bg-amber-500",
  green: "bg-emerald-500",
};

export const verdictTone: Record<"red" | "amber" | "green", string> = {
  red: "border-destructive/30 bg-destructive/5 text-destructive",
  amber: "border-amber-400/40 bg-amber-50 text-amber-800",
  green: "border-emerald-300 bg-emerald-50 text-emerald-800",
};

export const severityChip: Record<ProblemSeverity, string> = {
  bloquant: "border-destructive/40 bg-destructive/5 text-destructive",
  deleguer: "border-blue-300 bg-blue-50 text-blue-800",
  priorite: "border-amber-400/40 bg-amber-50 text-amber-800",
  veille: "border-muted-foreground/30 bg-muted text-muted-foreground",
  untriaged: "border-muted-foreground/30 bg-muted text-muted-foreground",
};

export function DiffusionPill({ status }: { status: DiffusionStatus }) {
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

export function ProblemLine({ problem }: { problem: ExceptionProblem }) {
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

export function CommitmentLine({
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
