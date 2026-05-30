import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CheckinRow {
  id: string;
  report_id: string;
  mood_score: number;
  focus_level: number;
  key_context: string | null;
}

export interface CheckinKeyContext {
  equipeComment?: string;
  managerComment?: string;
  situation?: string;
  note?: string;
  free_note?: string;
}

export function parseKeyContext(raw: string | null | undefined): CheckinKeyContext {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    const p = parsed as Record<string, unknown>;
    return {
      ...p,
      free_note: typeof p.free_note === "string" ? p.free_note : undefined,
    } as CheckinKeyContext;
  } catch {
    return {};
  }
}

export function useCheckin(reportId: string | undefined) {
  return useQuery({
    queryKey: ["checkins", reportId],
    enabled: !!reportId,
    queryFn: async (): Promise<CheckinRow | null> => {
      const { data, error } = await supabase
        .from("checkins")
        .select("id, report_id, mood_score, focus_level, key_context")
        .eq("report_id", reportId!)
        .maybeSingle();
      if (error) throw error;
      return (data as CheckinRow | null) ?? null;
    },
  });
}

export interface UpsertCheckinInput {
  report_id: string;
  mood_score: number;
  focus_level: number;
  key_context: CheckinKeyContext;
}

export function useUpsertCheckin() {
  const qc = useQueryClient();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mutation = useMutation({
    mutationFn: async (input: UpsertCheckinInput) => {
      const payload = {
        report_id: input.report_id,
        mood_score: input.mood_score,
        focus_level: input.focus_level,
        key_context: JSON.stringify(input.key_context ?? {}),
      };
      const { data, error } = await supabase
        .from("checkins")
        .upsert(payload, { onConflict: "report_id" })
        .select()
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["checkins", vars.report_id] });
    },
  });

  const debouncedUpsert = useCallback(
    (input: UpsertCheckinInput) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        mutation.mutate(input);
      }, 800);
    },
    [mutation],
  );

  return { ...mutation, debouncedUpsert };
}
