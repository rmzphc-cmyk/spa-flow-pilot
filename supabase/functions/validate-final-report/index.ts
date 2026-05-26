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
    const userId = claims.claims.sub as string;

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
    if (report.cycle_type !== "monthly") return json({ error: "Rapport non mensuel." }, 409);
    if (report.status !== "post_meeting_generated")
      return json({ error: "Le rapport n'est pas en post-réunion." }, 409);

    // 3. All IDS must have a proposed_solution
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

    // 4. AI summary must exist
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

    // 5. Validate summary
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

    // 6. Lock report
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
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: msg }, 500);
  }
});
