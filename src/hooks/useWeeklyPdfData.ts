import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useKpiEntries } from "@/hooks/useKpiEntries";
import { useKpiDefinitions } from "@/hooks/useKpiDefinitions";
import { useCheckin, parseKeyContext } from "@/hooks/useCheckin";
import { useIdsItems } from "@/hooks/useIdsItems";
import { useTodos, parseTodoDescription } from "@/hooks/useTodos";
import { useMeetingSummary } from "@/hooks/useMeetingSummary";
import {
  useResponsabilityTemplates,
  useResponsabilityLogs,
  calcWeeklyExpected,
} from "@/hooks/useResponsabilites";
import { useKpiRoleAssignments } from "@/hooks/useKpiRoleAssignments";
import { useObjectives, parseObjectiveDescription } from "@/hooks/useObjectives";
import {
  computeWeeklyException,
  type ExceptionCommitment,
  type ExceptionProblem,
  type ExceptionVerdict,
  type ProblemSeverity as SharedProblemSeverity,
} from "@/lib/weeklyException";

export type ProblemSeverity = SharedProblemSeverity;

export interface WeeklyPdfObjective {
  title: string;
  metric: string;
  target: number;
  unit: string;
  current: number;
  progress: number;
  status_ui: "on_track" | "at_risk" | "behind";
  comment: string;
  targetDate: string | null;
}

export type WeeklyPdfProblem = ExceptionProblem;

export type WeeklyPdfCommitment = ExceptionCommitment;

export type WeeklyPdfVerdict = ExceptionVerdict;


export interface WeeklyPdfKpi {
  name: string;
  unit: string;
  value: number | null;
  target: number | null;
  status: string;
  role: string | null;
  niveau: string | null;
  kpiDefinitionId: string;
}


export interface WeeklyPdfIds {
  text: string;
  convertedToTodo: boolean;
  convertedToObjectif: boolean;
}

export interface WeeklyPdfResponsibility {
  title: string;
  frequency: string;
  weeklyExpected: number;
  actualCount: number | null;
  completionRate: number | null;
  comment: string | null;
}

export interface WeeklyPdfTodoDone {
  title: string;
  deadline: string;
  responsible: string;
  source: string;
}

export interface WeeklyPdfTodoActive {
  title: string;
  deadline: string;
  responsible: string;
  source: string;
  status: string;
  reason: string;
  isOverdue: boolean;
}

export interface WeeklyPdfTodoDeferred {
  title: string;
  newDeadline: string;
  originalDeadline: string;
  responsible: string;
  source: string;
  deferredCount: number;
  reason: string;
}

export interface WeeklyPdfData {
  reportLabel: string;
  reportPeriod: string;
  spaName: string;
  managerName: string;
  generatedAt: string;
  executiveSummary: string | null;
  keyActions: string[];
  kpis: WeeklyPdfKpi[];
  moodScore: number;
  teamNote: string;
  responsibilities: WeeklyPdfResponsibility[];
  ids: WeeklyPdfIds[];
  objectives: WeeklyPdfObjective[];
  todosDone: WeeklyPdfTodoDone[];
  todosActive: WeeklyPdfTodoActive[];
  todosDeferred: WeeklyPdfTodoDeferred[];
  freeNote: string;
  // Synthèse Direction (page 1 du PDF)
  verdict: WeeklyPdfVerdict;
  problems: WeeklyPdfProblem[];
  commitmentsOverdue: WeeklyPdfCommitment[];
  commitmentsAtRisk: WeeklyPdfCommitment[];
}

function formatDateFr(iso: string | null | undefined): string {
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

/**
 * Remplace les symboles hors encodage WinAnsi (police Helvetica du PDF) qui
 * s'afficheraient en charabia (« ≥ » → « e »). Les managers tapent ≥/≤ dans les
 * cibles KPI/objectifs : sans ça le PDF Direction paraît cassé.
 */
export function safeText(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/≥/g, ">=")
    .replace(/≤/g, "<=")
    .replace(/≠/g, "!=")
    .replace(/≈/g, "~")
    .replace(/→/g, "->")
    .replace(/←/g, "<-")
    .replace(/∞/g, "inf");
}

