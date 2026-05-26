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

    if (report.cycle_type !== "monthly") return json({ error: "Rapport non mensuel." }, 400);
    if (report.status !== "ready_for_review") {
      return json({ error: "Le rapport n'est pas en état ready_for_review." }, 409);
    }

    const now = new Date().toISOString();
    const { error: uErr } = await admin
      .from("reports")
      .update({ status: "in_meeting", meeting_started_at: now, updated_at: now })
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
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: msg }, 500);
  }
});
