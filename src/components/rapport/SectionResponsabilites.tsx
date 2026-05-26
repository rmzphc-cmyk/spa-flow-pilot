import { useEffect, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import type { SectionStatus } from "@/pages/RapportDetail";
import { useAuth } from "@/contexts/AuthContext";
import {
  useResponsabilityTemplates,
  useResponsabilityLogs,
  useUpsertResponsabilityLog,
} from "@/hooks/useResponsabilites";

interface Props {
  reportId: string;
  reportType?: "monthly" | "weekly";
  onStatusChange: (status: SectionStatus) => void;
}

type LocalState = Record<string, { completion_rate: number | null; comment: string }>;

const STATES: { value: 100 | 50 | 0; label: string; cls: string }[] = [
  { value: 100, label: "Réalisé ✓", cls: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  { value: 50, label: "Partiel ◐", cls: "bg-amber-100 text-amber-800 border-amber-300" },
  { value: 0, label: "Non réalisé ✗", cls: "bg-red-100 text-red-800 border-red-300" },
];

export function SectionResponsabilites({ reportId, onStatusChange }: Props) {
  const { spaId } = useAuth();
  const { data: templates = [] } = useResponsabilityTemplates(spaId);
  const { data: logs } = useResponsabilityLogs(reportId);
  const { debouncedUpsert } = useUpsertResponsabilityLog();

  const [local, setLocal] = useState<LocalState>({});
  const [hydratedFor, setHydratedFor] = useState<string | null>(null);

  // Hydrate local state from logs once per report
  useEffect(() => {
    if (!logs || hydratedFor === reportId) return;
    const next: LocalState = {};
    for (const [tid, v] of Object.entries(logs)) {
      next[tid] = { completion_rate: v.completion_rate, comment: v.comment ?? "" };
    }
    setLocal(next);
    setHydratedFor(reportId);
  }, [logs, reportId, hydratedFor]);

  // Status: complete when every template has a state chosen
  useEffect(() => {
    if (templates.length === 0) {
      onStatusChange("incomplete");
      return;
    }
    const allSet = templates.every((t) => {
      const entry = local[t.id];
      return entry && entry.completion_rate !== null && entry.completion_rate !== undefined;
    });
    onStatusChange(allSet ? "complete" : "incomplete");
  }, [templates, local, onStatusChange]);

  const updateState = (templateId: string, completion_rate: number) => {
    setLocal((p) => {
      const next = { ...p, [templateId]: { completion_rate, comment: p[templateId]?.comment ?? "" } };
      debouncedUpsert({
        report_id: reportId,
        responsibility_template_id: templateId,
        completion_rate,
        comment: next[templateId].comment || null,
      });
      return next;
    });
  };

  const updateComment = (templateId: string, comment: string) => {
    setLocal((p) => {
      const prev = p[templateId] ?? { completion_rate: null, comment: "" };
      const next = { ...p, [templateId]: { ...prev, comment } };
      if (prev.completion_rate !== null && prev.completion_rate !== undefined) {
        debouncedUpsert({
          report_id: reportId,
          responsibility_template_id: templateId,
          completion_rate: prev.completion_rate,
          comment: comment || null,
        });
      }
      return next;
    });
  };

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-semibold text-foreground">Responsabilités</h2>
        <span className="text-sm text-muted-foreground">Score calculé par l'API</span>
      </div>
      <p className="text-sm text-muted-foreground mb-4">Évaluez la réalisation de chaque responsabilité</p>

      <div className="bg-card border border-border rounded-xl p-4 shadow-sm mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-2xl font-bold text-foreground">—%</span>
          <span className="text-xs text-muted-foreground">complétion globale (calculée par l'API)</span>
        </div>
        <div className="h-2 bg-border rounded-full" />
      </div>

      <div className="space-y-3">
        {templates.length === 0 && (
          <div className="bg-card border border-border rounded-xl p-4 shadow-sm text-sm text-muted-foreground">
            Aucune responsabilité configurée pour ce spa
          </div>
        )}
        {templates.map((resp) => {
          const entry = local[resp.id];
          const selected = entry?.completion_rate ?? null;
          const comment = entry?.comment ?? "";

          return (
            <div key={resp.id} className="bg-card border border-border rounded-xl p-4 shadow-sm">
              <div className="flex items-start gap-4 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-foreground text-sm">{resp.title}</span>
                    {resp.category && (
                      <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        {resp.category}
                      </span>
                    )}
                  </div>
                  {resp.description && (
                    <p className="text-xs text-muted-foreground mt-1">{resp.description}</p>
                  )}
                </div>

                <div className="shrink-0 flex gap-1">
                  {STATES.map((s) => (
                    <button
                      key={s.value}
                      onClick={() => updateState(resp.id, s.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        selected === s.value
                          ? s.cls
                          : "bg-card text-muted-foreground border-border hover:bg-muted"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-3">
                <Textarea
                  className="text-sm min-h-[40px]"
                  placeholder="Commentaire (optionnel)"
                  value={comment}
                  onChange={(e) => updateComment(resp.id, e.target.value)}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
