import { authenticate, authorizeReportAccess, corsHeaders, internalError, json } from "../_shared/auth.ts";
import { buildMeetingSections } from "../_shared/meetingSnapshot.ts";

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
    // Snapshot "avant" — photographier les 7 sections au moment du lancement.
    // Même shape que l'état "après" (module partagé) pour un diff comparable.
    // -------------------------------------------------------------------------
    const sections = await buildMeetingSections(admin, report);
    const snapshot = { captured_at: new Date().toISOString(), ...sections };

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
