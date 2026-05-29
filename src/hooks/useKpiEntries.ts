import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type KpiStatus = "green" | "amber" | "red" | "not_applicable" | "excellent";

export interface KpiEntryRow {
  id: string;
  report_id: string;
  kpi_definition_id: string;
  value_current: number | null;
  value_n1: number | null;
  comment: string | null;
  comment_is_validated: boolean;
  status: KpiStatus;
  target_value: number | null;
}

export function useKpiEntries(reportId: string | undefined) {
  return useQuery({
    queryKey: ["kpi_entries", reportId],
    enabled: !!reportId,
    queryFn: async (): Promise<KpiEntryRow[]> => {
      const { data, error } = await supabase
        .from("kpi_entries")
        .select("*")
        .eq("report_id", reportId!);
      if (error) throw error;
      return (data ?? []) as KpiEntryRow[];
    },
  });
}

export interface UpsertKpiEntryInput {
  report_id: string;
  kpi_definition_id: string;
  value_current: number | null;
  value_n1?: number | null;
  comment: string | null;
  status: KpiStatus;
}

export function useUpsertKpiEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpsertKpiEntryInput) => {
      const { data, error } = await supabase
        .from("kpi_entries")
        .upsert(input, { onConflict: "report_id,kpi_definition_id" })
        .select()
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["kpi_entries", vars.report_id] });
    },
  });
}

/**
 * Compute display status from current value vs thresholds.
 * Used only for the colored dot — persisted status comes from the same logic.
 */
export function computeKpiStatus(
  value: number | null,
  thresholdAmber: number | null,
  thresholdRed: number | null,
  direction: "higher_is_better" | "lower_is_better",
): KpiStatus {
  if (value === null || isNaN(value)) return "not_applicable";
  if (thresholdAmber === null && thresholdRed === null) return "green";
  if (direction === "higher_is_better") {
    if (thresholdAmber !== null && value >= thresholdAmber) return "green";
    if (thresholdRed !== null && value >= thresholdRed) return "amber";
    return "red";
  } else {
    if (thresholdAmber !== null && value <= thresholdAmber) return "green";
    if (thresholdRed !== null && value <= thresholdRed) return "amber";
    return "red";
  }
}
