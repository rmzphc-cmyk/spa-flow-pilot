import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { KpiImportPayload } from "@/lib/kpiExcel";

// Écriture batch de l'import KPI (sémantique MERGE, 100 % upsert).
//
// On sépare volontairement INSERT (nouveaux KPI) et UPSERT (KPI existants) :
//  • les nouveaux portent spa_id + created_by ;
//  • les existants n'incluent NI spa_id NI created_by, pour ne pas écraser
//    l'auteur d'origine ni déplacer le KPI de spa (PostgREST n'update que les
//    colonnes présentes dans le payload).
// Au plus 4 requêtes — quasi-atomique par table.
export function useKpiImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: KpiImportPayload) => {
      if (p.newKpis.length) {
        const { error } = await supabase.from("kpi_definitions").insert(p.newKpis as any);
        if (error) throw error;
      }
      if (p.updKpis.length) {
        const { error } = await supabase
          .from("kpi_definitions")
          .upsert(p.updKpis as any, { onConflict: "id" });
        if (error) throw error;
      }
      if (p.objectives.length) {
        const { error } = await supabase
          .from("kpi_monthly_targets")
          .upsert(p.objectives as any, { onConflict: "spa_id,kpi_definition_id,year_month" });
        if (error) throw error;
      }
      if (p.assignments.length) {
        const { error } = await supabase
          .from("kpi_role_assignments")
          .upsert(p.assignments as any, { onConflict: "kpi_definition_id,role" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kpi_definitions_all"] });
      qc.invalidateQueries({ queryKey: ["kpi_definitions"] });
      qc.invalidateQueries({ queryKey: ["kpi_monthly_targets"] });
      qc.invalidateQueries({ queryKey: ["kpi_threshold_history"] });
      qc.invalidateQueries({ queryKey: ["kpi_role_assignments"] });
    },
  });
}
