import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type HistoryCycleType = "monthly" | "weekly";
export type HistoryKpiStatus = "green" | "amber" | "red";

export interface HistoryReport {
  id: string;
  period: string;
  type: HistoryCycleType;
  status: "validated" | "post_meeting_generated";
  meteoEquipe: number;
  energieManager: number;
  respCompletion: number;
  summary: string;
  kpis: {
    label: string;
    unit: string;
    value: number;
    target: number;
    status: HistoryKpiStatus;
  }[];
}

export interface SpaHistoryData {
  name: string;
  reports: HistoryReport[];
}

function mapStatus(s: string | null | undefined): HistoryKpiStatus {
  if (s === "red") return "red";
  if (s === "amber") return "amber";
  return "green";
}

export function useSpaHistory(spaId: string | null | undefined) {
  return useQuery({
    queryKey: ["spa_history", spaId],
    enabled: !!spaId,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    queryFn: async (): Promise<SpaHistoryData | null> => {
      const id = spaId!;

      const [spaRes, reportsRes, targetsRes] = await Promise.all([
        supabase.from("spas").select("id, name").eq("id", id).maybeSingle(),
        supabase
          .from("reports")
          .select(
            `id, cycle_label, cycle_type, status, period_start,
             checkins(mood_score, focus_level),
             responsibility_logs(completion_rate),
             meeting_summaries(executive_summary),
             kpi_entries(value_current, value_n1, status, kpi_definition_id,
               kpi_definitions(name, unit))`,
          )
          .eq("spa_id", id)
          .in("status", ["validated", "post_meeting_generated"])
          .order("period_start", { ascending: true }),
        supabase
          .from("kpi_monthly_targets")
          .select("kpi_definition_id, year_month, monthly_value")
          .eq("spa_id", id),
      ]);

      if (spaRes.error) throw spaRes.error;
      if (reportsRes.error) throw reportsRes.error;
      if (targetsRes.error) throw targetsRes.error;
      if (!spaRes.data) return null;

      const targetsByKey = new Map<string, number>();
      for (const t of (targetsRes.data ?? []) as any[]) {
        if (t.monthly_value != null) {
          targetsByKey.set(`${t.kpi_definition_id}|${t.year_month}`, Number(t.monthly_value));
        }
      }

      const reports: HistoryReport[] = ((reportsRes.data ?? []) as any[]).map((r) => {
        const checkin = Array.isArray(r.checkins) ? r.checkins[0] : r.checkins;
        const respLogs = (r.responsibility_logs ?? []) as any[];
        const summaryRow = Array.isArray(r.meeting_summaries)
          ? r.meeting_summaries[0]
          : r.meeting_summaries;
        const kpiEntries = (r.kpi_entries ?? []) as any[];

        const respRates = respLogs
          .map((rl: any) => rl.completion_rate)
          .filter((v: any) => typeof v === "number");
        const respCompletion =
          respRates.length > 0
            ? Math.round(
                respRates.reduce((s: number, v: number) => s + v, 0) / respRates.length,
              )
            : 0;

        const yearMonth =
          typeof r.period_start === "string" ? r.period_start.slice(0, 7) : "";

        const kpis = kpiEntries
          .filter((ke: any) => ke.value_current != null)
          .map((ke: any) => {
            const targetMonthly = targetsByKey.get(`${ke.kpi_definition_id}|${yearMonth}`);
            const target =
              targetMonthly != null
                ? targetMonthly
                : ke.value_n1 != null
                  ? Number(ke.value_n1)
                  : 0;
            return {
              label: ke.kpi_definitions?.name ?? "KPI",
              unit: ke.kpi_definitions?.unit ?? "",
              value: Number(ke.value_current),
              target,
              status: mapStatus(ke.status),
            };
          });

        return {
          id: r.id,
          period: r.cycle_label ?? "—",
          type: (r.cycle_type === "weekly" ? "weekly" : "monthly") as HistoryCycleType,
          status: (r.status === "post_meeting_generated"
            ? "post_meeting_generated"
            : "validated") as "validated" | "post_meeting_generated",
          meteoEquipe: checkin?.mood_score != null ? Number(checkin.mood_score) * 2 : 0,
          energieManager:
            checkin?.focus_level != null ? Number(checkin.focus_level) * 2 : 0,
          respCompletion,
          summary: summaryRow?.executive_summary ?? "",
          kpis,
        };
      });

      return { name: spaRes.data.name, reports };
    },
  });
}
