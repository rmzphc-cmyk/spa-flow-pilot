import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CoachHint } from "@/components/coaching/CoachHint";
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
import {
  useKpiRoleAssignments,
  ROLE_LABELS,
  NIVEAU_COLORS,
  type KpiRoleAssignment,
  type KpiRole,
  type KpiNiveau,
} from "@/hooks/useKpiRoleAssignments";

const NIVEAU_ORDER: Record<KpiNiveau, number> = {
  prioritaire: 0,
  secondaire: 1,
  suivi: 2,
};

const ROLE_SECTION_ORDER: KpiRole[] = [
  "spa_manager",
  "therapist",
  "spa_concierge",
  "ambassador",
];

const ROLE_SECTION_ICONS: Record<KpiRole, string> = {
  spa_manager: "👤",
  therapist: "💆",
  spa_concierge: "🛎️",
  ambassador: "⭐",
};


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

  const weeklyDivisor =
    isWeekly &&
    liveTarget?.weekly_mode === "divide" &&
    liveTarget?.weekly_override === null
      ? 4
      : 1;

  return {
    id: def.id,
    label: def.name,
    unit: def.unit ?? "",
    target,
    n1: entry?.value_n1 ?? 0,
    category: mapCategory(def),
    thresholdExcellent: def.threshold_excellent ?? null,
    thresholdAmber: def.threshold_amber ?? null,
    thresholdRed: def.threshold_red ?? null,
    comparisonDirection: def.comparison_direction,
    weeklyDivisor,
  };
}



function entryToCardValue(entry: KpiEntryRow | undefined): KpiCardValue {
  if (!entry) return { value: "", comment: "", isNa: false, naReason: "" };
  // N/A = marqueur explicite `is_na` (coché par le manager). On ne se fie plus à
  // la présence d'un commentaire : la raison est optionnelle. Une entrée pré-créée
  // par create-report-cycle reste is_na=false → saisie chiffrée par défaut.
  const isNa = entry.is_na === true;
  return {
    value: !isNa && entry.value_current !== null ? String(entry.value_current) : "",
    comment: isNa ? "" : entry.comment ?? "",
    isNa,
    naReason: isNa ? entry.comment ?? "" : "",
  };
}

