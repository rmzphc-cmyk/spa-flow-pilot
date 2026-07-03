import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CoachHint } from "@/components/coaching/CoachHint";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Target, Info, Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import type { SectionStatus } from "@/pages/RapportDetail";
import {
  useObjectives,
  useUpdateObjectiveProgress,
  useSpaObjectiveUpdates,
  useSpaObjectiveSteps,
  parseObjectiveDescription,
  stringifyObjectiveDescription,
  MAX_ACTIVE_OBJECTIVES,
  type ParsedObjectiveDescription,
  type DbObjective,
  type DbObjectiveUpdate,
  type DbObjectiveStep,
} from "@/hooks/useObjectives";
import { computeObjectiveProgress } from "@/lib/objectiveProgress";
import { ObjectiveCreateDialog } from "./ObjectiveCreateDialog";
import { ObjectiveJournalSection } from "./ObjectiveJournalSection";
import { ObjectiveStepsChecklist } from "./ObjectiveStepsChecklist";

interface Props {
  reportId: string;
  reportType: "monthly" | "weekly";
  isLocked?: boolean;
  /** Weekly uniquement — jamais bloquant : "complete" ou "warning". */
  onStatusChange?: (status: SectionStatus) => void;
}

/**
 * Section Objectifs — deux visages selon le cycle :
 * - weekly : point de la semaine par objectif (journal : tag + valeur + texte,
 *   étapes cochables pour le type projet) + timeline. Non bloquant.
 * - monthly : bilan (valeur courante, statut, commentaire) + timeline en
 *   lecture seule ; la saisie du journal reste hebdo.
 */
