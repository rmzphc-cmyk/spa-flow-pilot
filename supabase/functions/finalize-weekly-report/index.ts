import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await authClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) return json({ error: "Unauthorized" }, 401);

    const { report_id } = (await req.json()) as { report_id?: string };
    if (!report_id) return json({ error: "Missing report_id" }, 400);

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: report, error: rErr } = await admin
      .from("reports")
      .select("*")
      .eq("id", report_id)
      .maybeSingle();
    if (rErr) throw rErr;
    if (!report) return json({ error: "Rapport introuvable." }, 404);
    if (report.cycle_type !== "weekly") return json({ error: "Rapport non hebdomadaire." }, 409);
    if (report.status !== "ready_for_review")
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
      await fetch(`${supabaseUrl}/functions/v1/generate-weekly-summary`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
        body: JSON.stringify({ report_id }),
      });
    } catch (_e) {
      // silent
    }

    return json({ data: finalReport }, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: msg }, 500);
  }
});
