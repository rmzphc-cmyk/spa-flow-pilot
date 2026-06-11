import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  computeWeeklyException,
  type ExceptionCommitment,
  type ExceptionProblem,
  type ExceptionVerdict,
  type IdsItemInput,
  type ObjectiveInput,
  type TodoInput,
} from "@/lib/weeklyException";

export type DiffusionStatus = "diffuse" | "en_cours" | "aucun";

export interface SpaDigestKpis {
  ca: string;
  satisfaction: string;
}

export interface SpaDigest {
  spaId: string;
  spaName: string;
  managerName: string;
  reportId: string | null;
  reportLabel: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  diffusionStatus: DiffusionStatus;
  verdict: ExceptionVerdict;
  problems: ExceptionProblem[];
  commitmentsOverdue: ExceptionCommitment[];
  commitmentsAtRisk: ExceptionCommitment[];
  counters: {
    bloquants: number;
    autresProblemes: number;
    enRetard: number;
    aRisque: number;
  };
  kpis: SpaDigestKpis;
  executiveSummary: string | null;
}

export interface WeekWindow {
  /** Lundi 00:00 local. */
  start: Date;
  /** Dimanche 23:59:59.999 local. */
  end: Date;
  /** Numéro de semaine ISO. */
  weekNumber: number;
  year: number;
  /** Décalage par rapport à la semaine courante (0 = courante, -1 = précédente). */
  offset: number;
}

/** Lundi 00:00 de la semaine ISO contenant `d`. */
function mondayOf(d: Date): Date {
  const day = (d.getDay() + 6) % 7; // 0=Mon
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
  m.setHours(0, 0, 0, 0);
  return m;
}

/** Numéro de semaine ISO 8601. */
function isoWeekNumber(d: Date): { week: number; year: number } {
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { week, year: tmp.getUTCFullYear() };
}

export function getWeekWindow(offset: number): WeekWindow {
  const base = mondayOf(new Date());
  const start = new Date(base);
  start.setDate(start.getDate() + offset * 7);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  const { week, year } = isoWeekNumber(start);
  return { start, end, weekNumber: week, year, offset };
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function fetchAccessibleSpaIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("direction_spa_access")
    .select("spa_id")
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? []).map((r) => r.spa_id as string);
}

const DIFFUSED_STATUSES = new Set(["validated"]);
const IN_PROGRESS_STATUSES = new Set([
  "draft_preparation",
  "ready_for_review",
  "in_meeting",
  "post_meeting_generated",
  "post_meeting",
]);

function diffusionOf(status: string | null | undefined): DiffusionStatus {
  if (!status) return "aucun";
  if (DIFFUSED_STATUSES.has(status)) return "diffuse";
  if (IN_PROGRESS_STATUSES.has(status)) return "en_cours";
  return "en_cours";
}

function findKpi(
  entries: Array<{
    value_current: number | null;
    kpi_definitions: { name: string | null; unit: string | null } | null;
  }>,
  predicate: (name: string) => boolean,
): string {
  const hit = entries.find((e) => {
    const n = (e.kpi_definitions?.name ?? "").toLowerCase();
    return predicate(n) && e.value_current != null;
  });
  if (!hit) return "—";
  return `${hit.value_current}${hit.kpi_definitions?.unit ?? ""}`;
}

