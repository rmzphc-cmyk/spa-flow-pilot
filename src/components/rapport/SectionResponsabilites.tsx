import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { SectionStatus } from "@/pages/RapportDetail";

type Frequency = "daily" | "weekly" | "biweekly" | "monthly" | "quarterly";
type ToggleStatus = "done" | "partial" | "not_done" | null;

interface Responsabilite {
  id: string;
  label: string;
  frequency: Frequency;
  expected: number;
  conditional?: boolean;
}

const responsabilites: Responsabilite[] = [
  { id: "r1", label: "Briefing équipe matin", frequency: "daily", expected: 22 },
  { id: "r2", label: "Vérification propreté cabines", frequency: "daily", expected: 22 },
  { id: "r3", label: "Suivi planning RDV", frequency: "weekly", expected: 4 },
  { id: "r4", label: "Inventaire produits", frequency: "monthly", expected: 1 },
  { id: "r5", label: "Réunion d'équipe mensuelle", frequency: "monthly", expected: 1 },
  { id: "r6", label: "Rapport satisfaction client", frequency: "quarterly", expected: 1, conditional: true },
  { id: "r7", label: "Formation continue équipe", frequency: "monthly", expected: 1, conditional: true },
];

const toggleColors: Record<string, string> = {
  done: "bg-emerald-100 text-emerald-800 border-emerald-300",
  partial: "bg-amber-100 text-amber-800 border-amber-300",
  not_done: "bg-red-100 text-red-800 border-red-300",
};

interface Props {
  onStatusChange: (status: SectionStatus) => void;
}

export function SectionResponsabilites({ onStatusChange }: Props) {
  const [numericValues, setNumericValues] = useState<Record<string, string>>({});
  const [toggleValues, setToggleValues] = useState<Record<string, ToggleStatus>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [naFlags, setNaFlags] = useState<Record<string, boolean>>({});

  const isNumeric = (f: Frequency) => f === "daily" || f === "weekly" || f === "biweekly";

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-semibold text-foreground">Responsabilités</h2>
        <span className="text-sm text-muted-foreground">Score calculé par l'API</span>
      </div>
      <p className="text-sm text-muted-foreground mb-4">Évaluez la réalisation de chaque responsabilité</p>

      {/* Progress bar placeholder */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-sm mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-2xl font-bold text-foreground">—%</span>
          <span className="text-xs text-muted-foreground">complétion globale (calculée par l'API)</span>
        </div>
        <div className="h-2 bg-border rounded-full" />
      </div>

      {/* Table */}
      <div className="space-y-3">
        {responsabilites.map((resp) => {
          const isNa = naFlags[resp.id] ?? false;

          return (
            <div key={resp.id} className="bg-card border border-border rounded-xl p-4 shadow-sm">
              <div className="flex items-start gap-4 flex-wrap">
                {/* Label */}
                <div className="flex-1 min-w-[200px]">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground text-sm">{resp.label}</span>
                    <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {resp.frequency}
                    </span>
                    {resp.conditional && (
                      <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded" title="Responsabilité conditionnelle">
                        Conditionnel
                      </span>
                    )}
                  </div>

                  {/* NA for conditional */}
                  {resp.conditional && (
                    <div className="flex items-center gap-2 mt-2">
                      <Checkbox
                        id={`na-resp-${resp.id}`}
                        checked={isNa}
                        onCheckedChange={(c) => setNaFlags((p) => ({ ...p, [resp.id]: c === true }))}
                      />
                      <label htmlFor={`na-resp-${resp.id}`} className="text-xs text-muted-foreground cursor-pointer">
                        Non applicable ce cycle
                      </label>
                    </div>
                  )}
                </div>

                {/* Input */}
                {!isNa && (
                  <div className="shrink-0">
                    {isNumeric(resp.frequency) ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Réalisé</span>
                        <Input
                          type="number"
                          className="w-16 text-center"
                          placeholder="—"
                          value={numericValues[resp.id] ?? ""}
                          onChange={(e) => setNumericValues((p) => ({ ...p, [resp.id]: e.target.value }))}
                        />
                        <span className="text-xs text-muted-foreground">/ {resp.expected}</span>
                      </div>
                    ) : (
                      <div className="flex gap-1">
                        {(["done", "partial", "not_done"] as const).map((s) => (
                          <button
                            key={s}
                            onClick={() => setToggleValues((p) => ({ ...p, [resp.id]: s }))}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                              toggleValues[resp.id] === s ? toggleColors[s] : "bg-card text-muted-foreground border-border hover:bg-muted"
                            }`}
                          >
                            {s === "done" ? "Réalisé ✓" : s === "partial" ? "Partiel ◐" : "Non réalisé ✗"}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Comment */}
              {!isNa && (
                <div className="mt-3">
                  <Textarea
                    className="text-sm min-h-[40px]"
                    placeholder="Commentaire (optionnel)"
                    value={comments[resp.id] ?? ""}
                    onChange={(e) => setComments((p) => ({ ...p, [resp.id]: e.target.value }))}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
