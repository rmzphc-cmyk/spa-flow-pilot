import { authenticate, authorizeReportAccess, corsHeaders, internalError, json } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = await authenticate(req);
    if (!auth.ok) return auth.response;
    const { caller, admin } = auth;
    const userId = caller.userId;

    const { report_id } = (await req.json()) as { report_id?: string };
    if (!report_id) return json({ error: "Missing report_id" }, 400);

    const access = await authorizeReportAccess(admin, caller, report_id);
    if (!access.ok) return access.response;
    const report = access.report;

    if (report.cycle_type !== "monthly") return json({ error: "Rapport non mensuel." }, 409);
    if (report.status !== "post_meeting_generated")
      return json({ error: "Le rapport n'est pas en post-réunion." }, 409);

    const { data: unresolved, error: idsErr } = await admin
      .from("ids_items")
      .select("id, proposed_solution")
      .eq("report_id", report_id);
    if (idsErr) throw idsErr;
    const missing = (unresolved ?? []).filter(
      (i) => !i.proposed_solution || i.proposed_solution.trim() === "",
    );
    if (missing.length > 0) {
      return json(
        { error: "Tous les IDS doivent avoir une solution avant validation.", field: "ids" },
        422,
      );
    }

    const { data: summary, error: sErr } = await admin
      .from("meeting_summaries")
      .select("id, executive_summary")
      .eq("report_id", report_id)
      .maybeSingle();
    if (sErr) throw sErr;
    if (!summary || !summary.executive_summary) {
      return json({ error: "La synthèse IA n'est pas encore générée.", field: "summary" }, 422);
    }

    const now = new Date().toISOString();

    const { error: us1 } = await admin
      .from("meeting_summaries")
      .update({
        is_validated: true,
        validated_by: userId,
        validated_at: now,
        updated_at: now,
      })
      .eq("report_id", report_id);
    if (us1) throw us1;

    const { error: us2 } = await admin
      .from("reports")
      .update({
        status: "validated",
        is_locked: true,
        validated_at: now,
        validated_by: userId,
        updated_at: now,
      })
      .eq("id", report_id);
    if (us2) throw us2;

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
