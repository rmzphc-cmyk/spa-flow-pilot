import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { computeObjectiveProgress } from "@/lib/objectiveProgress";
import type { SpaOverview, SpaDetail, SpaAlert } from "@/data/directionMockData";

interface ObjectiveDesc {
  current?: number | string | null;
  target?: number | string | null;
  /** Valeur de départ (baseline) — absente des blobs legacy → défaut 0. */
  start?: number | string | null;
  status_ui?: string;
}

function tryParseJson<T>(str: string | null | undefined, fallback: T): T {
  try {
    return JSON.parse(str ?? "") as T;
  } catch {
    return fallback;
  }
}

function progressFromStatus(status: string | null | undefined): {
  text: string;
  num: number;
  den: number;
} {
  if (status === "validated") return { text: "Validé", num: 7, den: 7 };
  if (status === "in_meeting") return { text: "Réunion en cours", num: 5, den: 7 };
  if (status === "post_meeting_generated" || status === "post_meeting")
    return { text: "Post-réunion", num: 6, den: 7 };
  return { text: "Préparation", num: 2, den: 7 };
}

function mapReportStatus(s: string | null | undefined): SpaOverview["status"] {
  if (s === "validated") return "validated";
  if (s === "in_meeting") return "in_meeting";
  return "draft_preparation";
}

async function fetchAccessibleSpaIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("direction_spa_access")
    .select("spa_id")
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? []).map((r) => r.spa_id as string);
}

// ---- Types des lignes Supabase (les selects imbriqués ne sont pas inférés) ----
interface KpiDefRel {
  name: string | null;
  unit: string | null;
}
interface ManagerRow {
  spa_id: string | null;
  full_name: string | null;
}
interface OverviewKpiEntry {
  id: string;
  status: string | null;
  value_current: number | null;
  kpi_definitions: KpiDefRel | null;
}
interface OverviewRespLog {
  completion_rate: number | null;
}
interface OverviewReport {
  id: string;
  cycle_label: string | null;
  status: string | null;
  updated_at: string | null;
  created_at: string | null;
  kpi_entries: OverviewKpiEntry[] | null;
  responsibility_logs: OverviewRespLog[] | null;
}
interface OverviewSpaRow {
  id: string;
  name: string;
  reports: OverviewReport[] | null;
}

export function useDirectionSpas() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["direction_spas", user?.id],
    enabled: !!user?.id,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    queryFn: async (): Promise<SpaOverview[]> => {
      const spaIds = await fetchAccessibleSpaIds(user!.id);
      if (spaIds.length === 0) return [];

      const [spasRes, managersRes] = await Promise.all([
        supabase
          .from("spas")
          .select(
            "id, name, reports(id, cycle_label, status, updated_at, created_at, kpi_entries(id, status, value_current, kpi_definitions(name, unit)), ids_items(id, triage_mode), responsibility_logs(completion_rate))",
          )
          .in("id", spaIds),
        supabase
          .from("users")
          .select("spa_id, full_name")
          .in("spa_id", spaIds)
          .eq("role", "spa_manager"),
      ]);

      if (spasRes.error) throw spasRes.error;
      if (managersRes.error) throw managersRes.error;

      const managerBySpa = new Map<string, string | null>();
      for (const m of (managersRes.data ?? []) as unknown as ManagerRow[]) {
        if (m.spa_id && !managerBySpa.has(m.spa_id)) {
          managerBySpa.set(m.spa_id, m.full_name);
        }
      }

      return ((spasRes.data ?? []) as unknown as OverviewSpaRow[]).map((spa) => {
        const reports = spa.reports ?? [];
        const latestReport = reports
          .slice()
          .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))[0];

        const kpiEntries = latestReport?.kpi_entries ?? [];
        const respLogs = latestReport?.responsibility_logs ?? [];

        const alertEntries = kpiEntries.filter(
          (e) => e.status === "red" || e.status === "amber",
        );
        const alerts: SpaAlert[] = alertEntries.slice(0, 3).map((e) => ({
          level: e.status === "red" ? "red" : "orange",
          text: "KPI en alerte",
        }));

        const findKpi = (predicate: (name: string) => boolean) =>
          kpiEntries.find((e) => {
            const n = (e.kpi_definitions?.name ?? "").toLowerCase();
            return predicate(n) && e.value_current != null;
          });

        const caEntry = findKpi(
          (n) => /\bca\b/.test(n) || n.includes("chiffre d'affaires"),
        );
        const satisfactionEntry = findKpi((n) => n.includes("satisfaction"));

        const ca = caEntry
          ? `${caEntry.value_current}${caEntry.kpi_definitions?.unit ?? ""}`
          : "—";
        const satisfaction = satisfactionEntry
          ? `${satisfactionEntry.value_current}${satisfactionEntry.kpi_definitions?.unit ?? ""}`
          : "—";

        const respRates = respLogs
          .map((r) => r.completion_rate)
          .filter((v): v is number => typeof v === "number");
        const responsabilites =
          respRates.length > 0
            ? `${Math.round(respRates.reduce((s, v) => s + v, 0) / respRates.length)}%`
            : "—";

        const prog = progressFromStatus(latestReport?.status);

        return {
          id: spa.id,
          name: spa.name,
          manager: managerBySpa.get(spa.id) ?? "—",
          report: latestReport?.cycle_label ?? "Aucun rapport",
          status: mapReportStatus(latestReport?.status),
          progress: prog.text,
          alerts,
          kpis: { ca, satisfaction, responsabilites },
          lastReport: latestReport?.updated_at
            ? new Intl.DateTimeFormat("fr-FR").format(new Date(latestReport.updated_at))
            : "—",
        } as SpaOverview;
      });
    },
  });
}

