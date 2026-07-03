import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import {
  useObjectives,
  useCloseObjective,
  parseObjectiveDescription,
  MAX_ACTIVE_OBJECTIVES,
  type CloseObjectiveStatus,
  type DbObjective,
} from "@/hooks/useObjectives";
import { computeObjectiveProgress } from "@/lib/objectiveProgress";
import { useReports } from "@/hooks/useReports";
import { Loader2, Target, Info, Calendar, FileText, Plus, Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { toast } from "@/hooks/use-toast";
import { friendlyError } from "@/lib/errorMessages";
import { ObjectiveCreateDialog } from "@/components/rapport/ObjectiveCreateDialog";

type StatusUI = "on_track" | "at_risk" | "behind";

const statusConfig: Record<
  StatusUI,
  { labelKey: string; badgeClass: string; barClass: string }
> = {
  on_track: {
    labelKey: "objectifs.statusOnTrack",
    badgeClass: "bg-success text-success-foreground hover:bg-success",
    barClass: "bg-success",
  },
  at_risk: {
    labelKey: "objectifs.statusAtRisk",
    badgeClass: "bg-warning text-warning-foreground hover:bg-warning",
    barClass: "bg-warning",
  },
  behind: {
    labelKey: "objectifs.statusBehind",
    badgeClass: "bg-destructive text-destructive-foreground hover:bg-destructive",
    barClass: "bg-destructive",
  },
};

const DATE_LOCALES: Record<string, string> = {
  fr: "fr-FR",
  en: "en-GB",
  es: "es-ES",
};

function formatDueDate(dateStr: string | null, lang: string): string | null {
  if (!dateStr) return null;
  try {
    // Parse LOCAL des composants yyyy-mm-dd : new Date("yyyy-mm-dd") serait
    // interprété en UTC et décalerait d'un jour sur les fuseaux négatifs.
    const [y, m, d] = dateStr.split("-").map(Number);
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
    const locale = DATE_LOCALES[lang.split("-")[0]] ?? "fr-FR";
    return new Date(y, m - 1, d).toLocaleDateString(locale, {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return null;
  }
}

function ObjectiveCard({
  objective,
  reportLabel,
}: {
  objective: DbObjective;
  reportLabel: string | null;
}) {
  const { t, i18n } = useTranslation();
  const parsed = parseObjectiveDescription(objective.description);
  const progress = computeObjectiveProgress(parsed.current, parsed.target, parsed.start);
  const config = statusConfig[parsed.status_ui] ?? statusConfig.on_track;
  const dueDate = formatDueDate(objective.target_date, i18n.language);
  const isProject = objective.kind === "steps";

  const closeObjective = useCloseObjective();
  // Clôture demandée en attente de confirmation (null = dialog fermé).
  const [confirmStatus, setConfirmStatus] = useState<CloseObjectiveStatus | null>(null);

  const confirmClose = () => {
    if (!confirmStatus) return;
    closeObjective.mutate(
      { objectiveId: objective.id, spaId: objective.spa_id, status: confirmStatus },
      {
        onError: (e) => {
          toast({
            title: t("report.ids.toastError"),
            description: friendlyError(e),
            variant: "destructive",
          });
        },
      },
    );
  };

  return (
    <div className="bg-card rounded-card shadow-sm p-6 border border-border">
      <div className="flex items-start justify-between gap-4 mb-4">
        <h3 className="font-semibold text-foreground text-lg leading-tight">
          {objective.title}
        </h3>
        <div className="flex items-center gap-2 shrink-0">
          {isProject && (
            <Badge variant="outline">{t("objectifs.form.typeSteps")}</Badge>
          )}
          <Badge className={config.badgeClass}>{t(config.labelKey)}</Badge>
        </div>
      </div>

      <div className="space-y-4">
        {/* Progress bar */}
        <div>
          <div className="flex justify-between text-sm mb-1.5">
            <span className="text-muted-foreground">
              {parsed.current}
              {parsed.unit} / {parsed.target}
              {parsed.unit}
            </span>
            <span className="font-medium text-foreground">{progress}%</span>
          </div>
          <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full ${config.barClass} rounded-full transition-all duration-500`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Due date */}
        {dueDate && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="w-4 h-4 shrink-0" />
            <span>{t("objectifs.dueDate", { date: dueDate })}</span>
          </div>
        )}

        {/* Source report */}
        {reportLabel && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileText className="w-4 h-4 shrink-0" />
            <span>{t("objectifs.createdDuring", { label: reportLabel })}</span>
          </div>
        )}

        {/* Clôture — libère un slot de la limite de 3 actifs */}
        <div className="flex gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={closeObjective.isPending}
            onClick={() => setConfirmStatus("achieved")}
          >
            <Check className="w-3.5 h-3.5" />
            {t("objectifs.close.achieveBtn")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-muted-foreground"
            disabled={closeObjective.isPending}
            onClick={() => setConfirmStatus("abandoned")}
          >
            <X className="w-3.5 h-3.5" />
            {t("objectifs.close.abandonBtn")}
          </Button>
        </div>
      </div>

      <AlertDialog
        open={confirmStatus !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmStatus(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmStatus === "abandoned"
                ? t("objectifs.close.confirmAbandonTitle")
                : t("objectifs.close.confirmAchieveTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("objectifs.close.confirmDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("report.ids.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmClose}>
              {t("report.ids.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function Objectifs() {
  const { t } = useTranslation();
  const { spaId } = useAuth();
  const { data: objectives, isLoading } = useObjectives(spaId);
  const { data: reports } = useReports();
  const [createOpen, setCreateOpen] = useState(false);

  const reportLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    reports?.forEach((r) => map.set(r.id, r.cycle_label));
    return map;
  }, [reports]);

  const activeCount = objectives?.length ?? 0;
  const atLimit = activeCount >= MAX_ACTIVE_OBJECTIVES;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const isEmpty = !objectives || objectives.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground">{t("sections.objectifs")}</h1>
          <Badge variant="outline">{t("objectifs.activeCount", { count: activeCount })}</Badge>
        </div>
        {/* Création directe — secondaire (décision A) : la voie primaire reste
            la conversion IDS. Masqué sans spa (un admin sans spa rattaché n'a
            pas d'UI de choix de spa — l'EF exigerait un spa_id explicite). */}
        {spaId && (
          <Button
            variant="outline"
            onClick={() => setCreateOpen(true)}
            disabled={atLimit}
            className="gap-1.5"
          >
            <Plus className="w-4 h-4" />
            {t("objectifs.create.button")}
          </Button>
        )}
      </div>

      <div className="bg-accent/50 rounded-card p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <p className="text-sm text-accent-foreground">
          {atLimit
            ? t("objectifs.limitReached")
            : t("objectifs.createdInfo")}
        </p>
      </div>

      {isEmpty ? (
        <div className="bg-card rounded-card shadow-sm border border-dashed border-border p-12 text-center">
          <Target className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            {t("objectifs.emptyState")}
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {objectives.map((obj) => (
            <ObjectiveCard
              key={obj.id}
              objective={obj}
              reportLabel={
                obj.report_id_created
                  ? reportLabelMap.get(obj.report_id_created) ?? null
                  : null
              }
            />
          ))}
        </div>
      )}

      <ObjectiveCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
