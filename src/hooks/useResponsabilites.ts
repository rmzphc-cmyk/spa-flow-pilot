import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ResponsabilityTemplateRow {
  id: string;
  title: string;
  title_en: string | null;
  title_es: string | null;
  description: string | null;
  category: string | null;
  display_order: number;
  frequency: string;
  expected_count: number;
}

export function getLocalizedRespTitle(
  tmpl: { title: string; title_en?: string | null; title_es?: string | null },
  lang: string,
): string {
  const l = (lang || "fr").toLowerCase().slice(0, 2);
  if (l === "en" && tmpl.title_en) return tmpl.title_en;
  if (l === "es" && tmpl.title_es) return tmpl.title_es;
  return tmpl.title;
}

export interface ResponsabilityLogRow {
  id: string;
  report_id: string;
  responsibility_template_id: string;
  completion_rate: number;
  comment: string | null;
  actual_count: number | null;
}

export function useResponsabilityTemplates(spaId: string | null) {
  return useQuery({
    queryKey: ["responsibility_templates", spaId],
    enabled: !!spaId,
    queryFn: async (): Promise<ResponsabilityTemplateRow[]> => {
      const { data, error } = await supabase
        .from("responsibility_templates")
        .select("id, title, title_en, title_es, description, category, display_order, frequency, expected_count")
        .eq("spa_id", spaId!)
        .eq("is_active", true)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ResponsabilityTemplateRow[];
    },
  });
}

export interface ResponsabilityLogMap {
  [templateId: string]: {
    completion_rate: number;
    comment: string | null;
    actual_count: number | null;
  };
}

export function useResponsabilityLogs(reportId: string | undefined) {
  return useQuery({
    queryKey: ["responsibility_logs", reportId],
    enabled: !!reportId,
    queryFn: async (): Promise<ResponsabilityLogMap> => {
      const { data, error } = await supabase
        .from("responsibility_logs")
        .select("responsibility_template_id, completion_rate, comment, actual_count")
        .eq("report_id", reportId!);
      if (error) throw error;
      const map: ResponsabilityLogMap = {};
      for (const row of data ?? []) {
        map[(row as ResponsabilityLogRow).responsibility_template_id] = {
          completion_rate: (row as ResponsabilityLogRow).completion_rate,
          comment: (row as ResponsabilityLogRow).comment,
          actual_count: (row as ResponsabilityLogRow).actual_count ?? null,
        };
      }
      return map;
    },
  });
}

export interface UpsertResponsabilityLogInput {
  report_id: string;
  responsibility_template_id: string;
  completion_rate: number;
  comment: string | null;
  actual_count?: number | null;
}

export function useUpsertResponsabilityLog() {
  const qc = useQueryClient();
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const mutation = useMutation({
    mutationFn: async (input: UpsertResponsabilityLogInput) => {
      const payload = {
        report_id: input.report_id,
        responsibility_template_id: input.responsibility_template_id,
        completion_rate: input.completion_rate,
        comment: input.comment,
        actual_count: input.actual_count ?? null,
      };
      const { data, error } = await supabase
        .from("responsibility_logs")
        .upsert(payload, { onConflict: "report_id,responsibility_template_id" })
        .select()
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["responsibility_logs", vars.report_id] });
    },
  });

  const debouncedUpsert = useCallback(
    (input: UpsertResponsabilityLogInput) => {
      const key = `${input.report_id}:${input.responsibility_template_id}`;
      if (timers.current[key]) clearTimeout(timers.current[key]);
      timers.current[key] = setTimeout(() => {
        mutation.mutate(input);
      }, 800);
    },
    [mutation],
  );

  return { ...mutation, debouncedUpsert };
}

// ============= Admin/Config-only hooks (templates CRUD) =============

export interface RespTemplateFullRow {
  id: string;
  spa_id: string;
  title: string;
  description: string | null;
  category: string | null;
  display_order: number;
  is_active: boolean;
  frequency: string;
  expected_count: number;
}

export function useAllRespTemplates(spaId: string | null) {
  return useQuery({
    queryKey: ["all_resp_templates", spaId],
    enabled: !!spaId,
    queryFn: async (): Promise<RespTemplateFullRow[]> => {
      const { data, error } = await supabase
        .from("responsibility_templates")
        .select("id, spa_id, title, description, category, display_order, is_active, frequency, expected_count")
        .eq("spa_id", spaId!)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as RespTemplateFullRow[];
    },
  });
}

function invalidateRespTemplates(qc: ReturnType<typeof useQueryClient>, spaId: string) {
  qc.invalidateQueries({ queryKey: ["all_resp_templates", spaId] });
  qc.invalidateQueries({ queryKey: ["responsibility_templates", spaId] });
}

