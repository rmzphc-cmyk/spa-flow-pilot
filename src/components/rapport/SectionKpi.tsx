import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { KpiCardSaisie, KpiCardSaisieWeekly, getKpiStatus } from "@/components/KpiCard";
import type { KpiData, KpiCardValue } from "@/components/KpiCard";
import type { SectionStatus } from "@/pages/RapportDetail";
import { useAuth } from "@/contexts/AuthContext";
import { useKpiDefinitions, type KpiDefinitionRow } from "@/hooks/useKpiDefinitions";
import {
  useKpiEntries,
  useUpsertKpiEntry,
  computeKpiStatus,
  type KpiEntryRow,
  type KpiStatus,
} from "@/hooks/useKpiEntries";
import {
  useKpiMonthlyTargets,
  getWeeklyTarget,
  type KpiMonthlyTarget,
} from "@/hooks/useKpiMonthlyTargets";

interface Props {
  reportId: string;
  reportType: "monthly" | "weekly";
  period?: string;
  yearMonth?: string;
  onStatusChange: (status: SectionStatus) => void;
}

function mapCategory(def: KpiDefinitionRow): "spa" | "manager" {
  return (def.kpi_group ?? "spa") === "manager" ? "manager" : "spa";
}

function defToKpiData(
  def: KpiDefinitionRow,
  entry: KpiEntryRow | undefined,
  liveTarget: KpiMonthlyTarget | undefined,
  isWeekly: boolean,
): KpiData {
  let target: number;
  if (liveTarget) {
    target = isWeekly
      ? (getWeeklyTarget(liveTarget) ?? def.threshold_amber ?? 0)
      : (liveTarget.monthly_value ?? def.threshold_amber ?? 0);
  } else {
    target = entry?.target_value ?? def.threshold_amber ?? 0;
  }
  return {
    id: def.id,
    label: def.name,
    unit: def.unit ?? "",
    target,
    n1: entry?.value_n1 ?? 0,
    category: mapCategory(def),
  };
}


function entryToCardValue(entry: KpiEntryRow | undefined): KpiCardValue {
  if (!entry) return { value: "", comment: "", isNa: false, naReason: "" };
  const isNa = entry.status === "not_applicable" && entry.value_current === null;
  return {
    value: entry.value_current !== null ? String(entry.value_current) : "",
    comment: isNa ? "" : entry.comment ?? "",
    isNa,
    naReason: isNa ? entry.comment ?? "" : "",
  };
}

