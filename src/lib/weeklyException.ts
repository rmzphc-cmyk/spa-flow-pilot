/**
 * Moteur d'exception partagé entre l'export PDF du weekly (useWeeklyPdfData)
 * et le digest Direction "Cette semaine" (useDirectionDigest).
 *
 * Source unique de vérité : le verdict, l'ordre de gravité des problèmes et
 * la liste des engagements non tenus DOIVENT être strictement identiques côté
 * PDF et côté web.
 */

import { parseObjectiveDescription } from "@/hooks/useObjectives";
import { computeObjectiveProgress } from "@/lib/objectiveProgress";
import { parseTodoDescription } from "@/hooks/useTodos";

export type ProblemSeverity =
  | "bloquant"
  | "deleguer"
  | "priorite"
  | "veille"
  | "untriaged";

export interface ExceptionProblem {
  text: string;
  severity: ProblemSeverity;
  /** Ce qui a été décidé : "To-do (...)", "Objectif (...)" ou null si non qualifié. */
  action: string | null;
}

export interface ExceptionCommitment {
  kind: "todo" | "objective";
  title: string;
  responsible: string;
  dueLabel: string;
  /** > 0 si l'échéance est dépassée (nb de jours de retard), 0 sinon. */
  lateDays: number;
  /** Détail chiffré (objectif : "11/15 · 73%"), "" pour un to-do. */
  detail: string;
  /** Nb de fois où le to-do a été reporté (0 si jamais / objectif). */
  deferredCount: number;
}

export interface ExceptionVerdict {
  level: "red" | "amber" | "green";
  blocking: number;
  overdue: number;
  atRisk: number;
}

export interface ExceptionResult {
  verdict: ExceptionVerdict;
  problems: ExceptionProblem[];
  commitmentsOverdue: ExceptionCommitment[];
  commitmentsAtRisk: ExceptionCommitment[];
}

export const SEVERITY_ORDER: ProblemSeverity[] = [
  "bloquant",
  "deleguer",
  "priorite",
  "veille",
  "untriaged",
];

export interface IdsItemInput {
  capture_text: string | null;
  triage_mode: string | null;
  converted_to_todo_id: string | null;
  converted_to_objective_id: string | null;
}

export interface TodoInput {
  id: string;
  title: string;
  description: string | null;
  status: string;
  due_date: string | null;
  deferred_count: number | null;
}

export interface ObjectiveInput {
  id: string;
  title: string;
  description: string | null;
  target_date: string | null;
}

export function formatDateFr(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

/** Identité par défaut — overridable par l'appelant PDF (cf. safeText). */
const identity = (s: string | null | undefined) => s ?? "";

export interface ComputeOptions {
  /** Fin de la semaine (inclusive). Sert à filtrer les engagements. */
  weekEnd: Date | null;
  /** Date "aujourd'hui" pour le calcul du retard. Défaut : now. */
  today?: Date;
  /** Hook d'assainissement texte (ex: safeText pour le PDF). */
  sanitize?: (s: string | null | undefined) => string;
  /** Hook de formattage date (ex: localisé). Défaut : FR court. */
  formatDate?: (iso: string | null | undefined) => string;
}

export function computeWeeklyException(
  ids: IdsItemInput[],
  todos: TodoInput[],
  objectives: ObjectiveInput[],
  options: ComputeOptions,
): ExceptionResult {
  const { weekEnd } = options;
  const sanitize = options.sanitize ?? identity;
  const fmtDate = options.formatDate ?? formatDateFr;
  const today = options.today ?? new Date();

  const todoById = new Map(todos.map((t) => [t.id, t]));
  const objectiveById = new Map(objectives.map((o) => [o.id, o]));

  const problems: ExceptionProblem[] = ids
    .map((it): ExceptionProblem => {
      let action: string | null = null;
      if (it.converted_to_todo_id) {
        const t = todoById.get(it.converted_to_todo_id);
        if (t) {
          const resp = parseTodoDescription(t.description).responsible;
          const parts = [resp, t.due_date ? fmtDate(t.due_date) : ""].filter(Boolean);
          action = "To-do" + (parts.length ? " (" + parts.join(" · ") + ")" : "");
        } else {
          action = "To-do";
        }
      } else if (it.converted_to_objective_id) {
        const o = objectiveById.get(it.converted_to_objective_id);
        action =
          "Objectif" +
          (o?.target_date ? " (cible " + fmtDate(o.target_date) + ")" : "");
      }
      return {
        text: sanitize(it.capture_text),
        severity: (it.triage_mode ?? "untriaged") as ProblemSeverity,
        action,
      };
    })
    .sort(
      (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
    );

  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const lateDaysOf = (iso: string): number => {
    const d = new Date(iso);
    const dOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    return Math.round((todayOnly.getTime() - dOnly.getTime()) / 86400000);
  };

  const commitmentsOverdue: ExceptionCommitment[] = [];
  const commitmentsAtRisk: ExceptionCommitment[] = [];

  for (const t of todos) {
    if (t.status === "done") continue;
    if (!t.due_date) continue;
    const due = new Date(t.due_date);
    if (weekEnd && due > weekEnd) continue;
    const late = lateDaysOf(t.due_date);
    const c: ExceptionCommitment = {
      kind: "todo",
      title: sanitize(t.title),
      responsible: parseTodoDescription(t.description).responsible || "—",
      dueLabel: fmtDate(t.due_date),
      lateDays: late > 0 ? late : 0,
      detail: "",
      deferredCount: t.deferred_count ?? 0,
    };
    if (late > 0) commitmentsOverdue.push(c);
    else commitmentsAtRisk.push(c);
  }

  for (const o of objectives) {
    if (!o.target_date) continue;
    const td = new Date(o.target_date);
    if (weekEnd && td > weekEnd) continue;
    const parsed = parseObjectiveDescription(o.description);
    const progress = computeObjectiveProgress(parsed.current, parsed.target, parsed.start);
    if (progress >= 100) continue;
    const late = lateDaysOf(o.target_date);
    const c: ExceptionCommitment = {
      kind: "objective",
      title: sanitize(o.title),
      responsible: "",
      dueLabel: fmtDate(o.target_date),
      lateDays: late > 0 ? late : 0,
      detail:
        parsed.current +
        "/" +
        parsed.target +
        (parsed.unit ? " " + parsed.unit : "") +
        " · " +
        progress +
        "%",
      deferredCount: 0,
    };
    if (late > 0) commitmentsOverdue.push(c);
    else commitmentsAtRisk.push(c);
  }

  commitmentsOverdue.sort((a, b) => b.lateDays - a.lateDays);

  const blocking = ids.filter((it) => it.triage_mode === "bloquant").length;
  const otherProblems = problems.filter((p) => p.severity !== "bloquant").length;
  const level: "red" | "amber" | "green" =
    blocking > 0 || commitmentsOverdue.length > 0
      ? "red"
      : commitmentsAtRisk.length > 0 || otherProblems > 0
        ? "amber"
        : "green";

  return {
    verdict: {
      level,
      blocking,
      overdue: commitmentsOverdue.length,
      atRisk: commitmentsAtRisk.length,
    },
    problems,
    commitmentsOverdue,
    commitmentsAtRisk,
  };
}