export interface AddRespTemplateInput {
  spaId: string;
  title: string;
  description: string | null;
  category: string | null;
  display_order: number;
  frequency: string;
  expected_count: number;
}

export function useAddRespTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AddRespTemplateInput) => {
      const { data, error } = await supabase
        .from("responsibility_templates")
        .insert({
          spa_id: input.spaId,
          title: input.title,
          description: input.description,
          category: input.category,
          display_order: input.display_order,
          is_active: true,
          frequency: input.frequency,
          expected_count: input.expected_count,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => invalidateRespTemplates(qc, vars.spaId),
  });
}

export interface UpdateRespTemplateInput {
  id: string;
  spaId: string;
  title?: string;
  description?: string | null;
  category?: string | null;
  is_active?: boolean;
  display_order?: number;
  frequency?: string;
  expected_count?: number;
}

export function useUpdateRespTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateRespTemplateInput) => {
      const { id, spaId, ...fields } = input;
      const { error } = await supabase
        .from("responsibility_templates")
        .update(fields)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => invalidateRespTemplates(qc, vars.spaId),
  });
}

export function useSoftDeleteRespTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; spaId: string }) => {
      const { error } = await supabase
        .from("responsibility_templates")
        .update({ is_active: false })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => invalidateRespTemplates(qc, vars.spaId),
  });
}

// ============= Frequency helpers =============

export function calcMonthlyExpected(frequency: string, expectedCount: number): number {
  switch (frequency) {
    case "daily":
      return expectedCount * 22;
    case "weekly":
      return expectedCount * 4;
    case "biweekly":
      return expectedCount * 2;
    case "monthly":
      return expectedCount * 1;
    default:
      return expectedCount * 1;
  }
}

export function calcWeeklyExpected(frequency: string, expectedCount: number): number {
  switch (frequency) {
    case "daily":
      return expectedCount * 5;
    case "weekly":
      return expectedCount * 1;
    default:
      return expectedCount * 1;
  }
}

// ============= Weekly prefill batch (for monthly reports) =============

export interface WeeklyPrefillResult {
  prefillValue: number;
  weeklyReportsWithData: number;
  totalWeeklyReports: number;
  hasWeeklyReports: boolean;
}

const EMPTY_PREFILL: WeeklyPrefillResult = {
  prefillValue: 0,
  weeklyReportsWithData: 0,
  totalWeeklyReports: 0,
  hasWeeklyReports: false,
};

function firstOfMonth(iso: string): string {
  const [y, m] = iso.split("-");
  return `${y}-${m}-01`;
}

function firstOfNextMonth(iso: string): string {
  const [y, m] = iso.split("-");
  const year = Number(y);
  const month = Number(m);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
}

export function useWeeklyPrefillBatch(
  spaId: string | null,
  templateIds: string[],
  monthlyPeriodStart: string | null,
): Record<string, WeeklyPrefillResult> {
  const idsKey = templateIds.join(",");
  const { data } = useQuery({
    queryKey: ["weekly_prefill_batch", spaId, idsKey, monthlyPeriodStart],
    enabled: !!spaId && templateIds.length > 0 && !!monthlyPeriodStart,
    queryFn: async (): Promise<Record<string, WeeklyPrefillResult>> => {
      const monthStart = firstOfMonth(monthlyPeriodStart!);
      const monthEnd = firstOfNextMonth(monthlyPeriodStart!);

      const { data: rows, error } = await supabase
        .from("responsibility_logs")
        .select(
          "responsibility_template_id, actual_count, reports!inner(id, cycle_type, period_start, spa_id)",
        )
        .in("responsibility_template_id", templateIds)
        .eq("reports.cycle_type", "weekly")
        .eq("reports.spa_id", spaId!)
        .gte("reports.period_start", monthStart)
        .lte("reports.period_start", monthEnd);

      if (error) throw error;

      const result: Record<string, WeeklyPrefillResult> = {};
      for (const id of templateIds) {
        result[id] = { ...EMPTY_PREFILL };
      }

      for (const row of (rows ?? []) as Array<{
        responsibility_template_id: string;
        actual_count: number | null;
      }>) {
        const id = row.responsibility_template_id;
        if (!result[id]) result[id] = { ...EMPTY_PREFILL };
        result[id].totalWeeklyReports += 1;
        if (row.actual_count !== null && row.actual_count !== undefined) {
          result[id].prefillValue += row.actual_count;
          result[id].weeklyReportsWithData += 1;
        }
        result[id].hasWeeklyReports = result[id].totalWeeklyReports > 0;
      }

      return result;
    },
  });

  if (data) return data;
  const fallback: Record<string, WeeklyPrefillResult> = {};
  for (const id of templateIds) fallback[id] = { ...EMPTY_PREFILL };
  return fallback;
}
