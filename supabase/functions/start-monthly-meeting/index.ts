import { authenticate, authorizeReportAccess, corsHeaders, internalError, json } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = await authenticate(req);
    if (!auth.ok) return auth.response;
    const { caller, admin } = auth;

    const { report_id } = (await req.json()) as { report_id?: string };
    if (!report_id) return json({ error: "Missing report_id" }, 400);

    const access = await authorizeReportAccess(admin, caller, report_id);
    if (!access.ok) return access.response;
    const report = access.report;

    if (report.cycle_type !== "monthly") return json({ error: "Rapport non mensuel." }, 400);
    if (!["draft_preparation", "ready_for_review"].includes(report.status)) {
      return json({ error: "Le rapport doit être en préparation ou prêt pour démarrer la réunion." }, 409);
    }

    // -------------------------------------------------------------------------
    // Snapshot "avant" — photographier les 7 sections au moment du lancement
    // -------------------------------------------------------------------------
    const [kpiRes, checkinRes, respRes, todosRes, objectifsRes, idsRes] = await Promise.all([
      admin
        .from("kpi_entries")
        .select("kpi_definition_id, value_current, value_n1, target_value, status, is_na, comment, kpi_definition:kpi_definitions(name, unit)")
        .eq("report_id", report_id),

      admin
        .from("checkins")
        .select("mood_score, focus_level, key_context")
        .eq("report_id", report_id)
        .maybeSingle(),

      admin
        .from("responsibility_logs")
        .select("responsibility_template_id, actual_count, completion_rate, comment, template:responsibility_templates(name, category)")
        .eq("report_id", report_id),

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
        .eq("report_id", report_id),
    ]);

    const checkinRow = checkinRes.data;
    let parsedCtx: Record<string, unknown> = {};
    if (checkinRow?.key_context) {
      try { parsedCtx = JSON.parse(checkinRow.key_context); } catch { /* keep empty */ }
    }

    const snapshot = {
      captured_at: new Date().toISOString(),
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

    // -------------------------------------------------------------------------
    // Transition de statut + écriture du snapshot
    // -------------------------------------------------------------------------
    const now = new Date().toISOString();
    const { error: uErr } = await admin
      .from("reports")
      .update({
        status: "in_meeting",
        meeting_started_at: now,
        snapshot_before_meeting: snapshot,
        updated_at: now,
      })
      .eq("id", report_id);
    if (uErr) throw uErr;

    const { data: finalReport, error: fErr } = await admin
      .from("reports")
      .select("*")
      .eq("id", report_id)
      .single();
    if (fErr) throw fErr;

    return json({ data: finalReport }, 200);
  } catch (e) {
    return internalError(e);
  }
});
