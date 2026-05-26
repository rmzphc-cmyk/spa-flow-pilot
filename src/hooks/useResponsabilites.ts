import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ResponsabilityTemplateRow {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  display_order: number;
}

export interface ResponsabilityLogRow {
  id: string;
  report_id: string;
  responsibility_template_id: string;
  completion_rate: number;
  comment: string | null;
}

export function useResponsabilityTemplates(spaId: string | null) {
  return useQuery({
    queryKey: ["responsibility_templates", spaId],
    enabled: !!spaId,
    queryFn: async (): Promise<ResponsabilityTemplateRow[]> => {
      const { data, error } = await supabase
        .from("responsibility_templates")
        .select("id, title, description, category, display_order")
        .eq("spa_id", spaId!)
        .eq("is_active", true)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ResponsabilityTemplateRow[];
    },
  });
}

export interface ResponsabilityLogMap {
  [templateId: string]: { completion_rate: number; comment: string | null };
}

export function useResponsabilityLogs(reportId: string | undefined) {
  return useQuery({
    queryKey: ["responsibility_logs", reportId],
    enabled: !!reportId,
    queryFn: async (): Promise<ResponsabilityLogMap> => {
      const { data, error } = await supabase
        .from("responsibility_logs")
        .select("responsibility_template_id, completion_rate, comment")
        .eq("report_id", reportId!);
      if (error) throw error;
      const map: ResponsabilityLogMap = {};
      for (const row of data ?? []) {
        map[(row as ResponsabilityLogRow).responsibility_template_id] = {
          completion_rate: (row as ResponsabilityLogRow).completion_rate,
          comment: (row as ResponsabilityLogRow).comment,
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
}

export function useUpsertResponsabilityLog() {
  const qc = useQueryClient();
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const mutation = useMutation({
    mutationFn: async (input: UpsertResponsabilityLogInput) => {
      const { data, error } = await supabase
        .from("responsibility_logs")
        .upsert(input, { onConflict: "report_id,responsibility_template_id" })
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
