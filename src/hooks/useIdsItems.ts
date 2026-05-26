import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
