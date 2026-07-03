import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CoachHint } from "@/components/coaching/CoachHint";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Target, Info, Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  useObjectives,
  useUpdateObjectiveProgress,
  parseObjectiveDescription,
  stringifyObjectiveDescription,
  MAX_ACTIVE_OBJECTIVES,
  type ParsedObjectiveDescription,
  type DbObjective,
} from "@/hooks/useObjectives";
import { computeObjectiveProgress } from "@/lib/objectiveProgress";
import { ObjectiveCreateDialog } from "./ObjectiveCreateDialog";

interface Props {
  reportId: string;
  reportType: "monthly" | "weekly";
}

export function SectionObjectifs({ reportId, reportType }: Props) {
  const { t } = useTranslation();
  const { spaId } = useAuth();
  const { data: objectives, isLoading } = useObjectives(spaId);
  const { debouncedUpdate, immediateUpdate } = useUpdateObjectiveProgress();

  const statusOptions = [
    { key: "on_track" as const, label: t("report.objectifs.status.onTrack"), classes: "bg-emerald-100 text-emerald-800 border-emerald-300" },
    { key: "at_risk" as const, label: t("report.objectifs.status.atRisk"), classes: "bg-amber-100 text-amber-800 border-amber-300" },
    { key: "behind" as const, label: t("report.objectifs.status.behind"), classes: "bg-red-100 text-red-800 border-red-300" },
  ];

  const [drafts, setDrafts] = useState<Record<string, Partial<ParsedObjectiveDescription>>>({});
  // Création directe (secondaire) — même dialog que la page /objectifs.
  const [createOpen, setCreateOpen] = useState(false);

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
    };

    if (immediate) {
      immediateUpdate(payload);
    } else {
      debouncedUpdate(payload);
    }
  };

  const visible = objectives ?? [];

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
      <p className="text-sm text-muted-foreground mb-4">{t("report.objectifs.subtitle")}</p>

      <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 text-xs text-blue-800">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <span>{t("report.objectifs.info")}</span>
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
            const current = parsed.current;
            const progress = computeObjectiveProgress(current, parsed.target, parsed.start);

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
                        {parsed.metric} — {t("report.objectifs.cible")} : {parsed.target}
                        {parsed.unit}
                      </p>
                    )}
                  </div>
                </div>

                {/* Value + progress — projet : lecture seule (avancement étapes
                    dans le blob 0/N, édition des étapes en Phase 2) */}
                <div className="flex items-center gap-4 mb-3">
                  {isProject ? (
                    <span className="text-sm font-medium text-foreground tabular-nums shrink-0">
                      {current}/{parsed.target}
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

                {/* Status toggle */}
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

                {/* Comment */}
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
              </div>
            );
          })}
        </div>
      )}

      <ObjectiveCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
    </section>
  );
}
