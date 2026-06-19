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

    if (report.cycle_type !== "weekly") return json({ error: "Rapport non hebdomadaire." }, 409);
    if (report.status !== "ready_for_review" && report.status !== "draft_preparation")
      return json({ error: "Le rapport n'est pas prêt pour finalisation." }, 409);

    const { data: entries, error: eErr } = await admin
      .from("kpi_entries")
      .select("*")
      .eq("report_id", report_id);
    if (eErr) throw eErr;

    const hasAnyValue = (entries ?? []).some((e) => e.value_current !== null);
    if (!hasAnyValue)
      return json({ error: "Aucun KPI renseigné.", field: "kpi" }, 422);

    const alertMissingComment = (entries ?? []).some(
      (e) => (e.status === "amber" || e.status === "red") && (!e.comment || e.comment.trim() === ""),
    );
    if (alertMissingComment)
      return json(
        { error: "Commentaire manquant sur un KPI en alerte.", field: "kpi_comment" },
        422,
      );

    const now = new Date().toISOString();
    const { error: uErr } = await admin
      .from("reports")
      .update({
        status: "validated",
        is_locked: true,
        validated_at: now,
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

    // Fire-and-forget AI summary generation (do not block on failure)
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      await fetch(`${supabaseUrl}/functions/v1/generate-weekly-summary`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: req.headers.get("Authorization") ?? "",
        },
        body: JSON.stringify({ report_id, notify: true }),
      });
    } catch (_e) {
      // silent
    }

    return json({ data: finalReport }, 200);
  } catch (e) {
    return internalError(e);
  }
});
