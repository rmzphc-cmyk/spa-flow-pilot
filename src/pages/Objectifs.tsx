import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import {
  useObjectives,
  useClosedObjectives,
  useSpaObjectiveSteps,
  useCloseObjective,
  parseObjectiveDescription,
  MAX_ACTIVE_OBJECTIVES,
  type CloseObjectiveStatus,
  type DbObjective,
  type DbClosedObjective,
  type DbObjectiveStep,
} from "@/hooks/useObjectives";
import {
  resolveObjectiveDisplay,
  objectiveStatusMeta,
  isObjectiveOverdue,
} from "@/lib/objectiveDisplay";
import {
  ObjectiveBadges,
  ObjectiveProgressRow,
} from "@/components/rapport/ObjectiveCardParts";
import { useReports } from "@/hooks/useReports";
import { Loader2, Target, Info, Calendar, FileText, Plus, Check, X, History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

const DATE_LOCALES: Record<string, string> = {
  fr: "fr-FR",
  en: "en-GB",
  es: "es-ES",
};

function formatIsoDate(dateStr: string | null, lang: string): string | null {
  if (!dateStr) return null;
  try {
    // Parse LOCAL des composants yyyy-mm-dd : new Date("yyyy-mm-dd") serait
    // interprété en UTC et décalerait d'un jour sur les fuseaux négatifs.
    const [y, m, d] = dateStr.slice(0, 10).split("-").map(Number);
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
  steps,
}: {
  objective: DbObjective;
  reportLabel: string | null;
  steps: DbObjectiveStep[];
}) {
  const { t, i18n } = useTranslation();
  const parsed = parseObjectiveDescription(objective.description);
  const display = resolveObjectiveDisplay(objective, parsed, steps);
  const meta = objectiveStatusMeta(parsed.status_ui);
  const overdue = isObjectiveOverdue(objective.target_date, objective.status);
  const dueDate = formatIsoDate(objective.target_date, i18n.language);

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
      <div className="flex items-start justify-between gap-4 mb-1">
        <h3 className="font-semibold text-foreground text-lg leading-tight">
          {objective.title}
        </h3>
        <ObjectiveBadges
          isProject={display.isProject}
          statusUi={parsed.status_ui}
          overdue={overdue}
        />
      </div>
      {!display.isProject && display.metric && (
        <p className="text-sm text-muted-foreground mb-4">{display.metric}</p>
      )}

      <div className="space-y-4 mt-4">
        <ObjectiveProgressRow
          current={display.current}
          target={display.target}
          unit={display.unit}
          isProject={display.isProject}
          progress={display.progress}
          barClass={meta.barClass}
        />

        {/* Due date */}
        {dueDate && (
          <div
            className={`flex items-center gap-2 text-sm ${overdue ? "text-destructive" : "text-muted-foreground"}`}
          >
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

/** Carte d'historique — lecture seule, valeurs figées à la clôture. */
function ClosedObjectiveCard({
  objective,
  steps,
}: {
  objective: DbClosedObjective;
  steps: DbObjectiveStep[];
}) {
  const { t, i18n } = useTranslation();
  const parsed = parseObjectiveDescription(objective.description);
  const display = resolveObjectiveDisplay(objective, parsed, steps);
  const isAchieved = objective.status === "achieved";
  const closedDate = formatIsoDate(objective.achieved_at ?? objective.updated_at, i18n.language);

  return (
    <div className="bg-card rounded-card shadow-sm p-6 border border-border">
      <div className="flex items-start justify-between gap-4 mb-1">
        <h3 className="font-semibold text-foreground leading-tight">{objective.title}</h3>
        <ObjectiveBadges
          isProject={display.isProject}
          closedStatus={isAchieved ? "achieved" : "abandoned"}
        />
      </div>
      {!display.isProject && display.metric && (
        <p className="text-sm text-muted-foreground mb-4">{display.metric}</p>
      )}

      <div className="space-y-3 mt-4">
        <ObjectiveProgressRow
          current={display.current}
          target={display.target}
          unit={display.unit}
          isProject={display.isProject}
          progress={display.progress}
          barClass={isAchieved ? "bg-success" : "bg-muted-foreground/40"}
        />
        {closedDate && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="w-4 h-4 shrink-0" />
            <span>{t("objectifs.history.closedOn", { date: closedDate })}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Objectifs() {
  const { t } = useTranslation();
  const { spaId } = useAuth();
  const { data: objectives, isLoading } = useObjectives(spaId);
  const { data: closedObjectives, isLoading: closedLoading } = useClosedObjectives(spaId);
  const { data: allSteps } = useSpaObjectiveSteps(spaId);
  const { data: reports } = useReports();
  const [createOpen, setCreateOpen] = useState(false);

  const reportLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    reports?.forEach((r) => map.set(r.id, r.cycle_label));
    return map;
  }, [reports]);

  const stepsByObjective = useMemo(() => {
    const map = new Map<string, DbObjectiveStep[]>();
    for (const s of allSteps ?? []) {
      const list = map.get(s.objective_id);
      if (list) list.push(s);
      else map.set(s.objective_id, [s]);
    }
    return map;
  }, [allSteps]);

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
  const historyEmpty = !closedObjectives || closedObjectives.length === 0;

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

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">{t("objectifs.tabs.active")}</TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5">
            <History className="w-3.5 h-3.5" />
            {t("objectifs.tabs.history")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-6 mt-4">
          <div className="bg-accent/50 rounded-card p-4 flex items-start gap-3">
            <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <p className="text-sm text-accent-foreground">
              {atLimit ? t("objectifs.limitReached") : t("objectifs.createdInfo")}
            </p>
          </div>

          {isEmpty ? (
            <div className="bg-card rounded-card shadow-sm border border-dashed border-border p-12 text-center">
              <Target className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">{t("objectifs.emptyState")}</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {objectives.map((obj) => (
                <ObjectiveCard
                  key={obj.id}
                  objective={obj}
                  steps={stepsByObjective.get(obj.id) ?? []}
                  reportLabel={
                    obj.report_id_created
                      ? reportLabelMap.get(obj.report_id_created) ?? null
                      : null
                  }
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          {closedLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : historyEmpty ? (
            <div className="bg-card rounded-card shadow-sm border border-dashed border-border p-12 text-center">
              <History className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">{t("objectifs.history.empty")}</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {closedObjectives.map((obj) => (
                <ClosedObjectiveCard
                  key={obj.id}
                  objective={obj}
                  steps={stepsByObjective.get(obj.id) ?? []}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <ObjectiveCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
