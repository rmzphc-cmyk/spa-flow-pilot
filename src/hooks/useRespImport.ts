import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { RespImportPayload } from "@/lib/respExcel";

// Écriture batch de l'import des responsabilités (sémantique MERGE, 100 % upsert).
// INSERT pour les nouvelles (avec spa_id), UPSERT par id pour les existantes
// (sans spa_id, pour ne pas déplacer la responsabilité de spa).
export function useRespImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: RespImportPayload) => {
      if (p.newRows.length) {
        const { error } = await supabase
          .from("responsibility_templates")
          .insert(p.newRows as any);
        if (error) throw error;
      }
      if (p.updRows.length) {
        const { error } = await supabase
          .from("responsibility_templates")
          .upsert(p.updRows as any, { onConflict: "id" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all_resp_templates"] });
      qc.invalidateQueries({ queryKey: ["responsibility_templates"] });
    },
  });
}
