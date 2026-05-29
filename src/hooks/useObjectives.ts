import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface ParsedObjectiveDescription {
  metric: string;
  target: number;
  unit: string;
  current: number;
  status_ui: "on_track" | "at_risk" | "behind";
  comment: string;
}

export const defaultDescription: ParsedObjectiveDescription = {
  metric: "",
  target: 0,
  unit: "",
  current: 0,
  status_ui: "on_track",
  comment: "",
};

export function parseObjectiveDescription(raw: string | null): ParsedObjectiveDescription {
  if (!raw) return { ...defaultDescription };
  try {
    const p = JSON.parse(raw);
    return {
      metric: typeof p.metric === "string" ? p.metric : "",
      target: typeof p.target === "number" ? p.target : 0,
      unit: typeof p.unit === "string" ? p.unit : "",
      current: typeof p.current === "number" ? p.current : 0,
      status_ui: ["on_track", "at_risk", "behind"].includes(p.status_ui) ? p.status_ui : "on_track",
      comment: typeof p.comment === "string" ? p.comment : "",
    };
  } catch {
    return { ...defaultDescription };
  }
}

export function stringifyObjectiveDescription(parsed: ParsedObjectiveDescription): string {
  return JSON.stringify(parsed);
}

export interface DbObjective {
  id: string;
  spa_id: string;
  report_id_created: string;
  created_by: string;
  title: string;
  description: string | null;
  status: string;
  source: string | null;
  target_date: string | null;
  created_at: string;
  updated_at: string;
}

export function useObjectives(spaId: string | null) {
  return useQuery({
    queryKey: ["objectives", spaId],
    enabled: !!spaId,
    queryFn: async (): Promise<DbObjective[]> => {
      const { data, error } = await supabase
        .from("objectives")
        .select("*")
        .eq("spa_id", spaId!)
        .eq("status", "active")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as DbObjective[];
    },
  });
}

export interface UpdateObjectiveInput {
  objectiveId: string;
  spaId: string;
  description: string;
}

export function useUpdateObjectiveProgress() {
  const qc = useQueryClient();
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const mutation = useMutation({
    mutationFn: async (input: UpdateObjectiveInput) => {
      const { error } = await supabase
        .from("objectives")
        .update({ description: input.description, updated_at: new Date().toISOString() })
        .eq("id", input.objectiveId);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["objectives", vars.spaId] });
    },
  });

  const debouncedUpdate = useCallback(
    (input: UpdateObjectiveInput) => {
      if (timers.current[input.objectiveId]) clearTimeout(timers.current[input.objectiveId]);
      timers.current[input.objectiveId] = setTimeout(() => {
        mutation.mutate(input);
      }, 800);
    },
    [mutation],
  );

  const immediateUpdate = useCallback(
    (input: UpdateObjectiveInput) => {
      if (timers.current[input.objectiveId]) {
        clearTimeout(timers.current[input.objectiveId]);
        delete timers.current[input.objectiveId];
      }
      mutation.mutate(input);
    },
    [mutation],
  );

  return { ...mutation, debouncedUpdate, immediateUpdate };
}

export function useAddObjectiveFromIds() {
  const qc = useQueryClient();
  const { spaId, user } = useAuth();
  return useMutation({
    mutationFn: async (input: {
      idsItemId: string;
      reportId: string;
      title: string;
      targetDate: string | null;
    }) => {
      if (!spaId || !user) throw new Error("Not authenticated");
      const { data: obj, error: e1 } = await supabase
        .from("objectives")
        .insert({
          spa_id: spaId,
          report_id_created: input.reportId,
          created_by: user.id,
          title: input.title,
          status: "active",
          source: "ids_conversion",
          target_date: input.targetDate,
          description: JSON.stringify({
            metric: "",
            target: 0,
            unit: "",
            current: 0,
            status_ui: "on_track",
            comment: "",
          }),
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
        .eq("id", input.idsItemId);
      if (e2) throw e2;
      return obj;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["ids_items", vars.reportId] });
      qc.invalidateQueries({ queryKey: ["objectives", spaId] });
    },
  });
}
