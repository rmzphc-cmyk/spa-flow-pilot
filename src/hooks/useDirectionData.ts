import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { SpaOverview, SpaDetail, SpaAlert } from "@/data/directionMockData";

function tryParseJson<T>(str: string | null | undefined, fallback: T): T {
  try {
    return JSON.parse(str ?? "") as T;
  } catch {
    return fallback;
  }
}

function progressFromStatus(status: string | undefined): {
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

function mapReportStatus(
  s: string | undefined,
): SpaOverview["status"] {
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

async function fetchSpaOverview(spaId: string): Promise<SpaOverview | null> {
  const [{ data: spa }, { data: manager }, { data: report }] = await Promise.all([
    supabase.from("spas").select("id, name").eq("id", spaId).maybeSingle(),
    supabase
      .from("users")
      .select("full_name")
      .eq("spa_id", spaId)
      .eq("role", "spa_manager")
      .limit(1)
      .maybeSingle(),
    supabase
      .from("reports")
      .select("id, cycle_label, status, updated_at")
      .eq("spa_id", spaId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (!spa) return null;

  let alerts: SpaAlert[] = [];
  if (report?.id) {
    const { data: entries } = await supabase
      .from("kpi_entries")
      .select("status, kpi_definitions(name)")
      .eq("report_id", report.id)
      .in("status", ["red", "amber"]);
    alerts = (entries ?? []).slice(0, 3).map((e: any) => ({
      level: e.status === "red" ? "red" : "orange",
      text: `${e.kpi_definitions?.name ?? "KPI"} en alerte`,
    }));
  }

  const prog = progressFromStatus(report?.status);

  return {
    id: spa.id,
    name: spa.name,
    manager: manager?.full_name ?? "—",
    report: report?.cycle_label ?? "Aucun rapport",
    status: mapReportStatus(report?.status),
    progress: prog.text,
    alerts,
    kpis: { ca: "—", nps: "—", responsabilites: "—" },
    lastReport: report?.updated_at
      ? new Intl.DateTimeFormat("fr-FR").format(new Date(report.updated_at))
      : "—",
  };
}

export function useDirectionSpas() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["direction_spas", user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<SpaOverview[]> => {
      const spaIds = await fetchAccessibleSpaIds(user!.id);
      const results = await Promise.all(spaIds.map((id) => fetchSpaOverview(id)));
      return results.filter((r): r is SpaOverview => r !== null);
    },
  });
}

export interface SpaDetailWithSummary extends SpaDetail {
  executiveSummary: string | null;
}

export function useDirectionSpaDetail(spaId: string | undefined) {
  return useQuery({
    queryKey: ["direction_spa_detail", spaId],
    enabled: !!spaId,
    queryFn: async (): Promise<SpaDetailWithSummary | null> => {
      const id = spaId!;
      const [{ data: spa }, { data: manager }, { data: report }] = await Promise.all([
        supabase.from("spas").select("id, name").eq("id", id).maybeSingle(),
        supabase
          .from("users")
          .select("full_name")
          .eq("spa_id", id)
          .eq("role", "spa_manager")
          .limit(1)
          .maybeSingle(),
        supabase
          .from("reports")
          .select("id, cycle_label, status, period_start, period_end, updated_at, validated_at")
          .eq("spa_id", id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (!spa) return null;

      const reportId = report?.id;

      const [kpiEntriesRes, respLogsRes, objectivesRes, idsRes, summaryRes, alertEntriesRes] =
        await Promise.all([
          reportId
            ? supabase
                .from("kpi_entries")
                .select("value_current, value_n1, status, kpi_definitions(name, unit)")
                .eq("report_id", reportId)
            : Promise.resolve({ data: [] as any[] }),
          reportId
            ? supabase
                .from("responsibility_logs")
                .select("completion_rate, responsibility_templates(title)")
                .eq("report_id", reportId)
            : Promise.resolve({ data: [] as any[] }),
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
            : Promise.resolve({ data: [] as any[] }),
          reportId
            ? supabase
                .from("meeting_summaries")
                .select("executive_summary")
                .eq("report_id", reportId)
                .maybeSingle()
            : Promise.resolve({ data: null as any }),
          reportId
            ? supabase
                .from("kpi_entries")
                .select("status, kpi_definitions(name)")
                .eq("report_id", reportId)
                .in("status", ["red", "amber"])
            : Promise.resolve({ data: [] as any[] }),
        ]);

      const kpiEntries = (kpiEntriesRes.data ?? []) as any[];
      const respLogs = (respLogsRes.data ?? []) as any[];
      const objectives = (objectivesRes.data ?? []) as any[];
      const idsItems = (idsRes.data ?? []) as any[];
      const summary = (summaryRes as any).data as { executive_summary: string | null } | null;
      const alertEntries = (alertEntriesRes.data ?? []) as any[];

      const alerts: SpaAlert[] = alertEntries.slice(0, 3).map((e: any) => ({
        level: e.status === "red" ? "red" : "orange",
        text: `${e.kpi_definitions?.name ?? "KPI"} en alerte`,
      }));

      const prog = progressFromStatus(report?.status);

      const kpis = kpiEntries.map((ke: any) => {
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

      const respItems = respLogs.map((r: any) => ({
        label: r.responsibility_templates?.title ?? "—",
        status: (r.completion_rate === 100
          ? "green"
          : r.completion_rate >= 50
            ? "amber"
            : "red") as "green" | "amber" | "red",
      }));
      const respGlobal =
        respLogs.length > 0
          ? Math.round(
              respLogs.reduce((s: number, r: any) => s + (r.completion_rate ?? 0), 0) /
                respLogs.length,
            )
          : 0;

      const objectifs = objectives.map((o: any) => {
        const desc = tryParseJson<any>(o.description, {});
        const current = desc.current;
        const target = desc.target;
        const progress =
          target && Number(target) > 0
            ? Math.min(100, Math.round((Number(current) / Number(target)) * 100))
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

      const ids = idsItems.map((i: any) => ({
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