function parseKeyActions(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((a) => typeof a === "string");
  } catch {
    /* ignore */
  }
  return [];
}

export function useWeeklyPdfData(
  reportId: string,
  reportLabel: string,
  reportPeriod: string,
  periodStart: string,
  periodEnd: string,
): { data: WeeklyPdfData | null; isLoading: boolean } {
  const { spaId, user } = useAuth();

  const spaQ = useQuery({
    queryKey: ["spa", spaId],
    enabled: !!spaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("spas")
        .select("name")
        .eq("id", spaId!)
        .maybeSingle();
      if (error) throw error;
      return data as { name: string } | null;
    },
  });

  const entriesQ = useKpiEntries(reportId);
  const defsQ = useKpiDefinitions(spaId);
  const checkinQ = useCheckin(reportId);
  const idsQ = useIdsItems(reportId);
  const todosQ = useTodos(reportId, spaId);
  const summaryQ = useMeetingSummary(reportId);
  const templatesQ = useResponsabilityTemplates(spaId);
  const logsQ = useResponsabilityLogs(reportId);
  const kpiDefIds = (defsQ.data ?? []).map((d) => d.id);
  const roleAssignmentsQ = useKpiRoleAssignments(kpiDefIds);
  const objectivesQ = useObjectives(spaId);

  const isLoading =
    spaQ.isLoading ||
    entriesQ.isLoading ||
    defsQ.isLoading ||
    checkinQ.isLoading ||
    idsQ.isLoading ||
    todosQ.isLoading ||
    summaryQ.isLoading ||
    templatesQ.isLoading ||
    logsQ.isLoading ||
    roleAssignmentsQ.isLoading ||
    objectivesQ.isLoading;

  if (isLoading) return { data: null, isLoading: true };

  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const managerName =
    (typeof meta.full_name === "string" && meta.full_name) ||
    (typeof meta.name === "string" && meta.name) ||
    user?.email ||
    "";

  const defsById = new Map((defsQ.data ?? []).map((d) => [d.id, d]));

  const ROLE_PRIORITY_PDF = ["spa_manager", "therapist", "spa_concierge", "ambassador"];
  const primaryAssignmentByKpiId = new Map<string, { role: string; niveau: string }>();
  for (const role of ROLE_PRIORITY_PDF) {
    for (const a of (roleAssignmentsQ.data ?? [])) {
      if (a.role === role && !primaryAssignmentByKpiId.has(a.kpi_definition_id)) {
        primaryAssignmentByKpiId.set(a.kpi_definition_id, { role: a.role, niveau: a.niveau });
      }
    }
  }

  const kpis: WeeklyPdfKpi[] = (entriesQ.data ?? [])
    .filter((e) => e.value_current !== null)
    .map((e) => {
      const def = defsById.get(e.kpi_definition_id);
      const assignment = primaryAssignmentByKpiId.get(e.kpi_definition_id);
      return {
        name: safeText(def?.name) || "—",
        unit: def?.unit ?? "",
        value: e.value_current,
        target: e.target_value,
        status: e.status,
        role: assignment?.role ?? null,
        niveau: assignment?.niveau ?? null,
        kpiDefinitionId: e.kpi_definition_id,
      };
    });


  const kc = parseKeyContext(checkinQ.data?.key_context);

  const ids: WeeklyPdfIds[] = (idsQ.data ?? []).map((i) => ({
    text: safeText(i.capture_text),
    convertedToTodo: i.converted_to_todo_id !== null,
    convertedToObjectif: i.converted_to_objective_id !== null,
  }));

  const weekStart = periodStart ? new Date(periodStart) : null;
  const weekEnd = periodEnd ? new Date(periodEnd) : null;
  if (weekEnd) weekEnd.setHours(23, 59, 59, 999);
  const today = new Date();
  const allTodos = todosQ.data ?? [];
  const inWeek = (iso: string | null) => {
    if (!iso || !weekStart || !weekEnd) return false;
    const d = new Date(iso);
    return d >= weekStart && d <= weekEnd;
  };

  const todosDone: WeeklyPdfTodoDone[] = allTodos
    .filter((t) => t.status === "done" && inWeek(t.due_date))
    .map((t) => ({
      title: safeText(t.title),
      deadline: formatDateFr(t.due_date),
      responsible: parseTodoDescription(t.description).responsible || "—",
      source: t.source,
    }));

  const todosActive: WeeklyPdfTodoActive[] = allTodos
    .filter(
      (t) => t.status !== "done" && t.status !== "deferred" && inWeek(t.due_date),
    )
    .map((t) => {
      const m = parseTodoDescription(t.description);
      return {
        title: safeText(t.title),
        deadline: formatDateFr(t.due_date),
        responsible: m.responsible || "—",
        source: t.source,
        status: t.status,
        reason: m.followUp || "",
        isOverdue: !!t.due_date && new Date(t.due_date) < today,
      };
    });

  const todosDeferred: WeeklyPdfTodoDeferred[] = allTodos
    .filter((t) => t.status === "deferred")
    .map((t) => {
      const m = parseTodoDescription(t.description);
      return {
        title: safeText(t.title),
        newDeadline: formatDateFr(t.due_date),
        originalDeadline: formatDateFr(t.deferred_from_date),
        responsible: m.responsible || "—",
        source: t.source,
        deferredCount: t.deferred_count ?? 0,
        reason: m.followUp || "",
      };
    });

  const objectives: WeeklyPdfObjective[] = (objectivesQ.data ?? []).map((o) => {
    const parsed = parseObjectiveDescription(o.description);
    const progress = Math.min(100, Math.round((parsed.current / (parsed.target || 1)) * 100));
    return {
      title: safeText(o.title),
      metric: safeText(parsed.metric),
      target: parsed.target,
      unit: parsed.unit,
      current: parsed.current,
      progress,
      status_ui: parsed.status_ui,
      comment: safeText(parsed.comment),
      targetDate: o.target_date,
    };
  });

  // ---- Synthèse Direction : problèmes par gravité + engagements non tenus ----
  // Logique factorisée dans src/lib/weeklyException.ts (réutilisée par
  // useDirectionDigest pour que web et PDF disent strictement la même chose).
  const objsRaw = objectivesQ.data ?? [];
  const exception = computeWeeklyException(
    (idsQ.data ?? []),
    allTodos,
    objsRaw,
    {
      weekEnd,
      today,
      sanitize: safeText,
      formatDate: formatDateFr,
    },
  );
  const problems = exception.problems;
  const commitmentsOverdue = exception.commitmentsOverdue;
  const commitmentsAtRisk = exception.commitmentsAtRisk;
  const verdict = exception.verdict;


  const responsibilities: WeeklyPdfResponsibility[] = (templatesQ.data ?? [])
    .filter((t) => t.frequency === "daily" || t.frequency === "weekly")
    .map((t) => {
      const weeklyExpected = calcWeeklyExpected(t.frequency, t.expected_count);
      const log = (logsQ.data ?? {})[t.id];
      return {
        title: safeText(t.title),
        frequency: t.frequency,
        weeklyExpected,
        actualCount: log?.actual_count ?? null,
        completionRate: log?.completion_rate ?? null,
        comment: log?.comment ? safeText(log.comment) : null,
      };
    });

  const data: WeeklyPdfData = {
    reportLabel,
    reportPeriod,
    spaName: spaQ.data?.name ?? "Spa",
    managerName: String(managerName),
    generatedAt: new Date().toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    executiveSummary: summaryQ.data?.executive_summary
      ? safeText(summaryQ.data.executive_summary)
      : null,
    keyActions: parseKeyActions(summaryQ.data?.key_actions).map(safeText),
    kpis,
    moodScore: checkinQ.data?.mood_score ?? 0,
    teamNote: safeText(kc.note),
    objectives,
    responsibilities,
    ids,
    todosDone,
    todosActive,
    todosDeferred,
    freeNote: safeText(kc.free_note),
    verdict,
    problems,
    commitmentsOverdue,
    commitmentsAtRisk,
  };

  return { data, isLoading: false };
}
