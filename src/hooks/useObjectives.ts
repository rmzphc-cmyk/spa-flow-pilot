import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface ParsedObjectiveDescription {
  metric: string;
  target: number;
  unit: string;
  current: number;
  /** Valeur de départ (baseline) — les blobs legacy ne l'ont pas → défaut 0. */
  start: number;
  status_ui: "on_track" | "at_risk" | "behind";
  comment: string;
}

export const defaultDescription: ParsedObjectiveDescription = {
  metric: "",
  target: 0,
  unit: "",
  current: 0,
  start: 0,
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
      start: typeof p.start === "number" ? p.start : 0,
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

/** Nature d'un objectif : chiffré (indicateur départ→cible) ou projet (étapes). */
export type ObjectiveKind = "numeric" | "steps";

/** Limite d'objectifs actifs par spa (décision C — appliquée UI + serveur). */
export const MAX_ACTIVE_OBJECTIVES = 3;

/** Code d'erreur renvoyé par le trigger serveur quand la limite est atteinte. */
export const OBJECTIVE_LIMIT_ERROR = "OBJECTIVE_LIMIT_REACHED";

/** Vrai si l'erreur correspond à la limite de 3 objectifs actifs (HTTP 409 EF). */
export function isObjectiveLimitError(error: unknown): boolean {
  return error instanceof Error && error.message.includes(OBJECTIVE_LIMIT_ERROR);
}

/** Vrai si l'EF a refusé un objectif chiffré dont la cible égale le départ (HTTP 400). */
export function isTargetEqualsStartError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("TARGET_EQUALS_START");
}

/**
 * Normalise l'erreur d'une invocation d'Edge Function : sur un non-2xx,
 * supabase-js renvoie un FunctionsHttpError générique (data=null) — le vrai
 * code métier (ex. OBJECTIVE_LIMIT_REACHED en 409) est dans le corps JSON de
 * la réponse, accessible via error.context.
 */
export async function normalizeEfError(error: unknown): Promise<Error> {
  const ctx = (error as { context?: Response } | null)?.context;
  if (ctx && typeof ctx.clone === "function") {
    try {
      const text = await ctx.clone().text();
      if (text) {
        try {
          const parsed = JSON.parse(text);
          const msg = parsed?.error ?? parsed?.message;
          if (typeof msg === "string" && msg) return new Error(msg);
        } catch {
          return new Error(text);
        }
      }
    } catch {
      // Corps illisible : on retombe sur l'erreur d'origine.
    }
  }
  return error instanceof Error ? error : new Error(String(error));
}

export interface DbObjective {
  id: string;
  spa_id: string;
  /** Nullable depuis la Phase 1 : la création directe n'a pas de rapport source. */
  report_id_created: string | null;
  created_by: string;
  title: string;
  description: string | null;
  status: string;
  source: string | null;
  target_date: string | null;
  // Colonnes réelles Phase 0 (remplacent progressivement le blob description)
  kind: ObjectiveKind;
  metric: string | null;
  unit: string | null;
  start_value: number | null;
  target_value: number | null;
  current_value: number | null;
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
  /** Dual-write : synchronise la colonne réelle avec le `current` du blob (chiffré). */
  currentValue?: number;
}

export function useUpdateObjectiveProgress() {
  const qc = useQueryClient();
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const mutation = useMutation({
    mutationFn: async (input: UpdateObjectiveInput) => {
      const patch: { description: string; updated_at: string; current_value?: number } = {
        description: input.description,
        updated_at: new Date().toISOString(),
      };
      if (input.currentValue !== undefined && Number.isFinite(input.currentValue)) {
        patch.current_value = input.currentValue;
      }
      const { error } = await supabase
        .from("objectives")
        .update(patch)
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

export interface CreateObjectiveInput {
  title: string;
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

export type CloseObjectiveStatus = "achieved" | "abandoned";

export interface CloseObjectiveInput {
  objectiveId: string;
  spaId: string;
  status: CloseObjectiveStatus;
}

/**
 * Clôture d'un objectif actif (atteint ou abandonné) — libère un slot de la
 * limite de 3 actifs. Update client direct : la RLS autorise déjà le manager
 * à modifier les objectifs de son spa (cf. useUpdateObjectiveProgress).
 */
export function useCloseObjective() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CloseObjectiveInput) => {
      const patch: {
        status: CloseObjectiveStatus;
        updated_at: string;
        achieved_at?: string;
      } = {
        status: input.status,
        updated_at: new Date().toISOString(),
      };
      if (input.status === "achieved") patch.achieved_at = new Date().toISOString();
      const { error } = await supabase
        .from("objectives")
        .update(patch)
        .eq("id", input.objectiveId);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["objectives", vars.spaId] });
    },
  });
}

