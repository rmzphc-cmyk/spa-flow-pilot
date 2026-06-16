import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type KpiRole = "therapist" | "spa_concierge" | "spa_manager" | "ambassador";
export type KpiNiveau = "prioritaire" | "secondaire" | "suivi";

export interface KpiRoleAssignment {
  id: string;
  kpi_definition_id: string;
  role: KpiRole;
  niveau: KpiNiveau;
  created_at: string;
}

export const ROLE_LABELS: Record<KpiRole, string> = {
  therapist: "Thérapeute",
  spa_concierge: "Concierge",
  spa_manager: "Manager",
  ambassador: "Ambassadeur",
};

export const NIVEAU_LABELS: Record<KpiNiveau, string> = {
  prioritaire: "Prioritaire",
  secondaire: "Secondaire",
  suivi: "Suivi",
};

export const NIVEAU_COLORS: Record<KpiNiveau, string> = {
  prioritaire: "bg-teal-100 text-teal-800 border-teal-300",
  secondaire: "bg-blue-100 text-blue-800 border-blue-300",
  suivi: "bg-gray-100 text-gray-700 border-gray-300",
};

export function useKpiRoleAssignments(kpiIds: string[]) {
  return useQuery({
    queryKey: ["kpi_role_assignments", kpiIds],
    enabled: kpiIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kpi_role_assignments")
        .select("*")
        .in("kpi_definition_id", kpiIds)
        .order("niveau");
      if (error) throw error;
      return (data ?? []) as KpiRoleAssignment[];
    },
  });
}

export function useUpsertKpiRoleAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      kpi_definition_id: string;
      role: KpiRole;
      niveau: KpiNiveau;
    }) => {
      const { error } = await supabase
        .from("kpi_role_assignments")
        .upsert(input, { onConflict: "kpi_definition_id,role" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kpi_role_assignments"] });
    },
  });
}

// Réassignation de RÔLE d'une assignation existante : on remplace, on n'empile pas.
// La clé d'unicité étant (kpi_definition_id, role), changer le rôle via un simple
// upsert créerait une 2e ligne (orphelin) → le KPI s'afficherait sous deux rôles.
// Ici on upsert le nouveau couple PUIS on supprime l'ancienne ligne par id.
export function useReassignKpiRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      oldId: string;
      kpi_definition_id: string;
      role: KpiRole;
      niveau: KpiNiveau;
    }) => {
      const { error: upErr } = await supabase
        .from("kpi_role_assignments")
        .upsert(
          { kpi_definition_id: input.kpi_definition_id, role: input.role, niveau: input.niveau },
          { onConflict: "kpi_definition_id,role" },
        );
      if (upErr) throw upErr;
      const { error: delErr } = await supabase
        .from("kpi_role_assignments")
        .delete()
        .eq("id", input.oldId);
      if (delErr) throw delErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kpi_role_assignments"] });
    },
    onError: (e: Error) => {
      toast.error(e.message || "Impossible de réassigner le rôle");
    },
  });
}

export function useDeleteKpiRoleAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error, count } = await supabase
        .from("kpi_role_assignments")
        .delete({ count: "exact" })
        .eq("id", id);
      if (error) throw error;
      if (!count) {
        // RLS (migration 20260605164648) autorise admin OU spa_manager du spa
        // concerné. 0 ligne = l'appelant n'a pas ce droit sur cette assignation.
        throw new Error(
          "Suppression refusée : droits insuffisants sur cette assignation."
        );
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kpi_role_assignments"] });
      toast.success("Assignation supprimée");
    },
    onError: (e: Error) => {
      toast.error(e.message || "Impossible de supprimer l'assignation");
    },
  });
}
