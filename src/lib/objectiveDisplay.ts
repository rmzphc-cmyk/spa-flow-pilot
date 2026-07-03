import { computeObjectiveProgress } from "./objectiveProgress";

/**
 * Résolution + méta d'affichage PARTAGÉES des cartes objectif (Phase 3).
 * Une seule logique pour les 3 rendus (SectionObjectifs, page /objectifs,
 * MeetingView) : colonnes réelles d'abord, blob legacy en repli, étapes
 * comptées en live pour le type projet, couleurs = tokens sémantiques.
 */

/** Sous-ensemble structurel de DbObjective — évite d'importer le hook (et le client Supabase) dans une lib pure. */
export interface ObjectiveNumbersSource {
  kind: string;
  metric: string | null;
  unit: string | null;
  start_value: number | null;
  target_value: number | null;
  current_value: number | null;
}

/** Sous-ensemble du blob description parsé (draft-mergé côté SectionObjectifs). */
export interface ParsedNumbersSource {
  metric: string;
  unit: string;
  start: number;
  target: number;
  current: number;
}

export interface StepDoneSource {
  is_done: boolean;
}

export interface ResolvedObjectiveDisplay {
  isProject: boolean;
  metric: string;
  unit: string;
  start: number;
  target: number;
  current: number;
  progress: number;
}

export function resolveObjectiveDisplay(
  obj: ObjectiveNumbersSource,
  parsed: ParsedNumbersSource,
  steps: StepDoneSource[],
): ResolvedObjectiveDisplay {
  const isProject = obj.kind === "steps";
  const unit = obj.unit ?? parsed.unit;
  const metric = obj.metric ?? parsed.metric;
  const target = isProject
    ? (steps.length > 0 ? steps.length : parsed.target)
    : (obj.target_value ?? parsed.target);
  const start = isProject ? 0 : (obj.start_value ?? parsed.start);
  const current = isProject
    ? (steps.length > 0 ? steps.filter((s) => s.is_done).length : parsed.current)
    : (obj.current_value ?? parsed.current);
  return {
    isProject,
    metric,
    unit,
    start,
    target,
    current,
    progress: computeObjectiveProgress(current, target, start),
  };
}

// ── Couleurs : une seule logique (décision B — le tag manuel fait foi) ──────

export type ObjectiveStatusUi = "on_track" | "at_risk" | "behind";

export interface ObjectiveStatusMeta {
  labelKey: string;
  badgeClass: string;
  barClass: string;
}

export const OBJECTIVE_STATUS_META: Record<ObjectiveStatusUi, ObjectiveStatusMeta> = {
  on_track: {
    labelKey: "objectifs.statusOnTrack",
    badgeClass: "bg-success text-success-foreground hover:bg-success",
    barClass: "bg-success",
  },
  at_risk: {
    labelKey: "objectifs.statusAtRisk",
    badgeClass: "bg-warning text-warning-foreground hover:bg-warning",
    barClass: "bg-warning",
  },
  behind: {
    labelKey: "objectifs.statusBehind",
    badgeClass: "bg-destructive text-destructive-foreground hover:bg-destructive",
    barClass: "bg-destructive",
  },
};

export function objectiveStatusMeta(statusUi: string): ObjectiveStatusMeta {
  return OBJECTIVE_STATUS_META[statusUi as ObjectiveStatusUi] ?? OBJECTIVE_STATUS_META.on_track;
}

// ── Échéance dépassée (O7) ──────────────────────────────────────────────────

/** Date du jour en yyyy-mm-dd LOCAL (pas d'UTC : décalerait d'un jour la nuit). */
export function localTodayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Vrai si l'objectif est actif avec une date cible strictement passée. */
export function isObjectiveOverdue(
  targetDate: string | null,
  status: string,
  todayIso: string = localTodayIso(),
): boolean {
  if (!targetDate || status !== "active") return false;
  return targetDate.slice(0, 10) < todayIso;
}

// ── Situation du journal (partagé avec MeetingView) ────────────────────────

export const SITUATION_EMOJI: Record<string, string> = {
  on_track: "🟢",
  complicated: "🟠",
  struggling: "🔴",
};