export function useDirectionDigest(weekOffset = 0) {
  const { user } = useAuth();
  const window = getWeekWindow(weekOffset);
  const startIso = toIsoDate(window.start);
  const endIso = toIsoDate(window.end);

  const query = useQuery({
    queryKey: ["direction_digest", user?.id, startIso, endIso],
    enabled: !!user?.id,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    queryFn: async (): Promise<SpaDigest[]> => {
      const spaIds = await fetchAccessibleSpaIds(user!.id);
      if (spaIds.length === 0) return [];

      const [spasRes, managersRes, reportsRes, todosRes, objectivesRes] =
        await Promise.all([
          supabase.from("spas").select("id, name").in("id", spaIds),
          supabase
            .from("users")
            .select("spa_id, full_name")
            .in("spa_id", spaIds)
            .eq("role", "spa_manager"),
          supabase
            .from("reports")
            .select("id, spa_id, cycle_label, status, period_start, period_end, created_at")
            .in("spa_id", spaIds)
            .eq("cycle_type", "weekly")
            .lte("period_start", endIso)
            .gte("period_end", startIso)
            .order("created_at", { ascending: false }),
          supabase
            .from("todos")
            .select("id, spa_id, title, description, status, due_date, deferred_count")
            .in("spa_id", spaIds),
          supabase
            .from("objectives")
            .select("id, spa_id, title, description, target_date, status")
            .in("spa_id", spaIds)
            .eq("status", "active"),
        ]);

      if (spasRes.error) throw spasRes.error;
      if (managersRes.error) throw managersRes.error;
      if (reportsRes.error) throw reportsRes.error;
      if (todosRes.error) throw todosRes.error;
      if (objectivesRes.error) throw objectivesRes.error;

      const spas = (spasRes.data ?? []) as Array<{ id: string; name: string }>;
      const managerBySpa = new Map<string, string>();
      for (const m of (managersRes.data ?? []) as Array<{
        spa_id: string;
        full_name: string;
      }>) {
        if (m.spa_id && !managerBySpa.has(m.spa_id)) {
          managerBySpa.set(m.spa_id, m.full_name);
        }
      }

      // Premier rapport hebdo (le plus récent) couvrant la semaine, par spa.
      const reportBySpa = new Map<
        string,
        {
          id: string;
          cycle_label: string;
          status: string;
          period_start: string;
          period_end: string;
        }
      >();
      for (const r of (reportsRes.data ?? []) as Array<{
        id: string;
        spa_id: string;
        cycle_label: string;
        status: string;
        period_start: string;
        period_end: string;
      }>) {
        if (!reportBySpa.has(r.spa_id)) reportBySpa.set(r.spa_id, r);
      }

      const reportIds = Array.from(reportBySpa.values()).map((r) => r.id);

      const [kpiEntriesRes, idsRes, summariesRes] = await Promise.all([
        reportIds.length
          ? supabase
              .from("kpi_entries")
              .select("report_id, value_current, kpi_definitions(name, unit)")
              .in("report_id", reportIds)
          : Promise.resolve({ data: [], error: null } as { data: unknown[]; error: null }),
        reportIds.length
          ? supabase
              .from("ids_items")
              .select(
                "report_id, capture_text, triage_mode, converted_to_todo_id, converted_to_objective_id",
              )
              .in("report_id", reportIds)
          : Promise.resolve({ data: [], error: null } as { data: unknown[]; error: null }),
        reportIds.length
          ? supabase
              .from("meeting_summaries")
              .select("report_id, executive_summary, is_validated")
              .in("report_id", reportIds)
          : Promise.resolve({ data: [], error: null } as { data: unknown[]; error: null }),
      ]);

      if ((kpiEntriesRes as { error?: unknown }).error)
        throw (kpiEntriesRes as { error: Error }).error;
      if ((idsRes as { error?: unknown }).error)
        throw (idsRes as { error: Error }).error;
      if ((summariesRes as { error?: unknown }).error)
        throw (summariesRes as { error: Error }).error;

      const kpiEntries = (kpiEntriesRes.data ?? []) as Array<{
        report_id: string;
        value_current: number | null;
        kpi_definitions: { name: string | null; unit: string | null } | null;
      }>;
      const idsItems = (idsRes.data ?? []) as Array<{
        report_id: string;
        capture_text: string | null;
        triage_mode: string | null;
        converted_to_todo_id: string | null;
        converted_to_objective_id: string | null;
      }>;
      const summaries = (summariesRes.data ?? []) as Array<{
        report_id: string;
        executive_summary: string | null;
        is_validated: boolean;
      }>;

      const todosBySpa = new Map<string, TodoInput[]>();
      for (const t of (todosRes.data ?? []) as Array<TodoInput & { spa_id: string }>) {
        const list = todosBySpa.get(t.spa_id) ?? [];
        list.push(t);
        todosBySpa.set(t.spa_id, list);
      }
      const objsBySpa = new Map<string, ObjectiveInput[]>();
      for (const o of (objectivesRes.data ?? []) as Array<
        ObjectiveInput & { spa_id: string }
      >) {
        const list = objsBySpa.get(o.spa_id) ?? [];
        list.push(o);
        objsBySpa.set(o.spa_id, list);
      }

      const today = new Date();

      const digests: SpaDigest[] = spas.map((spa) => {
        const report = reportBySpa.get(spa.id) ?? null;
        const spaKpiEntries = report
          ? kpiEntries.filter((e) => e.report_id === report.id)
          : [];
        const spaIds: IdsItemInput[] = report
          ? idsItems.filter((i) => i.report_id === report.id)
          : [];
        const spaTodos = todosBySpa.get(spa.id) ?? [];
        const spaObjs = objsBySpa.get(spa.id) ?? [];

        const exception = computeWeeklyException(spaIds, spaTodos, spaObjs, {
          weekEnd: window.end,
          today,
        });

        const ca = findKpi(
          spaKpiEntries,
          (n) => /\bca\b/.test(n) || n.includes("chiffre d'affaires"),
        );
        const satisfaction = findKpi(spaKpiEntries, (n) => n.includes("satisfaction"));

        const summary = report
          ? summaries.find((s) => s.report_id === report.id)
          : undefined;

        // Statut de diffusion : un summary validé OU report.status=validated → diffusé.
        let diffusionStatus: DiffusionStatus;
        if (!report) diffusionStatus = "aucun";
        else if (summary?.is_validated || report.status === "validated")
          diffusionStatus = "diffuse";
        else diffusionStatus = diffusionOf(report.status);

        return {
          spaId: spa.id,
          spaName: spa.name,
          managerName: managerBySpa.get(spa.id) ?? "—",
          reportId: report?.id ?? null,
          reportLabel: report?.cycle_label ?? null,
          periodStart: report?.period_start ?? null,
          periodEnd: report?.period_end ?? null,
          diffusionStatus,
          verdict: exception.verdict,
          problems: exception.problems,
          commitmentsOverdue: exception.commitmentsOverdue,
          commitmentsAtRisk: exception.commitmentsAtRisk,
          counters: {
            bloquants: exception.verdict.blocking,
            autresProblemes:
              exception.problems.length - exception.verdict.blocking,
            enRetard: exception.verdict.overdue,
            aRisque: exception.verdict.atRisk,
          },
          kpis: { ca, satisfaction },
          executiveSummary: summary?.executive_summary ?? null,
        };
      });

      return digests;
    },
  });

  return { ...query, weekWindow: window };
}
