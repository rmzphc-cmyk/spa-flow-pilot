import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { normalizeEfError, type ObjectiveKind } from "@/hooks/useObjectives";

export type IdsStatus = "captured" | "structured" | "converted" | "closed_no_action";
export type IdsCycleType = "weekly" | "monthly";

export type TriageMode = "bloquant" | "priorite" | "deleguer" | "veille";

export const TRIAGE_CONFIG: Record<TriageMode, {
  label: string;
  icon: string;
  color: string;
  textColor: string;
  borderColor: string;
  sentence: string;
  examples: string[];
  conversionHint: string;
}> = {
  bloquant: {
    label: "Bloquant",
    icon: "🔴",
    color: "bg-red-100",
    textColor: "text-red-800",
    borderColor: "border-red-300",
    sentence: "Ça impacte mes résultats directement et ça se passe maintenant",
    examples: [
      "Chute brutale d'un KPI prioritaire",
      "Cabine hors service",
      "Conflit ou absence équipe",
      "Plainte client non résolue",
    ],
    conversionHint: "Créer une To-Do urgente ?",
  },
  deleguer: {
    label: "Déléguer",
    icon: "🔵",
    color: "bg-blue-100",
    textColor: "text-blue-800",
    borderColor: "border-blue-300",
    sentence: "C'est pressant mais ce n'est pas à moi de le traiter",
    examples: [
      "Coordination avec l'hôtel",
      "Problème stock ou commande",
      "Demande RH ou administrative",
      "Tâche opérationnelle à assigner",
    ],
    conversionHint: "Créer une To-Do et assigner ?",
  },
  priorite: {
    label: "Priorité",
    icon: "🟡",
    color: "bg-amber-100",
    textColor: "text-amber-800",
    borderColor: "border-amber-300",
    sentence: "C'est important pour la performance mais ça se construit dans le temps",
    examples: [
      "Améliorer la captation",
      "Revoir l'offre ou le pricing",
      "Former l'équipe sur un process",
      "Développer un nouveau service",
    ],
    conversionHint: "Transformer en Objectif ?",
  },
  veille: {
    label: "Veille",
    icon: "⚫",
    color: "bg-gray-100",
    textColor: "text-gray-700",
    borderColor: "border-gray-300",
    sentence: "Utile à noter, aucune action immédiate nécessaire",
    examples: [
      "Tendance à surveiller sur la durée",
      "Retour client isolé",
      "Idée à creuser plus tard",
      "Signal faible à garder en mémoire",
    ],
    conversionHint: "",
  },
};

export interface DbIdsItem {
  id: string;
  report_id: string;
  spa_id: string;
  cycle_type: IdsCycleType;
  capture_text: string;
  status: IdsStatus;
  converted_to_todo_id: string | null;
  converted_to_objective_id: string | null;
  display_order: number;
  problem_statement?: string | null;
  root_cause?: string | null;
  proposed_solution?: string | null;
  resolution_notes?: string | null;
  resolution_type?: string | null;
  requires_solution?: boolean;
  triage_mode: TriageMode | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export function useIdsItems(reportId: string | undefined) {
  return useQuery({
    queryKey: ["ids_items", reportId],
    enabled: !!reportId,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ids_items")
        .select("*")
        .eq("report_id", reportId!)
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as DbIdsItem[];
    },
  });
}

