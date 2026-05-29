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

    const kpisListPrompt = kpis ?? [];
    const excellentKpisCount = kpisListPrompt.filter((k: any) => k.status === "excellent").length;
    const greenKpisCount = kpisListPrompt.filter((k: any) => k.status === "green").length;
    const amberKpisCount = kpisListPrompt.filter((k: any) => k.status === "amber").length;
    const redKpisCount = kpisListPrompt.filter((k: any) => k.status === "red").length;

    const userPrompt = `Données du cycle "${report.cycle_label}" (période ${report.period_start} → ${report.period_end}).

KPIs excellents : ${excellentKpisCount}, bons : ${greenKpisCount}, à surveiller : ${amberKpisCount}, insuffisants : ${redKpisCount}

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

    // Build template fallback from real data (used when OpenAI is unavailable or fails)
    const buildFallback = () => {
      const kpisList = kpis ?? [];
      const respsList = resps ?? [];
      const idsList = ids ?? [];
      const objsList = objs ?? [];
      const redKpis = kpisList.filter((k: any) => k.status === "red").length;
      const amberKpis = kpisList.filter((k: any) => k.status === "amber").length;
      const greenKpis = kpisList.filter((k: any) => k.status === "green").length;
      const excellentKpis = kpisList.filter((k: any) => k.status === "excellent").length;
      const avgResp = respsList.length
        ? Math.round(respsList.reduce((s: number, r: any) => s + (r.completion_rate ?? 0), 0) / respsList.length)
        : 0;
      const idsOpen = idsList.filter((i: any) => i.status !== "solved" && i.status !== "resolved").length;

      const executive_summary =
        `Réunion ${report.cycle_label} (${report.period_start} → ${report.period_end}). ` +
        `${kpisList.length} indicateurs suivis (${greenKpis} verts, ${amberKpis} ambre, ${redKpis} rouges). ` +
        `${checkin ? `Humeur équipe : ${checkin.mood_score}/5, focus ${checkin.focus_level}/5. ` : ""}` +
        `${respsList.length} responsabilités évaluées (moyenne ${avgResp}%). ` +
        `${idsList.length} problème(s) identifié(s)${idsOpen ? `, ${idsOpen} encore ouvert(s)` : ""}. ` +
        `${objsList.length} objectif(s) actif(s). ` +
        `[Synthèse générée automatiquement — enrichissez via la section Modifier]`;

      const key_actions = [
        redKpis > 0
          ? `Traiter les ${redKpis} KPI en alerte rouge`
          : "Consolider les KPI et maintenir la performance",
        `Suivre les ${objsList.length} objectif(s) actif(s)`,
        "Valider les actions issues des IDS capturés",
      ];

      const kpi_synthesis = kpisList.length
        ? `Sur ${kpisList.length} indicateurs, ${greenKpis} sont au vert, ${amberKpis} en vigilance et ${redKpis} en alerte rouge. Prioriser les actions correctives sur les KPI rouges.`
        : "Aucun KPI suivi sur ce cycle.";

      const management_synthesis = checkin
        ? `Humeur équipe à ${checkin.mood_score}/5 et focus à ${checkin.focus_level}/5. Moyenne de complétion des responsabilités : ${avgResp}%.`
        : `Pas de check-in renseigné. Moyenne de complétion des responsabilités : ${avgResp}%.`;

      const ids_synthesis = idsList.length
        ? `${idsList.length} problème(s) capturé(s) dont ${idsOpen} encore ouvert(s). Convertir en actions concrètes ou objectifs.`
        : "Aucun problème capturé via IDS sur ce cycle.";

      return {
        executive_summary,
        kpi_synthesis,
        management_synthesis,
        ids_synthesis,
        key_actions,
      };
    };

    let parsed: any = null;
    let modelUsed = "gpt-4o";
    let tokensUsed: number | null = null;

    if (openaiKey) {
      try {
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
          console.error("OpenAI raw error:", openaiResp.status, await openaiResp.text());
          parsed = buildFallback();
          modelUsed = "template-fallback";
        } else {
          const completion = await openaiResp.json();
          const content = completion.choices?.[0]?.message?.content ?? "{}";
          parsed = JSON.parse(content);
          tokensUsed = completion.usage?.total_tokens ?? null;
        }
      } catch (e) {
        console.error("OpenAI call threw:", e);
        parsed = buildFallback();
        modelUsed = "template-fallback";
      }
    } else {
      parsed = buildFallback();
      modelUsed = "template-fallback";
    }

    const upsertPayload = {
      report_id,
      executive_summary: parsed.executive_summary ?? null,
      kpi_synthesis: parsed.kpi_synthesis ?? null,
      management_synthesis: parsed.management_synthesis ?? null,
      ids_synthesis: parsed.ids_synthesis ?? null,
      key_actions: JSON.stringify(parsed.key_actions ?? []),
      model_used: modelUsed,
      generated_by_agent: "generate-meeting-summary",
      language: "fr",
      tokens_used: tokensUsed,
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
