import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type DbTodoPriority = "low" | "medium" | "high";
export type DbTodoStatus = "pending" | "in_progress" | "done" | "deferred";
export type DbTodoSource = "manual" | "ids_conversion" | "ai_suggestion";

export interface DbTodo {
  id: string;
  spa_id: string;
  report_id: string | null;
  title: string;
  description: string | null;
  status: DbTodoStatus;
  priority: DbTodoPriority;
  source: DbTodoSource;
  due_date: string | null;
  deferred_count: number;
  deferred_from_date: string | null;
  created_by: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TodoDescriptionMeta {
  responsible: string;
  followUp: string;
  originCycle?: string;
}

export function parseTodoDescription(raw: string | null): TodoDescriptionMeta {
  if (!raw) return { responsible: "", followUp: "" };
  try {
    const parsed = JSON.parse(raw);
    return {
      responsible: typeof parsed.responsible === "string" ? parsed.responsible : "",
      followUp: typeof parsed.followUp === "string" ? parsed.followUp : "",
      originCycle: typeof parsed.originCycle === "string" ? parsed.originCycle : undefined,
    };
  } catch {
    return { responsible: "", followUp: "" };
  }
}

export const priorityDbToUi = (p: DbTodoPriority): "critical" | "high" | "normal" => {
  if (p === "high") return "critical";
  if (p === "medium") return "high";
  return "normal";
};

export const priorityUiToDb = (p: "critical" | "high" | "normal"): DbTodoPriority => {
  if (p === "critical") return "high";
  if (p === "high") return "medium";
  return "low";
};

export const statusDbToUi = (s: DbTodoStatus): "pending" | "done" | "postponed" => {
  if (s === "done") return "done";
  if (s === "deferred") return "postponed";
  return "pending";
};

export const sourceDbToUi = (s: DbTodoSource): "ids" | "ia" | undefined => {
  if (s === "ids_conversion") return "ids";
  if (s === "ai_suggestion") return "ia";
  return undefined;
};

export function useTodos(reportId: string, spaId: string | null) {
  return useQuery({
    // Les todos sont au niveau du SPA (report-over carry). La clé suit donc spaId
    // (et non reportId) pour rester cohérente avec la requête et l'invalidation.
    queryKey: ["todos", spaId],
    enabled: !!spaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("todos")
        .select("*")
        .eq("spa_id", spaId!)
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as DbTodo[];
    },
  });
}

export function useAddTodo(reportId: string) {
  const qc = useQueryClient();
  const { spaId, user } = useAuth();
  return useMutation({
    mutationFn: async (input: {
      title: string;
      responsible: string;
      priority: "critical" | "high" | "normal";
      due_date: string | null;
    }) => {
      if (!spaId || !user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("todos")
        .insert({
          spa_id: spaId,
          report_id: reportId,
          title: input.title,
          description: JSON.stringify({ responsible: input.responsible, followUp: "" }),
          status: "pending" as DbTodoStatus,
          priority: priorityUiToDb(input.priority),
          source: "manual" as DbTodoSource,
          due_date: input.due_date,
          created_by: user.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["todos"] }),
  });
}

export function useAddTodoFromIds() {
  const qc = useQueryClient();
  const { spaId, user } = useAuth();
  return useMutation({
    mutationFn: async (input: {
      idsItemId: string;
      reportId: string;
      title: string;
      responsible: string;
      dueDate: string | null;
    }) => {
      if (!spaId || !user) throw new Error("Not authenticated");
      const { data: todo, error: e1 } = await supabase
        .from("todos")
        .insert({
          spa_id: spaId,
          report_id: input.reportId,
          created_by: user.id,
          title: input.title,
          description: JSON.stringify({
            responsible: input.responsible || "—",
            followUp: "",
          }),
          status: "pending" as DbTodoStatus,
          priority: "medium" as DbTodoPriority,
          source: "ids_conversion" as DbTodoSource,
          due_date: input.dueDate,
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
        .eq("id", input.idsItemId);
      if (e2) throw e2;
      return todo;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["ids_items", vars.reportId] });
      qc.invalidateQueries({ queryKey: ["todos"] });
    },
  });
}

export function useUpdateTodoStatus(reportId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; status: DbTodoStatus }) => {
      const patch: { status: DbTodoStatus; updated_at: string; completed_at?: string } = {
        status: input.status,
        updated_at: new Date().toISOString(),
      };
      if (input.status === "done") patch.completed_at = new Date().toISOString();
      const { error } = await supabase.from("todos").update(patch).eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["todos"] }),
  });
}

export function useUpdateTodoStatusWithComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      status: DbTodoStatus;
      comment: string;
      currentDescription: string | null;
    }) => {
      const meta = parseTodoDescription(input.currentDescription);
      const newDesc = JSON.stringify({
        ...meta,
        followUp: input.comment || meta.followUp,
      });
      const patch: {
        status: DbTodoStatus;
        description: string;
        updated_at: string;
        completed_at: string | null;
      } = {
        status: input.status,
        description: newDesc,
        updated_at: new Date().toISOString(),
        completed_at: input.status === "done" ? new Date().toISOString() : null,
      };
      const { error } = await supabase.from("todos").update(patch).eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["todos"] }),
  });
}

export function useUpdateFollowUp(reportId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; followUp: string; currentDescription: string | null }) => {
      const meta = parseTodoDescription(input.currentDescription);
      const next = JSON.stringify({ ...meta, followUp: input.followUp });
      const { error } = await supabase
        .from("todos")
        .update({ description: next, updated_at: new Date().toISOString() })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["todos"] }),
  });
}

export function useDeferTodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      reason: string;
      newDueDate: string;
      currentTodo: DbTodo;
      currentDescription: string | null;
    }) => {
      const meta = parseTodoDescription(input.currentDescription);
      const newDesc = JSON.stringify({ ...meta, followUp: input.reason });
      const { error } = await supabase
        .from("todos")
        .update({
          status: "deferred" as DbTodoStatus,
          description: newDesc,
          deferred_count: (input.currentTodo.deferred_count ?? 0) + 1,
          deferred_from_date: input.currentTodo.due_date,
          due_date: input.newDueDate,
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["todos"] }),
  });
}