export function useAddIdsItem(reportId: string, reportType: "monthly" | "weekly") {
  const qc = useQueryClient();
  const { spaId, user } = useAuth();
  return useMutation({
    mutationFn: async (captureText: string) => {
      if (!spaId || !user) throw new Error("Missing auth context");
      const existing = (qc.getQueryData<DbIdsItem[]>(["ids_items", reportId]) ?? []);
      const { data, error } = await supabase
        .from("ids_items")
        .insert({
          report_id: reportId,
          spa_id: spaId,
          cycle_type: reportType === "weekly" ? "weekly" : "monthly",
          capture_text: captureText,
          status: "captured",
          display_order: existing.length,
          created_by: user.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data as DbIdsItem;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ids_items", reportId] });
    },
  });
}

export interface ConvertIdsToTodoInput {
  item: DbIdsItem;
  /** Date d'échéance ISO (yyyy-mm-dd) ou null si sans date. */
  dueDate?: string | null;
  responsible?: string;
  /** Intitulé de l'action — optionnel ; vide → repli serveur sur capture_text. */
  title?: string;
}

export function useConvertIdsToTodo(reportId: string) {
  const qc = useQueryClient();
  return useMutation({
    // Passe par l'EF ids-convert (service_role) : la RLS interdit au manager
    // tout UPDATE d'un ids_item dont le rapport est verrouillé, ce qui faisait
    // échouer le lien de conversion en silence sur un weekly finalisé.
    mutationFn: async (input: ConvertIdsToTodoInput) => {
      const { data, error } = await supabase.functions.invoke("ids-convert", {
        body: {
          action: "convert_to_todo",
          ids_item_id: input.item.id,
          due_date: input.dueDate ?? null,
          responsible: (input.responsible ?? "").trim(),
          title: (input.title ?? "").trim() || undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ids_items", reportId] });
      // useTodos est indexé par spaId (["todos", spaId]) — invalider le préfixe.
      qc.invalidateQueries({ queryKey: ["todos"] });
      qc.invalidateQueries({ queryKey: ["ids_items_monthly_preview"] });
    },
  });
}

export interface ConvertIdsToObjectiveInput {
  item: DbIdsItem;
  /** Titre éditable de l'objectif — défaut serveur : capture_text de l'IDS. */
  title?: string;
  /** Date cible ISO (yyyy-mm-dd) ou null. */
  targetDate?: string | null;
  /** Nature de l'objectif — défaut serveur : numeric. */
  kind?: ObjectiveKind;
  metric?: string;
  unit?: string;
  startValue?: number;
  targetValue?: number;
  /** Étapes du projet (kind = steps). */
  steps?: string[];
}

/** Réponse de l'EF ids-convert — `already` = l'IDS était déjà converti. */
export interface ConvertIdsToObjectiveResult {
  already?: boolean;
  [key: string]: unknown;
}

export function useConvertIdsToObjective(reportId: string) {
  const qc = useQueryClient();
  const { spaId } = useAuth();
  return useMutation({
    mutationFn: async (
      input: ConvertIdsToObjectiveInput,
    ): Promise<ConvertIdsToObjectiveResult> => {
      const { data, error } = await supabase.functions.invoke("ids-convert", {
        body: {
          action: "convert_to_objective",
          ids_item_id: input.item.id,
          title: input.title,
          target_date: input.targetDate ?? null,
          kind: input.kind ?? "numeric",
          metric: input.metric,
          unit: input.unit,
          start_value: input.startValue,
          target_value: input.targetValue,
          steps: input.steps,
        },
      });
      // normalizeEfError extrait le code métier du corps de réponse
      // (ex. OBJECTIVE_LIMIT_REACHED en 409) — mappé en i18n côté dialog.
      if (error) throw await normalizeEfError(error);
      if (data?.error) throw new Error(data.error);
      return (data ?? {}) as ConvertIdsToObjectiveResult;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ids_items", reportId] });
      qc.invalidateQueries({ queryKey: ["objectives", spaId] });
      qc.invalidateQueries({ queryKey: ["ids_items_monthly_preview"] });
    },
  });
}

export interface IdsStructureInput {
  idsItemId: string;
  reportId: string;
  cause: string;
  solution: string;
}

export function useUpdateIdsStructure() {
  const qc = useQueryClient();
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const mutation = useMutation({
    mutationFn: async (input: IdsStructureInput) => {
      const status = input.solution.trim() ? "structured" : "captured";
      const { error } = await supabase
        .from("ids_items")
        .update({
          root_cause: input.cause,
          proposed_solution: input.solution,
          status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.idsItemId);
      if (error) throw error;
      return input;
    },
    onSuccess: (input) => {
      qc.invalidateQueries({ queryKey: ["ids_items", input.reportId] });
    },
  });

  const debouncedMutate = useCallback(
    (input: IdsStructureInput) => {
      const existing = timers.current.get(input.idsItemId);
      if (existing) clearTimeout(existing);
      const t = setTimeout(() => {
        mutation.mutate(input);
        timers.current.delete(input.idsItemId);
      }, 800);
      timers.current.set(input.idsItemId, t);
    },
    [mutation],
  );

  return { mutate: debouncedMutate, isPending: mutation.isPending };
}

export function useUpdateIdsTriage(reportId: string) {
  const qc = useQueryClient();
  return useMutation({
    // Via l'EF : le triage doit persister même quand le weekly source est
    // verrouillé (cas du tri pendant la réunion mensuelle).
    mutationFn: async ({
      id,
      triage_mode,
    }: {
      id: string;
      triage_mode: TriageMode | null;
    }) => {
      const { data, error } = await supabase.functions.invoke("ids-convert", {
        body: { action: "set_triage", ids_item_id: id, triage_mode },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ids_items", reportId] });
      qc.invalidateQueries({ queryKey: ["ids_items_monthly_preview"] });
    },
  });
}

export interface DbIdsItemWithReport extends DbIdsItem {
  report_cycle_label: string;
  report_period_start: string;
}

export function useIdsItemsForMonthlyPeriod(
  spaId: string | undefined,
  periodStart: string | undefined,
  periodEnd: string | undefined,
) {
  const weeklyReportsQ = useQuery({
    queryKey: ["reports_weekly_in_month", spaId, periodStart, periodEnd],
    enabled: !!spaId && !!periodStart && !!periodEnd,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("id, cycle_label, period_start")
        .eq("spa_id", spaId!)
        .eq("cycle_type", "weekly")
        .gte("period_start", periodStart!)
        .lte("period_start", periodEnd!);
      if (error) throw error;
      return data ?? [];
    },
  });

  const weeklyReports = weeklyReportsQ.data ?? [];
  const reportIds = weeklyReports.map((r) => r.id);

  const idsQ = useQuery({
    queryKey: ["ids_items_monthly_preview", reportIds.join(",")],
    enabled: reportIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ids_items")
        .select("*")
        .in("report_id", reportIds)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const items = (data ?? []) as DbIdsItem[];
      const reportMap = new Map(weeklyReports.map((r) => [r.id, r]));
      return items.map((item) => ({
        ...item,
        report_cycle_label: reportMap.get(item.report_id)?.cycle_label ?? "",
        report_period_start: reportMap.get(item.report_id)?.period_start ?? "",
      })) as DbIdsItemWithReport[];
    },
  });

  return {
    data: idsQ.data ?? [],
    isLoading: weeklyReportsQ.isLoading || (reportIds.length > 0 && idsQ.isLoading),
    weeklyReports,
  };
}
