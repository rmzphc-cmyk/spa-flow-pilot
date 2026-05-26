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
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) return json({ error: "OPENAI_API_KEY missing" }, 500);

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await authClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) return json({ error: "Unauthorized" }, 401);

    const { report_id } = (await req.json()) as { report_id?: string };
    if (!report_id) return json({ error: "Missing report_id" }, 400);

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: report } = await admin
      .from("reports")
      .select("*")
      .eq("id", report_id)
      .maybeSingle();
    if (!report) return json({ error: "Rapport introuvable." }, 404);

    const [{ data: kpis }, { data: ids }] = await Promise.all([
      admin
        .from("kpi_entries")
        .select("*, kpi_definitions(name, unit)")
        .eq("report_id", report_id),
      admin
        .from("ids_items")
        .select("capture_text")
        .eq("report_id", report_id)
        .eq("cycle_type", "weekly"),
    ]);

    const userPrompt = `Semaine "${report.cycle_label}" (${report.period_start} → ${report.period_end}).

KPI:
${(kpis ?? []).map((k: any) => `- ${k.kpi_definitions?.name ?? "?"}: ${k.value_current ?? "n/a"}${k.kpi_definitions?.unit ?? ""} (statut ${k.status})${k.comment ? ` — ${k.comment}` : ""}`).join("\n") || "Aucun"}

IDS:
${(ids ?? []).map((i: any) => `- ${i.capture_text}`).join("\n") || "Aucun"}

Génère un JSON: { executive_summary (150 mots max), key_actions (array de 3 strings max) }.`;

    const openaiResp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 600,
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "Tu génères des synthèses hebdomadaires concises pour un spa." },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!openaiResp.ok) {
      const t = await openaiResp.text();
      return json({ error: `OpenAI error: ${t}` }, 500);
    }

    const completion = await openaiResp.json();
    const content = completion.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content);

    const { data: summary, error: upErr } = await admin
      .from("meeting_summaries")
      .upsert(
        {
          report_id,
          executive_summary: parsed.executive_summary ?? null,
          key_actions: JSON.stringify(parsed.key_actions ?? []),
          model_used: "gpt-4o",
          generated_by_agent: "generate-weekly-summary",
          language: "fr",
          tokens_used: completion.usage?.total_tokens ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "report_id" },
      )
      .select()
      .single();
    if (upErr) throw upErr;

    return json({ data: summary }, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: msg }, 500);
  }
});
