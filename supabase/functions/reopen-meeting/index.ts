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

    if (report.cycle_type !== "monthly") return json({ error: "Rapport non mensuel." }, 409);
    if (report.status !== "post_meeting_generated")
      return json({ error: "La réunion ne peut être relancée que depuis l'état post_meeting_generated." }, 409);

    const now = new Date().toISOString();

    const { error: uErr } = await admin
      .from("reports")
      .update({
        status: "in_meeting",
        meeting_closed_at: null,
        ai_synthesis_scheduled_at: null,
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