export interface SpaDetailWithSummary extends SpaDetail {
  executiveSummary: string | null;
}

// ---- Types des lignes Supabase (fiche détail) ----
interface DetailKpiEntry {
  value_current: number | null;
  value_n1: number | null;
  status: string | null;
  kpi_definitions: KpiDefRel | null;
}
interface DetailRespLog {
  completion_rate: number | null;
  responsibility_templates: { title: string | null } | null;
}
interface DetailObjective {
  title: string;
  description: string | null;
}
interface DetailIds {
  capture_text: string;
  proposed_solution: string | null;
  status: string | null;
}
interface DetailAlertEntry {
  status: string | null;
  kpi_definitions: { name: string | null } | null;
}

export function useDirectionSpaDetail(
  spaId: string | undefined,
  reportIdOverride?: string | null,
) {
  return useQuery({
    queryKey: ["direction_spa_detail", spaId, reportIdOverride ?? null],
    enabled: !!spaId,
    queryFn: async (): Promise<SpaDetailWithSummary | null> => {
      const id = spaId!;
      const [{ data: spa }, { data: manager }, reportRes] = await Promise.all([
        supabase.from("spas").select("id, name").eq("id", id).maybeSingle(),
        supabase
          .from("users")
          .select("full_name")
          .eq("spa_id", id)
          .eq("role", "spa_manager")
          .limit(1)
          .maybeSingle(),
        reportIdOverride
          ? supabase
              .from("reports")
              .select("id, cycle_label, status, period_start, period_end, updated_at, validated_at")
              .eq("id", reportIdOverride)
              .maybeSingle()
          : supabase
              .from("reports")
              .select("id, cycle_label, status, period_start, period_end, updated_at, validated_at")
              .eq("spa_id", id)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle(),
      ]);
      const report = reportRes.data;

      if (!spa) return null;

      const reportId = report?.id;

      const [kpiEntriesRes, respLogsRes, objectivesRes, idsRes, summaryRes, alertEntriesRes] =
        await Promise.all([
          reportId
            ? supabase
                .from("kpi_entries")
                .select("value_current, value_n1, status, kpi_definitions(name, unit)")
                .eq("report_id", reportId)
            : Promise.resolve({ data: [], error: null }),
          reportId
            ? supabase
                .from("responsibility_logs")
                .select("completion_rate, responsibility_templates(title)")
                .eq("report_id", reportId)
            : Promise.resolve({ data: [], error: null }),
          supabase
            .from("objectives")
            .select("title, description")
            .eq("spa_id", id)
            .eq("status", "active"),
          reportId
            ? supabase
                .from("ids_items")
                .select("capture_text, proposed_solution, status")
                .eq("report_id", reportId)
            : Promise.resolve({ data: [], error: null }),
          reportId
            ? supabase
                .from("meeting_summaries")
                .select("executive_summary")
                .eq("report_id", reportId)
                .maybeSingle()
            : Promise.resolve({ data: null, error: null }),
          reportId
            ? supabase
                .from("kpi_entries")
                .select("status, kpi_definitions(name)")
                .eq("report_id", reportId)
                .in("status", ["red", "amber"])
            : Promise.resolve({ data: [], error: null }),
        ]);

      const kpiEntries = (kpiEntriesRes.data ?? []) as unknown as DetailKpiEntry[];
      const respLogs = (respLogsRes.data ?? []) as unknown as DetailRespLog[];
      const objectives = (objectivesRes.data ?? []) as unknown as DetailObjective[];
      const idsItems = (idsRes.data ?? []) as unknown as DetailIds[];
      const summary = (summaryRes.data ?? null) as unknown as {
        executive_summary: string | null;
      } | null;
      const alertEntries = (alertEntriesRes.data ?? []) as unknown as DetailAlertEntry[];

      const alerts: SpaAlert[] = alertEntries.slice(0, 3).map((e) => ({
        level: e.status === "red" ? "red" : "orange",
        text: `${e.kpi_definitions?.name ?? "KPI"} en alerte`,
      }));

      const prog = progressFromStatus(report?.status);

      const kpis = kpiEntries.map((ke) => {
        const unit = ke.kpi_definitions?.unit ?? "";
        const value = ke.value_current != null ? `${ke.value_current}${unit}` : "—";
        const ecart =
          ke.value_current != null && ke.value_n1 != null && Number(ke.value_n1) !== 0
            ? `${(((Number(ke.value_current) - Number(ke.value_n1)) / Number(ke.value_n1)) * 100).toFixed(1)}%`
            : "—";
        return {
          label: ke.kpi_definitions?.name ?? "KPI",
          value,
          target: "—",
          ecart,
          status: (ke.status === "green" || ke.status === "amber" || ke.status === "red"
            ? ke.status
            : "green") as "green" | "amber" | "red",
        };
      });

      const respItems = respLogs.map((r) => ({
        label: r.responsibility_templates?.title ?? "—",
        status: (r.completion_rate === 100
          ? "green"
          : (r.completion_rate ?? 0) >= 50
            ? "amber"
            : "red") as "green" | "amber" | "red",
      }));
      const respGlobal =
        respLogs.length > 0
          ? Math.round(
              respLogs.reduce((s, r) => s + (r.completion_rate ?? 0), 0) / respLogs.length,
            )
          : 0;

      const objectifs = objectives.map((o) => {
        const desc = tryParseJson<ObjectiveDesc>(o.description, {});
        const current = desc.current;
        const target = desc.target;
        // Progression baseline-relative ; données absentes (« — ») → 0 %.
        const progress =
          current != null && target != null
            ? computeObjectiveProgress(
                Number(current),
                Number(target),
                Number(desc.start ?? 0),
              )
            : 0;
        const status_ui = desc.status_ui === "at_risk" ? "at_risk" : "on_track";
        return {
          label: o.title,
          current: current != null ? String(current) : "—",
          target: target != null ? String(target) : "—",
          progress,
          status: status_ui as "on_track" | "at_risk",
          statusLabel: status_ui === "at_risk" ? "À risque" : "En bonne voie",
        };
      });

      const ids = idsItems.map((i) => ({
        problem: i.capture_text,
        solution: i.proposed_solution ?? "—",
        status: (i.status === "converted" || i.proposed_solution
          ? "resolved"
          : "in_progress") as "resolved" | "in_progress",
      }));

      return {
        id: spa.id,
        name: spa.name,
        manager: manager?.full_name ?? "—",
        managerRole: "Spa Manager",
        currentReport: {
          label: report?.cycle_label ?? "—",
          status: mapReportStatus(report?.status),
          progress: prog.text,
          progressNum: prog.num,
          progressDen: prog.den,
        },
        alerts,
        lastValidated: {
          period: report?.cycle_label ?? "—",
          validatedDate: report?.validated_at
            ? new Intl.DateTimeFormat("fr-FR").format(new Date(report.validated_at))
            : "—",
          checkinNote: "",
          kpis,
          responsabilites: { global: respGlobal, items: respItems },
          objectifs,
          ids,
        },
        executiveSummary: summary?.executive_summary ?? null,
      };
    },
  });
}
