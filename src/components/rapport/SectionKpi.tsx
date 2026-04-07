import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { KpiCardSaisie, KpiCardSaisieWeekly, getKpiStatus } from "@/components/KpiCard";
import type { KpiData, KpiCardValue } from "@/components/KpiCard";
import type { SectionStatus } from "@/pages/RapportDetail";

const kpis: KpiData[] = [
  { id: "k1", label: "CA du mois", unit: "€", target: 45000, n1: 38200, category: "spa", history: [36000, 38200, 41000, 38200] },
  { id: "k2", label: "Taux d'occupation cabines", unit: "%", target: 80, n1: 72, category: "spa", history: [68, 70, 72, 72] },
  { id: "k3", label: "Panier moyen", unit: "€", target: 120, n1: 115, category: "spa", history: [110, 112, 118, 115] },
  { id: "k4", label: "NPS clients", unit: "/10", target: 8.5, n1: 7.8, category: "spa", history: [7.5, 7.6, 7.9, 7.8] },
  { id: "k5", label: "Ventes produits", unit: "€", target: 8000, n1: 6100, category: "spa", history: [5200, 5800, 6000, 6100] },
  { id: "k6", label: "Absentéisme équipe", unit: "j", target: 2, n1: 3, category: "manager", history: [2, 3, 2, 3] },
  { id: "k7", label: "Nouveaux abonnements", unit: "", target: 15, n1: 11, category: "spa", history: [9, 10, 12, 11] },
  { id: "k8", label: "Satisfaction collaborateurs", unit: "/10", target: 8, n1: 7.2, category: "manager", history: [6.8, 7.0, 7.1, 7.2] },
];

interface Props {
  reportType: "monthly" | "weekly";
  onStatusChange: (status: SectionStatus) => void;
}

export function SectionKpi({ reportType, onStatusChange }: Props) {
  const { t } = useTranslation();
  const isWeekly = reportType === "weekly";

  const [cardValues, setCardValues] = useState<Record<string, KpiCardValue>>(() => {
    const init: Record<string, KpiCardValue> = {};
    for (const kpi of kpis) {
      init[kpi.id] = { value: "", comment: "", isNa: false, naReason: "" };
    }
    return init;
  });

  const isComplete = useMemo(() => {
    for (const kpi of kpis) {
      const cv = cardValues[kpi.id];
      if (cv.isNa) {
        if (!cv.naReason.trim()) return false;
        continue;
      }
      if (!cv.value || isNaN(Number(cv.value))) return false;

      if (isWeekly) {
        // Weekly: only red KPIs (vs N-1) require comment
        const weeklyStatus = getWeeklyStatus(Number(cv.value), kpi.n1);
        if (weeklyStatus === "red" && !cv.comment.trim()) return false;
      } else {
        const status = getKpiStatus(cv.value, kpi.target);
        if ((status === "amber" || status === "red") && !cv.comment.trim()) return false;
      }
    }
    return true;
  }, [cardValues, isWeekly]);

  useEffect(() => {
    onStatusChange(isComplete ? "complete" : "incomplete");
  }, [isComplete, onStatusChange]);

  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold text-foreground">
        {isWeekly ? "KPI de la semaine" : t("kpi.title")}
      </h2>
      <p className="text-sm text-muted-foreground mb-4">
        {isWeekly ? "Tendances par rapport à la semaine précédente" : t("kpi.subtitle")}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {kpis.map((kpi) =>
          isWeekly ? (
            <KpiCardSaisieWeekly
              key={kpi.id}
              kpi={kpi}
              cardValue={cardValues[kpi.id]}
              onChange={(newVal) => setCardValues((p) => ({ ...p, [kpi.id]: newVal }))}
            />
          ) : (
            <KpiCardSaisie
              key={kpi.id}
              kpi={kpi}
              cardValue={cardValues[kpi.id]}
              onChange={(newVal) => setCardValues((p) => ({ ...p, [kpi.id]: newVal }))}
            />
          )
        )}
      </div>
    </section>
  );
}

/** Weekly status: compare vs previous week (N-1), not target */
function getWeeklyStatus(value: number, n1: number): "green" | "amber" | "red" {
  const ratio = n1 === 0 ? 1 : value / n1;
  if (ratio >= 1) return "green";
  if (ratio >= 0.85) return "amber";
  return "red";
}
