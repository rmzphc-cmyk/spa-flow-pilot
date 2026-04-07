import { useState, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import type { SectionStatus } from "@/pages/RapportDetail";

interface Kpi {
  id: string;
  label: string;
  unit: string;
  target: number;
  n1: number;
  category: "spa" | "manager";
}

const kpis: Kpi[] = [
  { id: "k1", label: "CA du mois", unit: "€", target: 45000, n1: 38200, category: "spa" },
  { id: "k2", label: "Taux d'occupation cabines", unit: "%", target: 80, n1: 72, category: "spa" },
  { id: "k3", label: "Panier moyen", unit: "€", target: 120, n1: 115, category: "spa" },
  { id: "k4", label: "NPS clients", unit: "/10", target: 8.5, n1: 7.8, category: "spa" },
  { id: "k5", label: "Ventes produits", unit: "€", target: 8000, n1: 6100, category: "spa" },
  { id: "k6", label: "Absentéisme équipe", unit: "j", target: 2, n1: 3, category: "manager" },
  { id: "k7", label: "Nouveaux abonnements", unit: "", target: 15, n1: 11, category: "spa" },
  { id: "k8", label: "Satisfaction collaborateurs", unit: "/10", target: 8, n1: 7.2, category: "manager" },
];

type KpiStatus = "none" | "green" | "amber" | "red";

function getKpiStatus(value: string, target: number): KpiStatus {
  if (!value || isNaN(Number(value))) return "none";
  const v = Number(value);
  if (v >= target) return "green";
  if (v >= target * 0.85) return "amber";
  return "red";
}

const statusDotColors: Record<KpiStatus, string> = {
  none: "bg-muted-foreground/40",
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
};

const commentPlaceholders: Record<KpiStatus, string> = {
  none: "",
  green: "Une tendance à noter ?",
  amber: "Qu'est-ce qui explique l'écart ?",
  red: "Cause principale et action envisagée ?",
};

const commentBorderColors: Record<KpiStatus, string> = {
  none: "",
  green: "",
  amber: "border-amber-500",
  red: "border-destructive",
};

interface Props {
  reportType: "monthly" | "weekly";
  onStatusChange: (status: SectionStatus) => void;
}

export function SectionKpi({ reportType, onStatusChange }: Props) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [naFlags, setNaFlags] = useState<Record<string, boolean>>({});
  const [naReasons, setNaReasons] = useState<Record<string, string>>({});

  const isComplete = useMemo(() => {
    for (const kpi of kpis) {
      if (naFlags[kpi.id]) {
        if (!naReasons[kpi.id]?.trim()) return false;
        continue;
      }
      const v = values[kpi.id];
      if (!v || isNaN(Number(v))) return false;
      const status = getKpiStatus(v, kpi.target);
      if ((status === "amber" || status === "red") && !comments[kpi.id]?.trim()) return false;
    }
    return true;
  }, [values, comments, naFlags, naReasons]);

  useEffect(() => {
    onStatusChange(isComplete ? "complete" : "incomplete");
  }, [isComplete, onStatusChange]);

  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold text-foreground">KPI du mois</h2>
      <p className="text-sm text-muted-foreground mb-4">Saisissez les valeurs réelles de la période</p>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {kpis.map((kpi) => {
          const isNa = naFlags[kpi.id] ?? false;
          const status = isNa ? "none" : getKpiStatus(values[kpi.id] ?? "", kpi.target);
          const showComment = !isNa && values[kpi.id] && status !== "none";
          const isRequired = status === "amber" || status === "red";
          const ecart = values[kpi.id] && !isNaN(Number(values[kpi.id]))
            ? (((Number(values[kpi.id]) - kpi.target) / kpi.target) * 100).toFixed(1)
            : null;

          return (
            <div key={kpi.id} className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground text-sm">{kpi.label}</span>
                  <span className="text-muted-foreground text-xs">{kpi.unit}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-1.5 py-0.5 rounded ${kpi.category === "spa" ? "bg-blue-50 text-blue-700" : "bg-violet-50 text-violet-700"}`}>
                    {kpi.category === "spa" ? "Spa" : "Manager"}
                  </span>
                  <div className={`w-3 h-3 rounded-full shrink-0 ${statusDotColors[status]}`} />
                </div>
              </div>

              {/* N-1 reference */}
              <p className="text-xs text-muted-foreground mb-3">
                Cycle précédent : <span className="font-medium">{kpi.n1.toLocaleString("fr-FR")}{kpi.unit}</span>
              </p>

              {/* NA checkbox */}
              <div className="flex items-center gap-2 mb-3">
                <Checkbox
                  id={`na-${kpi.id}`}
                  checked={isNa}
                  onCheckedChange={(checked) =>
                    setNaFlags((p) => ({ ...p, [kpi.id]: checked === true }))
                  }
                />
                <label htmlFor={`na-${kpi.id}`} className="text-xs text-muted-foreground cursor-pointer">
                  KPI non disponible ce cycle
                </label>
              </div>

              {isNa ? (
                <Input
                  placeholder="Raison (max 80 car.)"
                  maxLength={80}
                  value={naReasons[kpi.id] ?? ""}
                  onChange={(e) => setNaReasons((p) => ({ ...p, [kpi.id]: e.target.value }))}
                  className="text-sm"
                />
              ) : (
                <>
                  {/* Input + target */}
                  <div className="flex items-center gap-3 mb-1">
                    <Input
                      type="number"
                      className="flex-1 text-right"
                      placeholder="—"
                      value={values[kpi.id] ?? ""}
                      onChange={(e) => setValues((p) => ({ ...p, [kpi.id]: e.target.value }))}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground mt-1 mb-2">
                    <span>Objectif : {kpi.target.toLocaleString("fr-FR")}{kpi.unit}</span>
                    {ecart && (
                      <span className={`font-medium ${Number(ecart) >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                        {Number(ecart) >= 0 ? "+" : ""}{ecart}%
                      </span>
                    )}
                  </div>

                  {/* Comment */}
                  {showComment && (
                    <div className="mt-auto">
                      {isRequired && (
                        <label className="text-xs font-medium text-foreground mb-1 block">
                          Commentaire requis <span className="text-destructive">*</span>
                        </label>
                      )}
                      <Textarea
                        className={`text-sm min-h-[60px] ${
                          isRequired && !comments[kpi.id]?.trim() ? commentBorderColors[status] : ""
                        }`}
                        placeholder={commentPlaceholders[status]}
                        maxLength={200}
                        value={comments[kpi.id] ?? ""}
                        onChange={(e) => setComments((p) => ({ ...p, [kpi.id]: e.target.value }))}
                      />
                      <div className="text-xs text-muted-foreground text-right mt-0.5">
                        {(comments[kpi.id] ?? "").length}/200
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
