import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Database } from "@/integrations/supabase/types";
import type { ReportRecord, ReportType, ReportState } from "@/lib/reportsStore";

export type ReportRow = Database["public"]["Tables"]["reports"]["Row"];
export type ReportInsert = Database["public"]["Tables"]["reports"]["Insert"];

const FR_DATE = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });

export function mapReportRowToRecord(row: ReportRow): ReportRecord {
  const start = new Date(row.period_start);
  const end = new Date(row.period_end);
  return {
    id: row.id,
    type: row.cycle_type as ReportType,
    label: row.cycle_label,
    period: `${FR_DATE.format(start)} → ${FR_DATE.format(end)}`,
    state: row.status as ReportState,
    updatedAt: row.updated_at,
    meetingDate: row.meeting_started_at
      ? FR_DATE.format(new Date(row.meeting_started_at))
      : null,
    completion: row.status === "validated" ? 100 : 0,
  };
}

export function useReports() {
  const { spaId, userRole } = useAuth();

  return useQuery({
    queryKey: ["reports", userRole === "admin" ? "all" : spaId],
    queryFn: async () => {
      let query = supabase.from("reports").select("*").order("created_at", { ascending: false });
      if (userRole !== "admin" && spaId) {
        query = query.eq("spa_id", spaId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    enabled: userRole === "admin" || !!spaId,
  });
}

export function useReport(id: string | undefined) {
  return useQuery({
    queryKey: ["report", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase.from("reports").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

export interface CreateReportInput {
  cycle_type: ReportType;
  cycle_label: string;
  period_start: string; // ISO date
  period_end: string;
}

export function useCreateReport() {
  const qc = useQueryClient();
  const { spaId, user } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateReportInput) => {
      if (!spaId) throw new Error("Aucun spa associé à l'utilisateur");
      if (!user) throw new Error("Utilisateur non authentifié");
      const { data, error } = await supabase.functions.invoke("create-report-cycle", {
        body: {
          spa_id: spaId,
          cycle_type: input.cycle_type,
          cycle_label: input.cycle_label,
          period_start: input.period_start,
          period_end: input.period_end,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data.data as ReportRow;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reports"] });
    },
  });
}
