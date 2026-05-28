import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type KpiCategoryDb = "financial" | "operational" | "customer" | "hr" | "custom";
export type ComparisonDirection = "higher_is_better" | "lower_is_better";

export interface KpiDefinitionFull {
  id: string;
  spa_id: string;
  name: string;
  name_en: string | null;
  name_es: string | null;
  unit: string | null;
  category: KpiCategoryDb;
  kpi_group: "spa" | "manager";
  display_order: number;
  is_active: boolean;
  threshold_amber: number | null;
  threshold_red: number | null;
  comparison_direction: ComparisonDirection;
  comment_guidance_fr: string | null;
}


export function useAllKpiDefinitions(spaId: string | null) {
  return useQuery({
    queryKey: ["kpi_definitions_all", spaId],
    enabled: !!spaId,
    queryFn: async (): Promise<KpiDefinitionFull[]> => {
      const { data, error } = await supabase
        .from("kpi_definitions")
        .select("*")
        .eq("spa_id", spaId!)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as KpiDefinitionFull[];
    },
  });
}

function invalidate(qc: ReturnType<typeof useQueryClient>, spaId: string) {
  qc.invalidateQueries({ queryKey: ["kpi_definitions_all", spaId] });
  qc.invalidateQueries({ queryKey: ["kpi_definitions", spaId] });
}

export interface AddKpiInput {
  spaId: string;
  name: string;
  unit: string | null;
  category: KpiCategoryDb;
  threshold_amber: number | null;
  threshold_red: number | null;
  comparison_direction: ComparisonDirection;
  display_order: number;
  created_by: string;
}

export function useAddKpiDefinition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AddKpiInput) => {
      const { error, data } = await supabase
        .from("kpi_definitions")
        .insert({
          spa_id: input.spaId,
          name: input.name,
          unit: input.unit,
          category: input.category,
          threshold_amber: input.threshold_amber,
          threshold_red: input.threshold_red,
          comparison_direction: input.comparison_direction,
          display_order: input.display_order,
          created_by: input.created_by,
          is_active: true,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => invalidate(qc, vars.spaId),
  });
}

export interface UpdateKpiInput {
  id: string;
  spaId: string;
  name?: string;
  unit?: string | null;
  category?: KpiCategoryDb;
  threshold_amber?: number | null;
  threshold_red?: number | null;
  comparison_direction?: ComparisonDirection;
  display_order?: number;
  is_active?: boolean;
}

export function useUpdateKpiDefinition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateKpiInput) => {
      const { id, spaId, ...fields } = input;
      const { error } = await supabase.from("kpi_definitions").update(fields).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => invalidate(qc, vars.spaId),
  });
}

export function useSoftDeleteKpiDefinition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; spaId: string }) => {
      const { error } = await supabase
        .from("kpi_definitions")
        .update({ is_active: false })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => invalidate(qc, vars.spaId),
  });
}
