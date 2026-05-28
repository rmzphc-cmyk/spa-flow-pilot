import { authenticate, authorizeReportAccess, corsHeaders, internalError, json } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = await authenticate(req);
    if (!auth.ok) return auth.response;
    const { caller, admin } = auth;

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      console.warn("OPENAI_API_KEY missing — will use template fallback");
    }

    const { report_id } = (await req.json()) as { report_id?: string };
    if (!report_id) return json({ error: "Missing report_id" }, 400);

    const access = await authorizeReportAccess(admin, caller, report_id);
    if (!access.ok) return access.response;
    const report = access.report;

    if (report.status !== "post_meeting_generated")
      return json({ error: "Rapport pas en post_meeting_generated." }, 409);

    const { data: existing } = await admin
      .from("meeting_summaries")
      .select("*")
      .eq("report_id", report_id)
      .maybeSingle();
    if (existing && existing.executive_summary) {
      return json({ data: existing }, 200);
    }

    const [{ data: kpis }, { data: checkin }, { data: resps }, { data: ids }, { data: objs }] =
      await Promise.all([
        admin
          .from("kpi_entries")
          .select("*, kpi_definitions(name, unit)")
          .eq("report_id", report_id),
        admin
          .from("checkins")
          .select("mood_score, focus_level, key_context")
          .eq("report_id", report_id)
          .maybeSingle(),
        admin
          .from("responsibility_logs")
          .select("completion_rate, comment, responsibility_templates(title)")
          .eq("report_id", report_id),
        admin
          .from("ids_items")
          .select("capture_text, problem_statement, proposed_solution, status")
          .eq("report_id", report_id),
        admin
          .from("objectives")
          .select("title, description, status")
          .eq("spa_id", report.spa_id)
          .eq("status", "active"),
      ]);

    const userPrompt = `Données du cycle "${report.cycle_label}" (période ${report.period_start} → ${report.period_end}).

KPI:
${(kpis ?? []).map((k: any) => `- ${k.kpi_definitions?.name ?? "?"}: ${k.value_current ?? "n/a"}${k.kpi_definitions?.unit ?? ""} (N-1: ${k.value_n1 ?? "n/a"}, statut: ${k.status})${k.comment ? ` — ${k.comment}` : ""}`).join("\n") || "Aucun"}

Check-in équipe:
${checkin ? `humeur ${checkin.mood_score}/5, focus ${checkin.focus_level}/5${checkin.key_context ? ` — ${checkin.key_context}` : ""}` : "Aucun"}

Responsabilités:
${(resps ?? []).map((r: any) => `- ${r.responsibility_templates?.title ?? "?"}: ${r.completion_rate}%${r.comment ? ` — ${r.comment}` : ""}`).join("\n") || "Aucune"}

IDS capturés:
${(ids ?? []).map((i: any) => `- [${i.status}] ${i.capture_text}${i.proposed_solution ? ` → ${i.proposed_solution}` : ""}`).join("\n") || "Aucun"}

Objectifs actifs:
${(objs ?? []).map((o: any) => `- ${o.title}`).join("\n") || "Aucun"}

Génère un JSON avec exactement ces clés: executive_summary (200-250 mots), kpi_synthesis (100 mots), management_synthesis (80 mots), ids_synthesis (100 mots), key_actions (array de 3-5 strings d'actions prioritaires).`;

    const openaiResp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 1500,
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Tu es l'assistant de synthèse du SPA OMS. Tu génères des synthèses de réunions de management de spa, concises et orientées action. Ton ton est professionnel, direct, positif. Tu t'appuies sur des données chiffrées.",
          },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!openaiResp.ok) {
      const t = await openaiResp.text();
      console.error("OpenAI error:", t);
      return json({ error: "AI generation failed" }, 500);
    }

    const completion = await openaiResp.json();
    const content = completion.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content);

    const upsertPayload = {
      report_id,
      executive_summary: parsed.executive_summary ?? null,
      kpi_synthesis: parsed.kpi_synthesis ?? null,
      management_synthesis: parsed.management_synthesis ?? null,
      ids_synthesis: parsed.ids_synthesis ?? null,
      key_actions: JSON.stringify(parsed.key_actions ?? []),
      model_used: "gpt-4o",
      generated_by_agent: "generate-meeting-summary",
      language: "fr",
      tokens_used: completion.usage?.total_tokens ?? null,
      updated_at: new Date().toISOString(),
    };

    const { data: summary, error: upErr } = await admin
      .from("meeting_summaries")
      .upsert(upsertPayload, { onConflict: "report_id" })
      .select()
      .single();
    if (upErr) throw upErr;

    await admin
      .from("reports")
      .update({ ai_synthesis_generated_at: new Date().toISOString() })
      .eq("id", report_id);

    return json({ data: summary }, 200);
  } catch (e) {
    return internalError(e);
  }
});