export function SectionKpi({ reportId, reportType, yearMonth, onStatusChange }: Props) {
  const { t } = useTranslation();
  const { spaId } = useAuth();
  const isWeekly = reportType === "weekly";

  const { data: definitions = [] } = useKpiDefinitions(spaId);
  const { data: entries = [] } = useKpiEntries(reportId);
  const { currentMap: liveTargetMap } = useKpiMonthlyTargets(spaId, yearMonth ?? "");
  const upsert = useUpsertKpiEntry();

  const entriesByDef = useMemo(() => {
    const map = new Map<string, KpiEntryRow>();
    for (const e of entries) map.set(e.kpi_definition_id, e);
    return map;
  }, [entries]);

  // Local debounced state per definition
  const [local, setLocal] = useState<Record<string, KpiCardValue>>({});

  // Track only user-edited fields — server data can overwrite unedited fields on reload
  const userEditedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    setLocal((prev) => {
      const next = { ...prev };
      for (const def of definitions) {
        if (!userEditedRef.current.has(def.id)) {
          next[def.id] = entryToCardValue(entriesByDef.get(def.id));
        }
      }
      return next;
    });
  }, [definitions, entriesByDef]);

  // Sort: spa first, then manager, then display_order
  const sortedDefs = useMemo(
    () =>
      [...definitions].sort((a, b) => {
        const ca = mapCategory(a);
        const cb = mapCategory(b);

        if (ca !== cb) return ca === "spa" ? -1 : 1;
        return a.display_order - b.display_order;
      }),
    [definitions],
  );

  // Debounce timers per definition
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const persist = useCallback(
    (def: KpiDefinitionRow, cv: KpiCardValue) => {
      if (!reportId) return;
      let value_current: number | null = null;
      let comment: string | null = null;
      let status: KpiStatus;

      if (cv.isNa) {
        status = "not_applicable";
        comment = cv.naReason || null;
      } else {
        const n = cv.value === "" ? NaN : Number(cv.value);
        if (isNaN(n)) {
          status = "not_applicable";
        } else {
          value_current = n;
          if (isWeekly) {
            const entryData = entriesByDef.get(def.id);
            const liveTarget = liveTargetMap.get(def.id);
            const ref = liveTarget
              ? (getWeeklyTarget(liveTarget) ?? entryData?.value_n1 ?? 0)
              : (entryData?.target_value ?? entryData?.value_n1 ?? 0);
            if (ref === 0) {
              status = "green";
            } else {
              const ratio = n / ref;
              if (ratio >= 1) status = "green";
              else if (ratio >= 0.85) status = "amber";
              else status = "red";
            }


          } else {
            status = computeKpiStatus(
              n,
              def.threshold_amber,
              def.threshold_red,
              def.comparison_direction,
            );
          }
        }
        comment = cv.comment || null;
      }

      // Skip empty unsaved state to avoid creating noise rows
      const existing = entriesByDef.get(def.id);
      if (!existing && value_current === null && !cv.isNa && !comment) return;

      upsert.mutate({
        report_id: reportId,
        kpi_definition_id: def.id,
        value_current,
        comment,
        status,
      });
    },
    [reportId, upsert, entriesByDef, isWeekly, liveTargetMap],
  );

  const handleChange = useCallback(
    (def: KpiDefinitionRow, cv: KpiCardValue) => {
      userEditedRef.current.add(def.id);
      setLocal((p) => ({ ...p, [def.id]: cv }));
      const t = timersRef.current[def.id];
      if (t) clearTimeout(t);
      timersRef.current[def.id] = setTimeout(() => persist(def, cv), 800);
    },
    [persist],
  );

  useEffect(() => {
    return () => {
      for (const t of Object.values(timersRef.current)) clearTimeout(t);
    };
  }, []);

  // Completeness validation
  const isComplete = useMemo(() => {
    if (sortedDefs.length === 0) return false;
    for (const def of sortedDefs) {
      const cv = local[def.id];
      if (!cv) return false;
      if (cv.isNa) {
        if (!cv.naReason.trim()) return false;
        continue;
      }
      if (isWeekly) {
        const entryData = entriesByDef.get(def.id);
        const liveTarget = liveTargetMap.get(def.id);
        const ref = liveTarget
          ? (getWeeklyTarget(liveTarget) ?? entryData?.value_n1 ?? 0)
          : (entryData?.target_value ?? entryData?.value_n1 ?? 0);
        const ratio = ref > 0 ? Number(cv.value) / ref : 1;
        if (ratio < 0.85 && !cv.comment.trim()) return false;
      } else {
        const status = computeKpiStatus(
          Number(cv.value),
          def.threshold_amber,
          def.threshold_red,
          def.comparison_direction,
        );
        if ((status === "amber" || status === "red") && !cv.comment.trim()) return false;
      }
    }
    return true;
  }, [local, sortedDefs, isWeekly, entriesByDef, liveTargetMap]);

  useEffect(() => {
    onStatusChange(isComplete ? "complete" : "incomplete");
  }, [isComplete, onStatusChange]);

  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold text-foreground">
        {isWeekly ? "KPI de la semaine" : t("kpi.title")}
      </h2>
      <p className="text-sm text-muted-foreground mb-4">
        {isWeekly ? "Comparaison vs objectif hebdomadaire planifié (Config KPI)" : t("kpi.subtitle")}
      </p>


      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {sortedDefs.map((def) => {
          const entry = entriesByDef.get(def.id);
          const liveTarget = liveTargetMap.get(def.id);
          const data = defToKpiData(def, entry, liveTarget, isWeekly);
          const cv = local[def.id] ?? entryToCardValue(entry);
          return isWeekly ? (
            <KpiCardSaisieWeekly
              key={def.id}
              kpi={data}
              cardValue={cv}
              onChange={(v) => handleChange(def, v)}
            />
          ) : (
            <KpiCardSaisie
              key={def.id}
              kpi={data}
              cardValue={cv}
              onChange={(v) => handleChange(def, v)}
            />
          );
        })}
      </div>
    </section>
  );
}

// Re-export for backwards-compat with any importers
export { getKpiStatus };

// Legacy mock list kept for components not yet migrated to Supabase (MeetingMode, SectionCloture).
export const baseKpis: KpiData[] = [
  { id: "k1", label: "CA du mois", unit: "€", target: 45000, n1: 38200, category: "spa", history: [36000, 38200, 41000, 38200] },
  { id: "k2", label: "Taux d'occupation cabines", unit: "%", target: 80, n1: 72, category: "spa", history: [68, 70, 72, 72] },
  { id: "k3", label: "Panier moyen", unit: "€", target: 120, n1: 115, category: "spa", history: [110, 112, 118, 115] },
  { id: "k4", label: "NPS clients", unit: "/10", target: 8.5, n1: 7.8, category: "spa", history: [7.5, 7.6, 7.9, 7.8] },
  { id: "k5", label: "Ventes produits", unit: "€", target: 8000, n1: 6100, category: "spa", history: [5200, 5800, 6000, 6100] },
  { id: "k6", label: "Absentéisme équipe", unit: "j", target: 2, n1: 3, category: "manager", history: [2, 3, 2, 3] },
  { id: "k7", label: "Nouveaux abonnements", unit: "", target: 15, n1: 11, category: "spa", history: [9, 10, 12, 11] },
  { id: "k8", label: "Satisfaction collaborateurs", unit: "/10", target: 8, n1: 7.2, category: "manager", history: [6.8, 7.0, 7.1, 7.2] },
];
