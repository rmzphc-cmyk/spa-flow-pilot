import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Target, Info } from "lucide-react";

interface Objectif {
  id: string;
  title: string;
  metric: string;
  target: number;
  unit: string;
  current: number;
}

const mockObjectifs: Objectif[] = [
  { id: "o1", title: "Augmenter le NPS clients", metric: "NPS moyen", target: 8.5, unit: "/10", current: 7.8 },
  { id: "o2", title: "Réduire l'absentéisme", metric: "Jours absence", target: 2, unit: "j", current: 3 },
];

const statusOptions = [
  { key: "on_track", label: "En bonne voie", classes: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  { key: "at_risk", label: "À risque", classes: "bg-amber-100 text-amber-800 border-amber-300" },
  { key: "behind", label: "En retard", classes: "bg-red-100 text-red-800 border-red-300" },
] as const;

interface Props {
  reportType: "monthly" | "weekly";
}

export function SectionObjectifs({ reportType }: Props) {
  const [currentValues, setCurrentValues] = useState<Record<string, string>>({});
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [comments, setComments] = useState<Record<string, string>>({});

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-semibold text-foreground">Objectifs</h2>
        <span className="text-sm text-muted-foreground font-medium">{mockObjectifs.length}/3 actifs</span>
      </div>
      <p className="text-sm text-muted-foreground mb-4">Suivi des objectifs du cycle</p>

      {/* No create in preparation */}
      <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 text-xs text-blue-800">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <span>Les objectifs se définissent en réunion ou dans la section Clôture post-réunion.</span>
      </div>

      {mockObjectifs.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center shadow-sm">
          <Target className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-foreground font-medium">Aucun objectif actif pour ce cycle</p>
          <p className="text-sm text-muted-foreground mt-1">À définir lors de la prochaine réunion</p>
        </div>
      ) : (
        <div className="space-y-4">
          {mockObjectifs.map((obj) => {
            const current = Number(currentValues[obj.id] ?? obj.current);
            const progress = Math.min(100, Math.round((current / obj.target) * 100));

            return (
              <div key={obj.id} className="bg-card border border-border rounded-xl p-5 shadow-sm">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-medium text-foreground text-sm">{obj.title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{obj.metric} — Cible : {obj.target}{obj.unit}</p>
                  </div>
                </div>

                {/* Value + progress */}
                <div className="flex items-center gap-4 mb-3">
                  <Input
                    type="number"
                    className="w-24 text-right"
                    value={currentValues[obj.id] ?? String(obj.current)}
                    onChange={(e) => setCurrentValues((p) => ({ ...p, [obj.id]: e.target.value }))}
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
                      onClick={() => setStatuses((p) => ({ ...p, [obj.id]: s.key }))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        statuses[obj.id] === s.key ? s.classes : "bg-card text-muted-foreground border-border hover:bg-muted"
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
                  value={comments[obj.id] ?? ""}
                  onChange={(e) => setComments((p) => ({ ...p, [obj.id]: e.target.value }))}
                />
                <div className="text-xs text-muted-foreground text-right mt-0.5">{(comments[obj.id] ?? "").length}/200</div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
