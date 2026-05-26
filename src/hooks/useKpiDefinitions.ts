import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface KpiDefinitionRow {
  id: string;
  name: string;
  name_en: string | null;
  name_es: string | null;
  unit: string | null;
  category: string;
  display_order: number;
  threshold_amber: number | null;
  threshold_red: number | null;
  comparison_direction: "higher_is_better" | "lower_is_better";
  comment_guidance_fr: string | null;
  comment_guidance_en: string | null;
  comment_guidance_es: string | null;
}

export function useKpiDefinitions(spaId: string | null) {
  return useQuery({
    queryKey: ["kpi_definitions", spaId],
    enabled: !!spaId,
    queryFn: async (): Promise<KpiDefinitionRow[]> => {
      const { data, error } = await supabase
        .from("kpi_definitions")
        .select(
          "id, name, name_en, name_es, unit, category, display_order, threshold_amber, threshold_red, comparison_direction, comment_guidance_fr, comment_guidance_en, comment_guidance_es",
        )
        .eq("spa_id", spaId!)
        .eq("is_active", true)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as KpiDefinitionRow[];
    },
  });
}
