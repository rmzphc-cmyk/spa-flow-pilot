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
    if (report.status !== "in_meeting")
      return json({ error: "Le rapport n'est pas en cours de réunion." }, 409);

    const { count: idsCount, error: cErr } = await admin
      .from("ids_items")
      .select("*", { count: "exact", head: true })
      .eq("report_id", report_id);
    if (cErr) throw cErr;

    const now = new Date();
    const scheduledAt = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();

    const { error: uErr } = await admin
      .from("reports")
      .update({
        status: "post_meeting_generated",
        meeting_closed_at: now.toISOString(),
        ai_synthesis_scheduled_at: scheduledAt,
        updated_at: now.toISOString(),
      })
      .eq("id", report_id);
    if (uErr) throw uErr;

    const { data: finalReport, error: fErr } = await admin
      .from("reports")
      .select("*")
      .eq("id", report_id)
      .single();
    if (fErr) throw fErr;

    const body: { data: typeof finalReport; warning?: string } = { data: finalReport };
    if (!idsCount || idsCount === 0) body.warning = "Aucun IDS capturé";
    return json(body, 200);
  } catch (e) {
    return internalError(e);
  }
});
