import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Target, Info } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  useObjectives,
  useUpdateObjectiveProgress,
  parseObjectiveDescription,
  stringifyObjectiveDescription,
  type ParsedObjectiveDescription,
  type DbObjective,
} from "@/hooks/useObjectives";

const statusOptions = [
  { key: "on_track" as const, label: "En bonne voie", classes: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  { key: "at_risk" as const, label: "À risque", classes: "bg-amber-100 text-amber-800 border-amber-300" },
  { key: "behind" as const, label: "En retard", classes: "bg-red-100 text-red-800 border-red-300" },
];

interface Props {
  reportId: string;
  reportType: "monthly" | "weekly";
}

export function SectionObjectifs({ reportId, reportType }: Props) {
  const { spaId } = useAuth();
  const { data: objectives, isLoading } = useObjectives(spaId);
  const { debouncedUpdate, immediateUpdate } = useUpdateObjectiveProgress();

  // Local draft state for smooth editing (not persisted to localStorage)
  const [drafts, setDrafts] = useState<Record<string, Partial<ParsedObjectiveDescription>>>({});

  // Initialize drafts from fetched data when not already editing
  useEffect(() => {
    if (!objectives) return;
    setDrafts((prev) => {
      const next: Record<string, Partial<ParsedObjectiveDescription>> = { ...prev };
      for (const obj of objectives) {
        if (!next[obj.id]) {
          // No local draft yet — will read from DB description on render
        }
      }
      return next;
    });
  }, [objectives]);

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
        <h2 className="text-lg font-semibold text-foreground">Objectifs</h2>
        <span className="text-sm text-muted-foreground font-medium">{visible.length}/3 actifs</span>
      </div>
      <p className="text-sm text-muted-foreground mb-4">Suivi des objectifs du cycle</p>

      {/* No create in preparation */}
      <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 text-xs text-blue-800">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <span>Les objectifs se définissent en réunion ou dans la section Clôture post-réunion.</span>
      </div>

      {isLoading ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">Chargement des objectifs…</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center shadow-sm">
          <Target className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-foreground font-medium">Aucun objectif actif pour ce cycle</p>
          <p className="text-sm text-muted-foreground mt-1">À définir lors de la prochaine réunion</p>
        </div>
      ) : (
        <div className="space-y-4">
          {visible.map((obj) => {
            const parsed = getParsed(obj);
            const current = parsed.current;
            const progress = Math.min(100, Math.round((current / (parsed.target || 1)) * 100));

            return (
              <div key={obj.id} className="bg-card border border-border rounded-xl p-5 shadow-sm">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-medium text-foreground text-sm">{obj.title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {parsed.metric} — Cible : {parsed.target}
                      {parsed.unit}
                    </p>
                  </div>
                </div>

                {/* Value + progress */}
                <div className="flex items-center gap-4 mb-3">
                  <Input
                    type="number"
                    className="w-24 text-right"
                    value={current}
                    onChange={(e) =>
                      handleUpdate(obj, { current: Number(e.target.value) })
                    }
                  />
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
                  placeholder="Commentaire court"
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
    </section>
  );
}
