import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Input {
  spa_id: string;
  cycle_type: "weekly" | "monthly";
  cycle_label: string;
  period_start: string;
  period_end: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await authClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) {
      return json({ error: "Unauthorized" }, 401);
    }
    const userId = claims.claims.sub as string;

    const body = (await req.json()) as Input;
    if (!body.spa_id || !body.cycle_type || !body.cycle_label || !body.period_start || !body.period_end) {
      return json({ error: "Missing required fields" }, 400);
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // 2. Check no active report
    const { data: existing, error: existingErr } = await admin
      .from("reports")
      .select("id")
      .eq("spa_id", body.spa_id)
      .eq("cycle_type", body.cycle_type)
      .neq("status", "validated")
      .maybeSingle();
    if (existingErr) throw existingErr;
    if (existing) {
      return json({ error: "Un rapport actif existe déjà pour ce cycle." }, 409);
    }

    // 3. Create report
    const { data: newReport, error: insertErr } = await admin
      .from("reports")
      .insert({
        spa_id: body.spa_id,
        manager_id: userId,
        cycle_type: body.cycle_type,
        cycle_label: body.cycle_label,
        period_start: body.period_start,
        period_end: body.period_end,
        status: "draft_preparation",
      })
      .select("*")
      .single();
    if (insertErr) throw insertErr;
    const newReportId = newReport.id as string;

    // 4. Previous validated report
    const { data: prevReport } = await admin
      .from("reports")
      .select("id")
      .eq("spa_id", body.spa_id)
      .eq("cycle_type", body.cycle_type)
      .eq("status", "validated")
      .order("period_end", { ascending: false })
      .limit(1)
      .maybeSingle();
    const prevReportId = prevReport?.id as string | undefined;

    // 5. KPI entries pre-create
    const { data: kpiDefs } = await admin
      .from("kpi_definitions")
      .select("id")
      .eq("spa_id", body.spa_id)
      .eq("is_active", true);

    if (kpiDefs && kpiDefs.length > 0) {
      let prevEntries: { kpi_definition_id: string; value_current: number | null }[] = [];
      if (prevReportId) {
        const { data: pe } = await admin
          .from("kpi_entries")
          .select("kpi_definition_id, value_current")
          .eq("report_id", prevReportId);
        prevEntries = pe ?? [];
      }
      const prevMap = new Map(prevEntries.map((e) => [e.kpi_definition_id, e.value_current]));
      const rows = kpiDefs.map((d) => ({
        report_id: newReportId,
        kpi_definition_id: d.id,
        value_n1: prevMap.get(d.id) ?? null,
        status: "not_applicable",
      }));
      const { error: kpiErr } = await admin.from("kpi_entries").insert(rows);
      if (kpiErr && kpiErr.code !== "23505") throw kpiErr;
    }

    // 6. Responsibility logs pre-create
    const { data: respTpls } = await admin
      .from("responsibility_templates")
      .select("id")
      .eq("spa_id", body.spa_id)
      .eq("is_active", true);

    if (respTpls && respTpls.length > 0) {
      const rows = respTpls.map((t) => ({
        report_id: newReportId,
        responsibility_template_id: t.id,
        completion_rate: 0,
      }));
      const { error: respErr } = await admin.from("responsibility_logs").insert(rows);
      if (respErr && respErr.code !== "23505") throw respErr;
    }

    // 7. Carry over open todos
    if (prevReportId) {
      await admin
        .from("todos")
        .update({ report_id: newReportId })
        .eq("report_id", prevReportId)
        .in("status", ["pending", "in_progress"]);
    }

    // 8. Final fetch
    const { data: finalReport, error: finalErr } = await admin
      .from("reports")
      .select("*")
      .eq("id", newReportId)
      .single();
    if (finalErr) throw finalErr;

    return json({ data: finalReport }, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: msg }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