export function SectionObjectifs({ reportId, reportType, isLocked = false, onStatusChange }: Props) {
  const { t } = useTranslation();
  const { spaId } = useAuth();
  const { data: objectives, isLoading } = useObjectives(spaId);
  const { data: allUpdates } = useSpaObjectiveUpdates(spaId);
  const { data: allSteps } = useSpaObjectiveSteps(spaId);
  const { debouncedUpdate, immediateUpdate } = useUpdateObjectiveProgress();

  const isWeekly = reportType === "weekly";

  const statusOptions = [
    { key: "on_track" as const, label: t("report.objectifs.status.onTrack"), classes: "bg-emerald-100 text-emerald-800 border-emerald-300" },
    { key: "at_risk" as const, label: t("report.objectifs.status.atRisk"), classes: "bg-amber-100 text-amber-800 border-amber-300" },
    { key: "behind" as const, label: t("report.objectifs.status.behind"), classes: "bg-red-100 text-red-800 border-red-300" },
  ];

  const [drafts, setDrafts] = useState<Record<string, Partial<ParsedObjectiveDescription>>>({});
  // Création directe (secondaire) — même dialog que la page /objectifs.
  const [createOpen, setCreateOpen] = useState(false);

  const updatesByObjective = useMemo(() => {
    const map = new Map<string, DbObjectiveUpdate[]>();
    for (const u of allUpdates ?? []) {
      const list = map.get(u.objective_id);
      if (list) list.push(u);
      else map.set(u.objective_id, [u]);
    }
    return map;
  }, [allUpdates]);

  const stepsByObjective = useMemo(() => {
    const map = new Map<string, DbObjectiveStep[]>();
    for (const s of allSteps ?? []) {
      const list = map.get(s.objective_id);
      if (list) list.push(s);
      else map.set(s.objective_id, [s]);
    }
    return map;
  }, [allSteps]);

  const visible = useMemo(() => objectives ?? [], [objectives]);

  // Statut de section (weekly) : complete si chaque objectif a son point de la
  // semaine (entrée liée à CE rapport) — sinon warning, jamais bloquant.
  useEffect(() => {
    if (!isWeekly || !onStatusChange) return;
    if (isLoading || allUpdates === undefined) return;
    const allCovered =
      visible.length === 0 ||
      visible.every((obj) =>
        (updatesByObjective.get(obj.id) ?? []).some((u) => u.report_id === reportId),
      );
    onStatusChange(allCovered ? "complete" : "warning");
  }, [isWeekly, onStatusChange, isLoading, allUpdates, visible, updatesByObjective, reportId]);

  const getParsed = (obj: DbObjective): ParsedObjectiveDescription => {
    const draft = drafts[obj.id];
    const base = parseObjectiveDescription(obj.description);
    return {
      ...base,
      ...(draft ?? {}),
    };
  };

  const handleUpdate = (
    obj: DbObjective,
    patch: Partial<ParsedObjectiveDescription>,
    immediate = false
  ) => {
    if (!spaId) return;
    const nextParsed = { ...getParsed(obj), ...patch };
    setDrafts((prev) => ({ ...prev, [obj.id]: { ...prev[obj.id], ...patch } }));

    const payload = {
      objectiveId: obj.id,
      spaId,
      description: stringifyObjectiveDescription(nextParsed),
      // Dual-write : le `current` du blob alimente la colonne réelle (chiffré).
      ...(obj.kind === "numeric" && patch.current !== undefined
        ? { currentValue: patch.current }
        : {}),
    };

    if (immediate) {
      immediateUpdate(payload);
    } else {
      debouncedUpdate(payload);
    }
  };

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-lg font-semibold text-foreground">{t("report.objectifs.title")}</h2>
          <CoachHint surfaceKey="report.objectifs.title" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-muted-foreground font-medium">
            {t("report.objectifs.active", { count: visible.length })}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setCreateOpen(true)}
            disabled={visible.length >= MAX_ACTIVE_OBJECTIVES}
            title={t("objectifs.create.title")}
            aria-label={t("objectifs.create.title")}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        {isWeekly ? t("report.objectifs.subtitleWeekly") : t("report.objectifs.subtitle")}
      </p>

      <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 text-xs text-blue-800">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <span>{isWeekly ? t("report.objectifs.infoWeekly") : t("report.objectifs.info")}</span>
      </div>

      {isLoading ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">{t("report.objectifs.loading")}</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center shadow-sm">
          <Target className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-foreground font-medium">{t("report.objectifs.empty.title")}</p>
          <p className="text-sm text-muted-foreground mt-1">{t("report.objectifs.empty.subtitle")}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {visible.map((obj) => {
            const parsed = getParsed(obj);
            const isProject = obj.kind === "steps";
            const steps = stepsByObjective.get(obj.id) ?? [];
            const entries = updatesByObjective.get(obj.id) ?? [];

            // Colonnes réelles (Phase 0/2) d'abord, blob legacy en repli.
            const unit = obj.unit ?? parsed.unit;
            const metric = obj.metric ?? parsed.metric;
            const target = isProject
              ? (steps.length > 0 ? steps.length : parsed.target)
              : (obj.target_value ?? parsed.target);
            const start = isProject ? 0 : (obj.start_value ?? parsed.start);
            const current = isProject
              ? (steps.length > 0 ? steps.filter((s) => s.is_done).length : parsed.current)
              : (obj.current_value ?? parsed.current);
            const progress = computeObjectiveProgress(current, target, start);

            return (
              <div key={obj.id} className="bg-card border border-border rounded-xl p-5 shadow-sm">
                <div className="flex items-start justify-between mb-3 gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium text-foreground text-sm">{obj.title}</h3>
                      {isProject && (
                        <Badge variant="secondary" className="shrink-0">
                          {t("objectifs.form.typeSteps")}
                        </Badge>
                      )}
                    </div>
                    {!isProject && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {metric} — {t("report.objectifs.cible")} : {target}
                        {unit}
                      </p>
                    )}
                  </div>
                </div>

                {/* Valeur + barre : weekly = lecture (la saisie passe par le
                    journal) ; monthly chiffré = input du bilan. */}
                <div className="flex items-center gap-4 mb-3">
                  {isProject || isWeekly ? (
                    <span className="text-sm font-medium text-foreground tabular-nums shrink-0">
                      {current}
                      {isProject ? `/${target}` : unit}
                    </span>
                  ) : (
                    <Input
                      type="number"
                      className="w-24 text-right"
                      value={current}
                      onChange={(e) =>
                        handleUpdate(obj, { current: Number(e.target.value) })
                      }
                    />
                  )}
                  <div className="flex-1 h-2 bg-border rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${progress >= 100 ? "bg-emerald-500" : progress >= 70 ? "bg-amber-500" : "bg-red-500"}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-foreground w-12 text-right">{progress}%</span>
                </div>

                {/* Bilan mensuel : statut + commentaire (jugement du manager) */}
                {!isWeekly && (
                  <>
                    <div className="flex gap-1.5 mb-3">
                      {statusOptions.map((s) => (
                        <button
                          key={s.key}
                          onClick={() =>
                            handleUpdate(obj, { status_ui: s.key }, true)
                          }
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                            parsed.status_ui === s.key ? s.classes : "bg-card text-muted-foreground border-border hover:bg-muted"
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>

                    <Textarea
                      className="text-sm min-h-[40px]"
                      placeholder={t("report.objectifs.comment.placeholder")}
                      maxLength={200}
                      value={parsed.comment}
                      onChange={(e) => handleUpdate(obj, { comment: e.target.value })}
                    />
                    <div className="text-xs text-muted-foreground text-right mt-0.5">
                      {(parsed.comment ?? "").length}/200
                    </div>
                  </>
                )}

                {/* Étapes (projet) : cochables tant que le rapport n'est pas verrouillé */}
                {isProject && spaId && (
                  <ObjectiveStepsChecklist steps={steps} spaId={spaId} isLocked={isLocked} />
                )}

                {/* Journal : saisie en weekly, timeline seule en monthly */}
                <ObjectiveJournalSection
                  objective={obj}
                  entries={entries}
                  reportId={reportId}
                  unit={unit}
                  lastValue={obj.current_value ?? (entries.find((e) => e.value !== null)?.value ?? null)}
                  isLocked={isLocked}
                  canAddEntry={isWeekly}
                />
              </div>
            );
          })}
        </div>
      )}

      <ObjectiveCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
    </section>
  );
}
