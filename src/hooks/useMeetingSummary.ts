import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface MeetingSummaryRow {
  id: string;
  report_id: string;
  executive_summary: string | null;
  kpi_synthesis: string | null;
  management_synthesis: string | null;
  ids_synthesis: string | null;
  key_actions: string | null;
  model_used: string;
  generated_by_agent: string;
  language: string;
  tokens_used: number | null;
  manager_note: string | null;
  is_validated: boolean;
  validated_at: string | null;
  validated_by: string | null;
  generated_at: string;
  created_at: string;
  updated_at: string;
}

export function useMeetingSummary(reportId: string | undefined) {
  return useQuery({
    queryKey: ["meeting_summary", reportId],
    enabled: !!reportId,
    refetchInterval: (query) => (query.state.data == null ? 30000 : false),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meeting_summaries")
        .select("*")
        .eq("report_id", reportId!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as MeetingSummaryRow | null;
    },
  });
}

export function useGenerateMeetingSummary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { reportId: string }) => {
      const { data, error } = await supabase.functions.invoke("generate-meeting-summary", {
        body: { report_id: input.reportId },
      });
      if (error) throw new Error(data?.error ?? error.message ?? "Erreur génération");
      if (data?.error) throw new Error(data.error);
      return data.data as MeetingSummaryRow;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["meeting_summary", vars.reportId] });
    },
    onError: (e: Error) => {
      toast({ title: "Erreur synthèse IA", description: e.message, variant: "destructive" });
    },
  });
}
