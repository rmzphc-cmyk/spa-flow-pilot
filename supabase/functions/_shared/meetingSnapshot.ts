import { createClient } from "jsr:@supabase/supabase-js@2";

type Admin = ReturnType<typeof createClient>;

// Shape unique des 7 sections d'un rapport monthly.
// Utilisé par start-monthly-meeting (snapshot "avant") ET generate-meeting-summary
// (état "après") pour garantir un diff AVANT→APRÈS strictement comparable.
export interface MeetingSections {
  kpi: unknown[];
  checkin: { mood_score: number; focus_level: number } | null;
  notes: string | null;
  responsabilites: unknown[];
  todos: unknown[];
  objectifs: unknown[];
  ids: unknown[];
}

export async function buildMeetingSections(admin: Admin, report: any): Promise<MeetingSections> {
  const [kpiRes, checkinRes, respRes, todosRes, objectifsRes, idsRes] = await Promise.all([
    admin
      .from("kpi_entries")
      .select("kpi_definition_id, value_current, value_n1, target_value, status, is_na, comment, kpi_definition:kpi_definitions(name, unit)")
      .eq("report_id", report.id),

    admin
      .from("checkins")
      .select("mood_score, focus_level, key_context")
      .eq("report_id", report.id)
      .maybeSingle(),

    admin
      .from("responsibility_logs")
      .select("responsibility_template_id, actual_count, completion_rate, comment, template:responsibility_templates(title, category)")
      .eq("report_id", report.id),

    admin
      .from("todos")
      .select("id, title, status, due_date, priority")
      .eq("spa_id", report.spa_id)
      .not("status", "eq", "done"),

    admin
      .from("objectives")
      .select("id, title, status, target_date, progress_note, current_value, target_value, metric, unit")
      .eq("spa_id", report.spa_id)
      .eq("status", "active"),

    admin
      .from("ids_items")
      .select("id, capture_text, triage_mode, proposed_solution, status")
      .eq("report_id", report.id),
  ]);

  const checkinRow = checkinRes.data as any;
  let parsedCtx: Record<string, unknown> = {};
  if (checkinRow?.key_context) {
    try { parsedCtx = JSON.parse(checkinRow.key_context); } catch { /* legacy illisible : ignorer */ }
  }

  return {
    kpi: kpiRes.data ?? [],
    checkin: checkinRow
      ? { mood_score: checkinRow.mood_score, focus_level: checkinRow.focus_level }
      : null,
    notes: typeof parsedCtx.free_note === "string" ? parsedCtx.free_note : null,
    responsabilites: respRes.data ?? [],
    todos: todosRes.data ?? [],
    objectifs: objectifsRes.data ?? [],
    ids: idsRes.data ?? [],
  };
}
