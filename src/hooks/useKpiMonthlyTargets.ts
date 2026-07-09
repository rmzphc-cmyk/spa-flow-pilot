import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type WeeklyMode = "divide" | "fixed";

export interface KpiMonthlyTarget {
  id: string;
  spa_id: string;
  kpi_definition_id: string;
  year_month: string;
  monthly_value: number | null;
  weekly_mode: WeeklyMode;
  weekly_override: number | null;
  actual_monthly_value: number | null;
  // Seuils d'évaluation spécifiques au mois (override). NULL = on retombe sur le
  // mois précédent puis sur les seuils par défaut de la définition (voir resolveThresholds).
  threshold_excellent: number | null;
  threshold_amber: number | null;
  threshold_red: number | null;
  created_at: string;
  updated_at: string;
}

export interface UpsertKpiMonthlyTargetInput {
  spa_id: string;
  kpi_definition_id: string;
  year_month: string;
  monthly_value: number | null;
  weekly_mode: WeeklyMode;
  weekly_override: number | null;
  actual_monthly_value: number | null;
  threshold_excellent: number | null;
  threshold_amber: number | null;
  threshold_red: number | null;
}

/** Seuils par défaut portés par la définition du KPI (socle stable). */
export interface DefaultThresholds {
  threshold_excellent: number | null;
  threshold_amber: number | null;
  threshold_red: number | null;
}

export interface ResolvedThresholds {
  excellent: number | null;
  amber: number | null;
  red: number | null;
}

/**
 * Résout les seuils applicables à un mois donné selon la chaîne de priorité :
 * seuils du mois courant → seuils du mois précédent (héritage) → seuils par
 * défaut de la définition. Résolution par champ (un seuil absent retombe seul).
 */
export function resolveThresholds(
  def: DefaultThresholds,
  current: KpiMonthlyTarget | null | undefined,
  previous: KpiMonthlyTarget | null | undefined,
): ResolvedThresholds {
  return {
    excellent:
      current?.threshold_excellent ?? previous?.threshold_excellent ?? def.threshold_excellent ?? null,
    amber: current?.threshold_amber ?? previous?.threshold_amber ?? def.threshold_amber ?? null,
    red: current?.threshold_red ?? previous?.threshold_red ?? def.threshold_red ?? null,
  };
}

export function getWeeklyTarget(target: KpiMonthlyTarget | null | undefined): number | null {
  if (!target || target.monthly_value === null) return null;
  if (target.weekly_override !== null) return target.weekly_override;
  if (target.weekly_mode === "divide") return target.monthly_value / 4;
  return target.monthly_value;
}

export function getPrevYearMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split("-").map(Number);
  if (month === 1) return `${year - 1}-12`;
  return `${year}-${String(month - 1).padStart(2, "0")}`;
}

export function useKpiMonthlyTargets(
  spaId: string | null | undefined,
  yearMonth: string
) {
  const prevYearMonth = getPrevYearMonth(yearMonth);

  const current = useQuery({
    queryKey: ["kpi_monthly_targets", spaId, yearMonth],
    enabled: !!spaId,
    queryFn: async (): Promise<KpiMonthlyTarget[]> => {
      const { data, error } = await supabase
        .from("kpi_monthly_targets")
        .select("*")
        .eq("spa_id", spaId!)
        .eq("year_month", yearMonth);
      if (error) throw error;
      return (data ?? []) as KpiMonthlyTarget[];
    },
  });

  const previous = useQuery({
    queryKey: ["kpi_monthly_targets", spaId, prevYearMonth],
    enabled: !!spaId,
    queryFn: async (): Promise<KpiMonthlyTarget[]> => {
      const { data, error } = await supabase
        .from("kpi_monthly_targets")
        .select("*")
        .eq("spa_id", spaId!)
        .eq("year_month", prevYearMonth);
      if (error) throw error;
      return (data ?? []) as KpiMonthlyTarget[];
    },
  });

  const currentMap = useMemo(
    () => new Map((current.data ?? []).map((t) => [t.kpi_definition_id, t])),
    [current.data]
  );

  const previousMap = useMemo(
    () => new Map((previous.data ?? []).map((t) => [t.kpi_definition_id, t])),
    [previous.data]
  );

  return {
    targets: current.data ?? [],
    prevTargets: previous.data ?? [],
    currentMap,
    previousMap,
    isLoading: current.isLoading || previous.isLoading,
  };
}

export function useUpsertKpiMonthlyTarget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpsertKpiMonthlyTargetInput) => {
      const { data, error } = await supabase
        .from("kpi_monthly_targets")
        .upsert(input, {
          onConflict: "spa_id,kpi_definition_id,year_month",
        })
        .select()
        .maybeSingle();
      if (error) throw error;
      return data as KpiMonthlyTarget;
    },
    onSuccess: (data) => {
      if (!data) return;
      qc.invalidateQueries({
        queryKey: ["kpi_monthly_targets", data.spa_id, data.year_month],
      });
    },
  });
}