function kpiNeedsComment(
  def: KpiDefinitionRow,
  cv: KpiCardValue,
  isWeekly: boolean,
  entriesByDef: Map<string, KpiEntryRow>,
  liveTargetMap: Map<string, KpiMonthlyTarget>,
): boolean {
  if (cv.isNa) return false;
  if (cv.value === "") return false;

  const n = Number(cv.value);
  if (isNaN(n)) return false;

  if (isWeekly) {
    const entryData = entriesByDef.get(def.id);
    const liveTarget = liveTargetMap.get(def.id);
    const divisor =
      liveTarget?.weekly_mode === "divide" && liveTarget?.weekly_override === null ? 4 : 1;
    const tExcellent = def.threshold_excellent != null ? def.threshold_excellent / divisor : null;
    const tAmber = def.threshold_amber != null ? def.threshold_amber / divisor : null;
    const tRed = def.threshold_red != null ? def.threshold_red / divisor : null;

    let wStatus: ReturnType<typeof computeKpiStatus> | "excellent" | "green" | "amber" | "red";
    if (tAmber !== null || tRed !== null) {
      wStatus = computeKpiStatus(n, tExcellent, tAmber, tRed, def.comparison_direction);
    } else {
      const ref = liveTarget
        ? (getWeeklyTarget(liveTarget) ?? entryData?.value_n1 ?? 0)
        : (entryData?.target_value ?? entryData?.value_n1 ?? 0);
      if (ref === 0) {
        wStatus = "green";
      } else {
        const ratio = n / ref;
        if (ratio >= 1.15) wStatus = "excellent";
        else if (ratio >= 1) wStatus = "green";
        else if (ratio >= 0.85) wStatus = "amber";
        else wStatus = "red";
      }
    }
    return (wStatus === "amber" || wStatus === "red") && !cv.comment.trim();
  } else {
    const status = computeKpiStatus(
      n,
      def.threshold_excellent,
      def.threshold_amber,
      def.threshold_red,
      def.comparison_direction,
    );
    return (status === "amber" || status === "red") && !cv.comment.trim();
  }
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

  // Fetch role assignments for all KPIs of this spa
  const kpiIds = useMemo(() => definitions.map((d) => d.id), [definitions]);
  const { data: roleAssignments = [] } = useKpiRoleAssignments(kpiIds);

  const assignmentsByKpiId = useMemo(() => {
    const map = new Map<string, KpiRoleAssignment[]>();
    for (const a of roleAssignments) {
      if (!map.has(a.kpi_definition_id)) map.set(a.kpi_definition_id, []);
      map.get(a.kpi_definition_id)!.push(a);
    }
    return map;
  }, [roleAssignments]);

  const groupedByRole = useMemo(() => {
    const groups = new Map<KpiRole, { def: KpiDefinitionRow; niveau: KpiNiveau }[]>();
    const unassigned: KpiDefinitionRow[] = [];

    for (const def of definitions) {
      const assignments = assignmentsByKpiId.get(def.id) ?? [];
      if (assignments.length === 0) {
        unassigned.push(def);
      } else {
        for (const a of assignments) {
          if (!groups.has(a.role)) groups.set(a.role, []);
          groups.get(a.role)!.push({ def, niveau: a.niveau });
        }
      }
    }

    for (const [, items] of groups) {
      items.sort(
        (a, b) =>
          NIVEAU_ORDER[a.niveau] - NIVEAU_ORDER[b.niveau] ||
          a.def.display_order - b.def.display_order,
      );
    }

    return { groups, unassigned };
  }, [definitions, assignmentsByKpiId]);

  // Fallback flat list for completeness check (order doesn't matter)
  const sortedDefs = useMemo(() => definitions, [definitions]);


  // Debounce timers per definition
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  // Changements saisis mais pas encore persistés (pour flush au démontage)
  const pendingRef = useRef<Record<string, { def: KpiDefinitionRow; cv: KpiCardValue }>>({});

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
            const divisor =
              liveTarget?.weekly_mode === "divide" && liveTarget?.weekly_override === null ? 4 : 1;
            const tExcellent = def.threshold_excellent != null ? def.threshold_excellent / divisor : null;
            const tAmber = def.threshold_amber != null ? def.threshold_amber / divisor : null;
            const tRed = def.threshold_red != null ? def.threshold_red / divisor : null;

            if (tAmber !== null || tRed !== null) {
              status = computeKpiStatus(n, tExcellent, tAmber, tRed, def.comparison_direction);
            } else {
              const ref = liveTarget
                ? (getWeeklyTarget(liveTarget) ?? entryData?.value_n1 ?? 0)
                : (entryData?.target_value ?? entryData?.value_n1 ?? 0);
              if (ref === 0) {
                status = "green";
              } else {
                const ratio = n / ref;
                if (ratio >= 1.15) status = "excellent";
                else if (ratio >= 1) status = "green";
                else if (ratio >= 0.85) status = "amber";
                else status = "red";
              }
            }
          } else {

            status = computeKpiStatus(
              n,
              def.threshold_excellent,
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
        is_na: cv.isNa,
      });
      delete pendingRef.current[def.id];
    },
    [reportId, upsert, entriesByDef, isWeekly, liveTargetMap],
  );

  // Garde une réf vers le dernier persist pour pouvoir flusher au démontage
  const persistRef = useRef(persist);
  persistRef.current = persist;

  const handleChange = useCallback(
    (def: KpiDefinitionRow, cv: KpiCardValue) => {
      userEditedRef.current.add(def.id);
      pendingRef.current[def.id] = { def, cv };
      setLocal((p) => ({ ...p, [def.id]: cv }));
      const t = timersRef.current[def.id];
      if (t) clearTimeout(t);
      timersRef.current[def.id] = setTimeout(() => persist(def, cv), 800);
    },
    [persist],
  );

  useEffect(() => {
    return () => {
      // Au démontage : annuler les timers ET flusher les changements en attente
      // (sinon une saisie faite < 800ms avant de quitter la section est perdue)
      for (const t of Object.values(timersRef.current)) clearTimeout(t);
      const pending = pendingRef.current;
      pendingRef.current = {};
      for (const { def, cv } of Object.values(pending)) {
        persistRef.current(def, cv);
      }
    };
  }, []);

  // Completeness validation
  const isComplete = useMemo(() => {
    if (sortedDefs.length === 0) return false;
    for (const def of sortedDefs) {
      const cv = local[def.id];
      if (!cv) return false;
      if (cv.isNa) {
        // Raison optionnelle : cocher « non disponible » suffit à valider.
        continue;
      }
      if (isWeekly) {
        const entryData = entriesByDef.get(def.id);
        const liveTarget = liveTargetMap.get(def.id);
        const divisor =
          liveTarget?.weekly_mode === "divide" && liveTarget?.weekly_override === null ? 4 : 1;
        const tExcellent = def.threshold_excellent != null ? def.threshold_excellent / divisor : null;
        const tAmber = def.threshold_amber != null ? def.threshold_amber / divisor : null;
        const tRed = def.threshold_red != null ? def.threshold_red / divisor : null;
        const n = Number(cv.value);
        let wStatus: ReturnType<typeof computeKpiStatus> | "excellent" | "green" | "amber" | "red";
        if (tAmber !== null || tRed !== null) {
          wStatus = computeKpiStatus(n, tExcellent, tAmber, tRed, def.comparison_direction);
        } else {
          const ref = liveTarget
            ? (getWeeklyTarget(liveTarget) ?? entryData?.value_n1 ?? 0)
            : (entryData?.target_value ?? entryData?.value_n1 ?? 0);
          if (ref === 0) wStatus = "green";
          else {
            const ratio = n / ref;
            if (ratio >= 1.15) wStatus = "excellent";
            else if (ratio >= 1) wStatus = "green";
            else if (ratio >= 0.85) wStatus = "amber";
            else wStatus = "red";
          }
        }
        if ((wStatus === "amber" || wStatus === "red") && !cv.comment.trim()) return false;

      } else {
        const status = computeKpiStatus(
          Number(cv.value),
          def.threshold_excellent,
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

  const missingCommentKpis = useMemo(() => {
    const missing: { id: string; label: string }[] = [];
    for (const def of sortedDefs) {
      const cv = local[def.id];
      if (!cv) continue;
      if (kpiNeedsComment(def, cv, isWeekly, entriesByDef, liveTargetMap)) {
        missing.push({ id: def.id, label: def.name });
      }
    }
    return missing;
  }, [local, sortedDefs, isWeekly, entriesByDef, liveTargetMap]);

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold text-foreground">
              {isWeekly ? t("report.kpi.weeklyTitle") : `📊 ${t("report.kpi.title")}`}
            </h2>
            <CoachHint surfaceKey={isWeekly ? "report.kpi.weeklyTitle" : "report.kpi.title"} />
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isWeekly
              ? t("report.kpi.weeklySubtitle")
              : t("report.kpi.subtitle")}
          </p>
        </div>
      </div>

      {missingCommentKpis.length > 0 && (
        <div className="mb-6 p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-center gap-2">
          <span className="text-amber-600">⚠️</span>
          <span className="text-sm text-amber-700 font-medium">
            {t("report.kpi.missingComment", { count: missingCommentKpis.length })}
          </span>
        </div>
      )}

      <div className="space-y-8">
        {ROLE_SECTION_ORDER.map((role) => {
          const items = groupedByRole.groups.get(role);
          if (!items || items.length === 0) return null;
          return (
            <div key={role}>
              <div
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg mb-4 ${
                  role === "spa_manager"
                    ? "bg-teal-50 border border-teal-200"
                    : role === "therapist"
                    ? "bg-violet-50 border border-violet-200"
                    : role === "spa_concierge"
                    ? "bg-amber-50 border border-amber-200"
                    : "bg-rose-50 border border-rose-200"
                }`}
              >
                <span className="text-lg">{ROLE_SECTION_ICONS[role]}</span>
                <div className="flex-1">
                  <h3
                    className={`text-sm font-bold uppercase tracking-wide ${
                      role === "spa_manager"
                        ? "text-teal-800"
                        : role === "therapist"
                        ? "text-violet-800"
                        : role === "spa_concierge"
                        ? "text-amber-800"
                        : "text-rose-800"
                    }`}
                  >
                    {ROLE_LABELS[role]}
                  </h3>
                </div>
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    role === "spa_manager"
                      ? "bg-teal-200 text-teal-800"
                      : role === "therapist"
                      ? "bg-violet-200 text-violet-800"
                      : role === "spa_concierge"
                      ? "bg-amber-200 text-amber-800"
                      : "bg-rose-200 text-rose-800"
                  }`}
                >
                  {t("report.kpi.kpiCount", { count: items.length })}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {items.map(({ def, niveau }) => {
                  const entry = entriesByDef.get(def.id);
                  const liveTarget = liveTargetMap.get(def.id);
                  const data = defToKpiData(def, entry, liveTarget, isWeekly);
                  const cv = local[def.id] ?? entryToCardValue(entry);
                  const needsComment = kpiNeedsComment(def, cv, isWeekly, entriesByDef, liveTargetMap);
                  return (
                    <div key={`${role}-${def.id}`} className="flex flex-col gap-0">
                      <div
                        className={`text-[10px] font-semibold uppercase tracking-widest px-3 py-0.5 rounded-t-md w-fit ${
                          niveau === "prioritaire"
                            ? "bg-teal-600 text-white"
                            : niveau === "secondaire"
                            ? "bg-blue-500 text-white"
                            : "bg-gray-400 text-white"
                        }`}
                      >
                        {niveau}
                      </div>
                      <div
                        className={`rounded-tl-none border-l-4 ${
                          niveau === "prioritaire"
                            ? "border-l-teal-500"
                            : niveau === "secondaire"
                            ? "border-l-blue-400"
                            : "border-l-gray-300"
                        }`}
                      >
                        {isWeekly ? (
                          <KpiCardSaisieWeekly
                            kpi={data}
                            cardValue={cv}
                            onChange={(v) => handleChange(def, v)}
                          />
                        ) : (
                          <KpiCardSaisie
                            kpi={data}
                            cardValue={cv}
                            onChange={(v) => handleChange(def, v)}
                          />
                        )}
                      </div>
                      {needsComment && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-b-md bg-amber-50 border border-amber-200 border-t-0">
                          <span>⚠️</span>
                          <span className="text-xs text-amber-600 font-medium">{t("report.kpi.commentRequired")}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {groupedByRole.unassigned.length > 0 && (
          <div>
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg mb-4 bg-gray-50 border border-gray-200">
              <span className="text-lg">📊</span>
              <h3 className="text-sm font-bold uppercase tracking-wide text-gray-600 flex-1">
                {t("report.kpi.othersTitle")}
              </h3>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-200 text-gray-700">
                {t("report.kpi.kpiCount", { count: groupedByRole.unassigned.length })}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {groupedByRole.unassigned.map((def) => {
                const entry = entriesByDef.get(def.id);
                const liveTarget = liveTargetMap.get(def.id);
                const data = defToKpiData(def, entry, liveTarget, isWeekly);
                const cv = local[def.id] ?? entryToCardValue(entry);
                const needsComment = kpiNeedsComment(def, cv, isWeekly, entriesByDef, liveTargetMap);
                return (
                  <div key={def.id} className="flex flex-col">
                    {isWeekly ? (
                      <KpiCardSaisieWeekly
                        kpi={data}
                        cardValue={cv}
                        onChange={(v) => handleChange(def, v)}
                      />
                    ) : (
                      <KpiCardSaisie
                        kpi={data}
                        cardValue={cv}
                        onChange={(v) => handleChange(def, v)}
                      />
                    )}
                    {needsComment && (
                      <div className="mt-1 flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-50 border border-amber-200">
                        <span>⚠️</span>
                        <span className="text-xs text-amber-600 font-medium">{t("report.kpi.commentRequired")}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
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
