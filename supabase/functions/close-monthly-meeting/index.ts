import { authenticate, authorizeReportAccess, corsHeaders, internalError, json } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = await authenticate(req);
    if (!auth.ok) return auth.response;
    const { caller, admin } = auth;

    const body = (await req.json()) as {
      report_id?: string;
      audio_storage_path?: string;
      audio_mime_type?: string;
      audio_duration_s?: number;
    };
    const { report_id, audio_storage_path, audio_mime_type, audio_duration_s } = body;
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

    const updatePayload: Record<string, unknown> = {
      status: "post_meeting_generated",
      meeting_closed_at: now.toISOString(),
      ai_synthesis_scheduled_at: scheduledAt,
      updated_at: now.toISOString(),
    };
    if (audio_storage_path) {
      updatePayload.audio_storage_path = audio_storage_path;
      updatePayload.audio_mime_type = audio_mime_type ?? null;
      updatePayload.audio_duration_s = audio_duration_s ?? null;
    }

    const { error: uErr } = await admin.from("reports").update(updatePayload).eq("id", report_id);
    if (uErr) throw uErr;

    const { data: finalReport, error: fErr } = await admin
      .from("reports").select("*").eq("id", report_id).single();
    if (fErr) throw fErr;

    const responseBody: { data: typeof finalReport; warning?: string } = { data: finalReport };
    if (!idsCount || idsCount === 0) responseBody.warning = "Aucun IDS capturé";
    return json(responseBody, 200);
  } catch (e) {
    return internalError(e);
  }
});