// ── Journal weekly + étapes (Phase 2) ───────────────────────────────────────

export type ObjectiveSituation = "on_track" | "complicated" | "struggling";

export interface DbObjectiveUpdate {
  id: string;
  objective_id: string;
  spa_id: string;
  report_id: string | null;
  created_by: string;
  action_text: string | null;
  value: number | null;
  situation: ObjectiveSituation | null;
  created_at: string;
}

export interface DbObjectiveStep {
  id: string;
  objective_id: string;
  spa_id: string;
  label: string;
  is_done: boolean;
  display_order: number;
  created_at: string;
}

/**
 * Journal de TOUS les objectifs du spa en une requête (les sections groupent
 * ensuite par objective_id) — évite N requêtes par carte.
 */
export function useSpaObjectiveUpdates(spaId: string | null) {
  return useQuery({
    queryKey: ["objective_updates", spaId],
    enabled: !!spaId,
    queryFn: async (): Promise<DbObjectiveUpdate[]> => {
      const { data, error } = await supabase
        .from("objective_updates")
        .select("*")
        .eq("spa_id", spaId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DbObjectiveUpdate[];
    },
  });
}

/** Étapes de tous les objectifs du spa (type projet), ordonnées. */
export function useSpaObjectiveSteps(spaId: string | null) {
  return useQuery({
    queryKey: ["objective_steps", spaId],
    enabled: !!spaId,
    queryFn: async (): Promise<DbObjectiveStep[]> => {
      const { data, error } = await supabase
        .from("objective_steps")
        .select("*")
        .eq("spa_id", spaId!)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as DbObjectiveStep[];
    },
  });
}

export interface AddObjectiveUpdateInput {
  objectiveId: string;
  spaId: string;
  /** Requis pour un objectif chiffré ; « ressenti » optionnel pour un projet. */
  situation: ObjectiveSituation | null;
  actionText?: string;
  value?: number | null;
  reportId?: string | null;
}

/**
 * Ajout d'une entrée de journal — via l'EF ids-convert (service_role) : un
 * insert client lié à un weekly verrouillé serait perdu en silence (bug IDS
 * bis). Le journal est transversal aux cycles, l'EF n'a pas de garde is_locked.
 */
export function useAddObjectiveUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AddObjectiveUpdateInput) => {
      const { data, error } = await supabase.functions.invoke("ids-convert", {
        body: {
          action: "add_objective_update",
          objective_id: input.objectiveId,
          situation: input.situation,
          action_text: input.actionText ?? null,
          value: input.value ?? null,
          report_id: input.reportId ?? null,
        },
      });
      if (error) throw await normalizeEfError(error);
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["objective_updates", vars.spaId] });
      // La valeur du journal met à jour current_value + blob (dual-write EF).
      qc.invalidateQueries({ queryKey: ["objectives", vars.spaId] });
    },
  });
}

export interface ToggleObjectiveStepInput {
  stepId: string;
  spaId: string;
  isDone: boolean;
}

/** Coche/décoche une étape — via EF pour le dual-write du blob « x/N ». */
export function useToggleObjectiveStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ToggleObjectiveStepInput) => {
      const { data, error } = await supabase.functions.invoke("ids-convert", {
        body: {
          action: "toggle_objective_step",
          step_id: input.stepId,
          is_done: input.isDone,
        },
      });
      if (error) throw await normalizeEfError(error);
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["objective_steps", vars.spaId] });
      qc.invalidateQueries({ queryKey: ["objectives", vars.spaId] });
    },
  });
}

/**
 * Création directe d'un objectif (décision A — chemin secondaire).
 * Passe par l'EF ids-convert (service_role) : c'est elle qui porte la garde
 * de limite serveur et le dual-write legacy — jamais d'insert client direct.
 */
export function useCreateObjective() {
  const qc = useQueryClient();
  const { spaId } = useAuth();
  return useMutation({
    mutationFn: async (input: CreateObjectiveInput) => {
      const { data, error } = await supabase.functions.invoke("ids-convert", {
        body: {
          action: "create_objective",
          title: input.title,
          target_date: input.targetDate ?? null,
          kind: input.kind ?? "numeric",
          metric: input.metric,
          unit: input.unit,
          start_value: input.startValue,
          target_value: input.targetValue,
          steps: input.steps,
          // Ignoré côté serveur pour un spa_manager (spa dérivé de sa ligne
          // users) ; requis pour un admin.
          spa_id: spaId ?? undefined,
        },
      });
      if (error) throw await normalizeEfError(error);
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["objectives", spaId] });
    },
  });
}
