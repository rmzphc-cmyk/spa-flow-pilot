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

export interface WeeklyPdfKpi {
  name: string;
  unit: string;
  value: number | null;
  target: number | null;
  status: string;
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
  todosDone: WeeklyPdfTodoDone[];
  todosActive: WeeklyPdfTodoActive[];
  todosDeferred: WeeklyPdfTodoDeferred[];
  freeNote: string;
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

  const isLoading =
    spaQ.isLoading ||
    entriesQ.isLoading ||
    defsQ.isLoading ||
    checkinQ.isLoading ||
    idsQ.isLoading ||
    todosQ.isLoading ||
    summaryQ.isLoading ||
    templatesQ.isLoading ||
    logsQ.isLoading;

  if (isLoading) return { data: null, isLoading: true };

  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const managerName =
    (typeof meta.full_name === "string" && meta.full_name) ||
    (typeof meta.name === "string" && meta.name) ||
    user?.email ||
    "";

  const defsById = new Map((defsQ.data ?? []).map((d) => [d.id, d]));
  const kpis: WeeklyPdfKpi[] = (entriesQ.data ?? [])
    .filter((e) => e.value_current !== null)
    .map((e) => {
      const def = defsById.get(e.kpi_definition_id);
      return {
        name: def?.name ?? "—",
        unit: def?.unit ?? "",
        value: e.value_current,
        target: e.target_value,
        status: e.status,
      };
    });

  const kc = parseKeyContext(checkinQ.data?.key_context);

  const ids: WeeklyPdfIds[] = (idsQ.data ?? []).map((i) => ({
    text: i.capture_text,
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
      title: t.title,
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
        title: t.title,
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
        title: t.title,
        newDeadline: formatDateFr(t.due_date),
        originalDeadline: formatDateFr(t.deferred_from_date),
        responsible: m.responsible || "—",
        source: t.source,
        deferredCount: t.deferred_count ?? 0,
        reason: m.followUp || "",
      };
    });

  const responsibilities: WeeklyPdfResponsibility[] = (templatesQ.data ?? [])
    .filter((t) => t.frequency === "daily" || t.frequency === "weekly")
    .map((t) => {
      const weeklyExpected = calcWeeklyExpected(t.frequency, t.expected_count);
      const log = (logsQ.data ?? {})[t.id];
      return {
        title: t.title,
        frequency: t.frequency,
        weeklyExpected,
        actualCount: log?.actual_count ?? null,
        completionRate: log?.completion_rate ?? null,
        comment: log?.comment ?? null,
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
    executiveSummary: summaryQ.data?.executive_summary ?? null,
    keyActions: parseKeyActions(summaryQ.data?.key_actions),
    kpis,
    moodScore: checkinQ.data?.mood_score ?? 0,
    teamNote: kc.note ?? "",
    responsibilities,
    ids,
    todosDone,
    todosActive,
    todosDeferred,
    freeNote: kc.free_note ?? "",
  };

  return { data, isLoading: false };
}
