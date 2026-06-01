import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type IdsStatus = "captured" | "structured" | "converted" | "closed_no_action";
export type IdsCycleType = "weekly" | "monthly";

export interface DbIdsItem {
  id: string;
  report_id: string;
  spa_id: string;
  cycle_type: IdsCycleType;
  capture_text: string;
  status: IdsStatus;
  converted_to_todo_id: string | null;
  converted_to_objective_id: string | null;
  display_order: number;
  problem_statement?: string | null;
  root_cause?: string | null;
  proposed_solution?: string | null;
  resolution_notes?: string | null;
  resolution_type?: string | null;
  requires_solution?: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export function useIdsItems(reportId: string | undefined) {
  return useQuery({
    queryKey: ["ids_items", reportId],
    enabled: !!reportId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ids_items")
        .select("*")
        .eq("report_id", reportId!)
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as DbIdsItem[];
    },
  });
}

export function useAddIdsItem(reportId: string, reportType: "monthly" | "weekly") {
  const qc = useQueryClient();
  const { spaId, user } = useAuth();
  return useMutation({
    mutationFn: async (captureText: string) => {
      if (!spaId || !user) throw new Error("Missing auth context");
      const existing = (qc.getQueryData<DbIdsItem[]>(["ids_items", reportId]) ?? []);
      const { data, error } = await supabase
        .from("ids_items")
        .insert({
          report_id: reportId,
          spa_id: spaId,
          cycle_type: reportType === "weekly" ? "weekly" : "monthly",
          capture_text: captureText,
          status: "captured",
          display_order: existing.length,
          created_by: user.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data as DbIdsItem;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ids_items", reportId] });
    },
  });
}

export function useConvertIdsToTodo(reportId: string) {
  const qc = useQueryClient();
  const { spaId, user } = useAuth();
  return useMutation({
    mutationFn: async (item: DbIdsItem) => {
      if (!spaId || !user) throw new Error("Missing auth context");
      const { data: todo, error: e1 } = await supabase
        .from("todos")
        .insert({
          spa_id: spaId,
          report_id: reportId,
          title: item.capture_text,
          status: "pending",
          priority: "medium",
          source: "ids_conversion",
          ids_item_id: item.id,
          created_by: user.id,
        })
        .select()
        .single();
      if (e1) throw e1;
      const { error: e2 } = await supabase
        .from("ids_items")
        .update({
          converted_to_todo_id: todo.id,
          status: "converted",
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);
      if (e2) throw e2;
      return todo;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ids_items", reportId] });
      qc.invalidateQueries({ queryKey: ["todos", reportId] });
    },
  });
}

export function useConvertIdsToObjective(reportId: string) {
  const qc = useQueryClient();
  const { spaId, user } = useAuth();
  return useMutation({
    mutationFn: async (item: DbIdsItem) => {
      if (!spaId || !user) throw new Error("Missing auth context");
      const { data: obj, error: e1 } = await supabase
        .from("objectives")
        .insert({
          spa_id: spaId,
          report_id_created: reportId,
          title: item.capture_text,
          status: "active",
          source: "ids_conversion",
          ids_item_id: item.id,
          created_by: user.id,
        })
        .select()
        .single();
      if (e1) throw e1;
      const { error: e2 } = await supabase
        .from("ids_items")
        .update({
          converted_to_objective_id: obj.id,
          status: "converted",
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);
      if (e2) throw e2;
      return obj;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ids_items", reportId] });
      qc.invalidateQueries({ queryKey: ["objectives", spaId] });
    },
  });
}

export interface IdsStructureInput {
  idsItemId: string;
  reportId: string;
  cause: string;
  solution: string;
}

export function useUpdateIdsStructure() {
  const qc = useQueryClient();
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const mutation = useMutation({
    mutationFn: async (input: IdsStructureInput) => {
      const status = input.solution.trim() ? "structured" : "captured";
      const { error } = await supabase
        .from("ids_items")
        .update({
          root_cause: input.cause,
          proposed_solution: input.solution,
          status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.idsItemId);
      if (error) throw error;
      return input;
    },
    onSuccess: (input) => {
      qc.invalidateQueries({ queryKey: ["ids_items", input.reportId] });
    },
  });

  const debouncedMutate = useCallback(
    (input: IdsStructureInput) => {
      const existing = timers.current.get(input.idsItemId);
      if (existing) clearTimeout(existing);
      const t = setTimeout(() => {
        mutation.mutate(input);
        timers.current.delete(input.idsItemId);
      }, 800);
      timers.current.set(input.idsItemId, t);
    },
    [mutation],
  );

  return { mutate: debouncedMutate, isPending: mutation.isPending };
}

export interface DbIdsItemWithReport extends DbIdsItem {
  report_cycle_label: string;
  report_period_start: string;
}

export function useIdsItemsForMonthlyPeriod(
  spaId: string | undefined,
  periodStart: string | undefined,
  periodEnd: string | undefined,
) {
  const weeklyReportsQ = useQuery({
    queryKey: ["reports_weekly_in_month", spaId, periodStart, periodEnd],
    enabled: !!spaId && !!periodStart && !!periodEnd,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("id, cycle_label, period_start")
        .eq("spa_id", spaId!)
        .eq("cycle_type", "weekly")
        .gte("period_start", periodStart!)
        .lte("period_start", periodEnd!);
      if (error) throw error;
      return data ?? [];
    },
  });

  const weeklyReports = weeklyReportsQ.data ?? [];
  const reportIds = weeklyReports.map((r) => r.id);

  const idsQ = useQuery({
    queryKey: ["ids_items_monthly_preview", reportIds.join(",")],
    enabled: reportIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ids_items")
        .select("*")
        .in("report_id", reportIds)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const items = (data ?? []) as DbIdsItem[];
      const reportMap = new Map(weeklyReports.map((r) => [r.id, r]));
      return items.map((item) => ({
        ...item,
        report_cycle_label: reportMap.get(item.report_id)?.cycle_label ?? "",
        report_period_start: reportMap.get(item.report_id)?.period_start ?? "",
      })) as DbIdsItemWithReport[];
    },
  });

  return {
    data: idsQ.data ?? [],
    isLoading: weeklyReportsQ.isLoading || (reportIds.length > 0 && idsQ.isLoading),
    weeklyReports,
  };
}
