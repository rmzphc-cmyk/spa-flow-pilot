import { authenticate, authorizeReportAccess, corsHeaders, internalError, json } from "../_shared/auth.ts";

type Lang = "fr" | "en" | "es";

const SUPPORTED_LANGS: Lang[] = ["fr", "en", "es"];

const normalizeLang = (raw: unknown): Lang => {
  if (typeof raw !== "string") return "fr";
  const v = raw.toLowerCase().slice(0, 2);
  return (SUPPORTED_LANGS as string[]).includes(v) ? (v as Lang) : "fr";
};

const SYSTEM_PROMPTS: Record<Lang, string> = {
  fr: "Tu es l'assistant de synthèse du SPA OMS. Tu génères des synthèses de réunions de management de spa, concises et orientées action. Ton ton est professionnel, direct, positif. Tu t'appuies sur des données chiffrées. Tu rédiges TOUS les champs en français.",
  en: "You are the SPA OMS synthesis assistant. You generate concise, action-oriented summaries of spa management meetings. Your tone is professional, direct, and positive. You rely on quantitative data. You write ALL fields in English.",
  es: "Eres el asistente de síntesis de SPA OMS. Generas síntesis de reuniones de gestión de spa, concisas y orientadas a la acción. Tu tono es profesional, directo y positivo. Te apoyas en datos cuantitativos. Redactas TODOS los campos en español.",
};

const OUTPUT_INSTRUCTIONS: Record<Lang, string> = {
  fr: 'Génère un JSON avec exactement ces clés: executive_summary (200-250 mots), kpi_synthesis (100 mots), management_synthesis (80 mots), ids_synthesis (100 mots), key_actions (array de 3-5 strings d\'actions prioritaires). Rédige TOUT le contenu en français.',
  en: 'Generate a JSON object with exactly these keys: executive_summary (200-250 words), kpi_synthesis (100 words), management_synthesis (80 words), ids_synthesis (100 words), key_actions (array of 3-5 priority action strings). Write ALL content in English.',
  es: 'Genera un JSON con exactamente estas claves: executive_summary (200-250 palabras), kpi_synthesis (100 palabras), management_synthesis (80 palabras), ids_synthesis (100 palabras), key_actions (array de 3-5 strings de acciones prioritarias). Redacta TODO el contenido en español.',
};

const DATA_LABELS: Record<Lang, {
  header: (cycle: string, ps: string, pe: string) => string;
  kpiStats: (e: number, g: number, a: number, r: number) => string;
  kpiTitle: string;
  kpiNone: string;
  n1: string;
  status: string;
  checkinTitle: string;
  checkinLine: (m: number, f: number, ctx?: string | null) => string;
  none: string;
  respTitle: string;
  respNone: string;
  idsTitle: string;
  idsNone: string;
  objTitle: string;
  objNone: string;
  objClosedTitle: string;
  objAchieved: string;
  objAbandoned: string;
  objSteps: (done: number, total: number) => string;
  objTarget: (target: string) => string;
  situations: Record<string, string>;
  transcriptTitle: string;
}> = {
  fr: {
    header: (c, ps, pe) => `Données du cycle "${c}" (période ${ps} → ${pe}).`,
    kpiStats: (e, g, a, r) => `KPIs excellents : ${e}, bons : ${g}, à surveiller : ${a}, insuffisants : ${r}`,
    kpiTitle: "KPI:",
    kpiNone: "Aucun",
    n1: "N-1",
    status: "statut",
    checkinTitle: "Check-in équipe:",
    checkinLine: (m, f, ctx) => `humeur ${m}/5, focus ${f}/5${ctx ? ` — ${ctx}` : ""}`,
    none: "Aucun",
    respTitle: "Responsabilités:",
    respNone: "Aucune",
    idsTitle: "IDS capturés:",
    idsNone: "Aucun",
    objTitle: "Objectifs actifs (avec journal des actions hebdo):",
    objNone: "Aucun",
    objClosedTitle: "Objectifs clôturés sur la période:",
    objAchieved: "atteint",
    objAbandoned: "abandonné",
    objSteps: (d, t) => `projet : ${d}/${t} étapes`,
    objTarget: (x) => `cible ${x}`,
    situations: { on_track: "en bonne voie", complicated: "compliqué", struggling: "en difficulté" },
    transcriptTitle: "Transcript de la réunion (Whisper, extrait) :",
  },
  en: {
    header: (c, ps, pe) => `Cycle "${c}" data (period ${ps} → ${pe}).`,
    kpiStats: (e, g, a, r) => `Excellent KPIs: ${e}, good: ${g}, to watch: ${a}, insufficient: ${r}`,
    kpiTitle: "KPI:",
    kpiNone: "None",
    n1: "Y-1",
    status: "status",
    checkinTitle: "Team check-in:",
    checkinLine: (m, f, ctx) => `mood ${m}/5, focus ${f}/5${ctx ? ` — ${ctx}` : ""}`,
    none: "None",
    respTitle: "Responsibilities:",
    respNone: "None",
    idsTitle: "Captured IDS:",
    idsNone: "None",
    objTitle: "Active objectives (with weekly action journal):",
    objNone: "None",
    objClosedTitle: "Objectives closed during the period:",
    objAchieved: "achieved",
    objAbandoned: "abandoned",
    objSteps: (d, t) => `project: ${d}/${t} steps`,
    objTarget: (x) => `target ${x}`,
    situations: { on_track: "on track", complicated: "complicated", struggling: "struggling" },
    transcriptTitle: "Meeting transcript (Whisper, excerpt):",
  },
  es: {
    header: (c, ps, pe) => `Datos del ciclo "${c}" (periodo ${ps} → ${pe}).`,
    kpiStats: (e, g, a, r) => `KPIs excelentes: ${e}, buenos: ${g}, a vigilar: ${a}, insuficientes: ${r}`,
    kpiTitle: "KPI:",
    kpiNone: "Ninguno",
    n1: "A-1",
    status: "estado",
    checkinTitle: "Check-in del equipo:",
    checkinLine: (m, f, ctx) => `ánimo ${m}/5, foco ${f}/5${ctx ? ` — ${ctx}` : ""}`,
    none: "Ninguno",
    respTitle: "Responsabilidades:",
    respNone: "Ninguna",
    idsTitle: "IDS capturados:",
    idsNone: "Ninguno",
    objTitle: "Objetivos activos (con diario de acciones semanal):",
    objNone: "Ninguno",
    objClosedTitle: "Objetivos cerrados durante el periodo:",
    objAchieved: "logrado",
    objAbandoned: "abandonado",
    objSteps: (d, t) => `proyecto: ${d}/${t} etapas`,
    objTarget: (x) => `meta ${x}`,
    situations: { on_track: "en buen camino", complicated: "complicado", struggling: "en dificultad" },
    transcriptTitle: "Transcripción de la reunión (Whisper, extracto):",
  },
};

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

    const body = (await req.json()) as { report_id?: string; language?: string };
    const { report_id } = body;
    const lang: Lang = normalizeLang(body.language);
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

    const transcriptText: string | null =
      existing?.transcript_status === "done" ? existing.transcript_text ?? null : null;

    const [{ data: kpis }, { data: checkin }, { data: resps }, { data: ids }, { data: objs }, { data: closedObjs }] =
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
          .select("id, title, description, status, kind, metric, unit, start_value, target_value, current_value")
          .eq("spa_id", report.spa_id)
          .eq("status", "active"),
        admin
          .from("objectives")
          .select("id, title, status, updated_at")
          .eq("spa_id", report.spa_id)
          .in("status", ["achieved", "abandoned"])
          .gte("updated_at", report.period_start),
      ]);

    // Journal + étapes des objectifs actifs (Phase 3 : l'IA lit le journal
    // hebdo pour nourrir le bilan mensuel).
    const objIdList = (objs ?? []).map((o: any) => o.id);
    let objUpdates: any[] = [];
    let objSteps: any[] = [];
    if (objIdList.length > 0) {
      const [u, s] = await Promise.all([
        admin
          .from("objective_updates")
          .select("objective_id, action_text, value, situation, created_at")
          .in("objective_id", objIdList)
          .order("created_at", { ascending: false })
          .limit(60),
        admin
          .from("objective_steps")
          .select("objective_id, is_done")
          .in("objective_id", objIdList),
      ]);
      objUpdates = u.data ?? [];
      objSteps = s.data ?? [];
    }

    const kpisListPrompt = kpis ?? [];
    const excellentKpisCount = kpisListPrompt.filter((k: any) => k.status === "excellent").length;
    const greenKpisCount = kpisListPrompt.filter((k: any) => k.status === "green").length;
    const amberKpisCount = kpisListPrompt.filter((k: any) => k.status === "amber").length;
    const redKpisCount = kpisListPrompt.filter((k: any) => k.status === "red").length;

    const L = DATA_LABELS[lang];

    // Une ligne par objectif actif : état (colonnes réelles, blob legacy en
    // repli) + jusqu'à 5 entrées de journal (les plus récentes d'abord).
    const buildObjectiveLines = (o: any): string => {
      let blob: any = {};
      try {
        blob = JSON.parse(o.description ?? "{}");
      } catch {
        // Blob legacy illisible : les colonnes réelles suffisent.
      }
      const isProject = o.kind === "steps";
      const steps = objSteps.filter((s: any) => s.objective_id === o.id);
      const done = steps.filter((s: any) => s.is_done).length;
      const unit = o.unit ?? blob.unit ?? "";
      const target = isProject
        ? (steps.length || blob.target || 0)
        : (o.target_value ?? blob.target ?? 0);
      const current = isProject ? done : (o.current_value ?? blob.current ?? 0);
      const head = isProject
        ? `- "${o.title}" (${L.objSteps(current, target)})`
        : `- "${o.title}" (${o.metric ?? blob.metric ?? "?"}: ${current}${unit}, ${L.objTarget(`${target}${unit}`)})`;
      const lines = objUpdates
        .filter((u: any) => u.objective_id === o.id)
        .slice(0, 5)
        .map((u: any) => {
          const situation = u.situation ? L.situations[u.situation] ?? u.situation : null;
          const value = u.value !== null && u.value !== undefined ? ` (${u.value}${unit})` : "";
          return `  · [${(u.created_at ?? "").slice(0, 10)}${situation ? `, ${situation}` : ""}] ${u.action_text ?? ""}${value}`;
        });
      return [head, ...lines].join("\n");
    };

    const userPrompt = `${L.header(report.cycle_label, report.period_start, report.period_end)}

${L.kpiStats(excellentKpisCount, greenKpisCount, amberKpisCount, redKpisCount)}

${L.kpiTitle}
${(kpis ?? []).map((k: any) => `- ${k.kpi_definitions?.name ?? "?"}: ${k.value_current ?? "n/a"}${k.kpi_definitions?.unit ?? ""} (${L.n1}: ${k.value_n1 ?? "n/a"}, ${L.status}: ${k.status})${k.comment ? ` — ${k.comment}` : ""}`).join("\n") || L.kpiNone}

${L.checkinTitle}
${checkin ? L.checkinLine(checkin.mood_score, checkin.focus_level, checkin.key_context) : L.none}

${L.respTitle}
${(resps ?? []).map((r: any) => `- ${r.responsibility_templates?.title ?? "?"}: ${r.completion_rate}%${r.comment ? ` — ${r.comment}` : ""}`).join("\n") || L.respNone}

${L.idsTitle}
${(ids ?? []).map((i: any) => `- [${i.status}] ${i.capture_text}${i.proposed_solution ? ` → ${i.proposed_solution}` : ""}`).join("\n") || L.idsNone}

${L.objTitle}
${(objs ?? []).map(buildObjectiveLines).join("\n") || L.objNone}

${L.objClosedTitle}
${(closedObjs ?? []).map((o: any) => `- "${o.title}" (${o.status === "achieved" ? L.objAchieved : L.objAbandoned})`).join("\n") || L.objNone}

${OUTPUT_INSTRUCTIONS[lang]}${transcriptText ? `\n\n${L.transcriptTitle}\n${transcriptText.slice(0, 3000)}` : ""}`;

    // Localized fallback labels
    const FB: Record<Lang, {
      meeting: (c: string, ps: string, pe: string) => string;
      followed: (n: number, e: number, g: number, a: number, r: number) => string;
      mood: (m: number, f: number) => string;
      respAvg: (n: number, p: number) => string;
      problems: (n: number, open: number) => string;
      objectives: (n: number) => string;
      autogen: string;
      actionRed: (n: number) => string;
      actionConsolidate: string;
      actionObjectives: (n: number) => string;
      actionIds: string;
      kpiSynth: (n: number, g: number, a: number, r: number) => string;
      kpiNone: string;
      mgmtWithCheckin: (m: number, f: number, p: number) => string;
      mgmtNoCheckin: (p: number) => string;
      idsSynth: (n: number, open: number) => string;
      idsNone: string;
    }> = {
      fr: {
        meeting: (c, ps, pe) => `Réunion ${c} (${ps} → ${pe}). `,
        followed: (n, e, g, a, r) => `${n} indicateurs suivis (${e} excellents, ${g} bons, ${a} à surveiller, ${r} insuffisants). `,
        mood: (m, f) => `Humeur équipe : ${m}/5, focus ${f}/5. `,
        respAvg: (n, p) => `${n} responsabilités évaluées (moyenne ${p}%). `,
        problems: (n, open) => `${n} problème(s) identifié(s)${open ? `, ${open} encore ouvert(s)` : ""}. `,
        objectives: (n) => `${n} objectif(s) actif(s). `,
        autogen: "[Synthèse générée automatiquement — enrichissez via la section Modifier]",
        actionRed: (n) => `Traiter les ${n} KPI en alerte rouge`,
        actionConsolidate: "Consolider les KPI et maintenir la performance",
        actionObjectives: (n) => `Suivre les ${n} objectif(s) actif(s)`,
        actionIds: "Valider les actions issues des IDS capturés",
        kpiSynth: (n, g, a, r) => `Sur ${n} indicateurs, ${g} sont au vert, ${a} en vigilance et ${r} en alerte rouge. Prioriser les actions correctives sur les KPI rouges.`,
        kpiNone: "Aucun KPI suivi sur ce cycle.",
        mgmtWithCheckin: (m, f, p) => `Humeur équipe à ${m}/5 et focus à ${f}/5. Moyenne de complétion des responsabilités : ${p}%.`,
        mgmtNoCheckin: (p) => `Pas de check-in renseigné. Moyenne de complétion des responsabilités : ${p}%.`,
        idsSynth: (n, open) => `${n} problème(s) capturé(s) dont ${open} encore ouvert(s). Convertir en actions concrètes ou objectifs.`,
        idsNone: "Aucun problème capturé via IDS sur ce cycle.",
      },
      en: {
        meeting: (c, ps, pe) => `Meeting ${c} (${ps} → ${pe}). `,
        followed: (n, e, g, a, r) => `${n} indicators tracked (${e} excellent, ${g} good, ${a} to watch, ${r} insufficient). `,
        mood: (m, f) => `Team mood: ${m}/5, focus ${f}/5. `,
        respAvg: (n, p) => `${n} responsibilities evaluated (average ${p}%). `,
        problems: (n, open) => `${n} issue(s) identified${open ? `, ${open} still open` : ""}. `,
        objectives: (n) => `${n} active objective(s). `,
        autogen: "[Summary auto-generated — enrich via the Edit section]",
        actionRed: (n) => `Address the ${n} red-alert KPI(s)`,
        actionConsolidate: "Consolidate KPIs and maintain performance",
        actionObjectives: (n) => `Track the ${n} active objective(s)`,
        actionIds: "Validate actions from captured IDS",
        kpiSynth: (n, g, a, r) => `Out of ${n} indicators, ${g} are green, ${a} on watch and ${r} in red alert. Prioritize corrective actions on red KPIs.`,
        kpiNone: "No KPI tracked in this cycle.",
        mgmtWithCheckin: (m, f, p) => `Team mood at ${m}/5 and focus at ${f}/5. Average responsibility completion: ${p}%.`,
        mgmtNoCheckin: (p) => `No check-in recorded. Average responsibility completion: ${p}%.`,
        idsSynth: (n, open) => `${n} issue(s) captured, of which ${open} still open. Convert into concrete actions or objectives.`,
        idsNone: "No issue captured via IDS in this cycle.",
      },
      es: {
        meeting: (c, ps, pe) => `Reunión ${c} (${ps} → ${pe}). `,
        followed: (n, e, g, a, r) => `${n} indicadores monitoreados (${e} excelentes, ${g} buenos, ${a} a vigilar, ${r} insuficientes). `,
        mood: (m, f) => `Ánimo del equipo: ${m}/5, foco ${f}/5. `,
        respAvg: (n, p) => `${n} responsabilidades evaluadas (media ${p}%). `,
        problems: (n, open) => `${n} problema(s) identificado(s)${open ? `, ${open} aún abierto(s)` : ""}. `,
        objectives: (n) => `${n} objetivo(s) activo(s). `,
        autogen: "[Síntesis generada automáticamente — enriquezca desde la sección Editar]",
        actionRed: (n) => `Tratar los ${n} KPI en alerta roja`,
        actionConsolidate: "Consolidar los KPI y mantener el rendimiento",
        actionObjectives: (n) => `Dar seguimiento a los ${n} objetivo(s) activo(s)`,
        actionIds: "Validar las acciones derivadas de los IDS capturados",
        kpiSynth: (n, g, a, r) => `De ${n} indicadores, ${g} están en verde, ${a} en vigilancia y ${r} en alerta roja. Priorizar acciones correctivas en los KPI rojos.`,
        kpiNone: "Ningún KPI monitoreado en este ciclo.",
        mgmtWithCheckin: (m, f, p) => `Ánimo del equipo en ${m}/5 y foco en ${f}/5. Media de cumplimiento de responsabilidades: ${p}%.`,
        mgmtNoCheckin: (p) => `Sin check-in registrado. Media de cumplimiento de responsabilidades: ${p}%.`,
        idsSynth: (n, open) => `${n} problema(s) capturado(s), de los cuales ${open} aún abierto(s). Convertir en acciones concretas u objetivos.`,
        idsNone: "Ningún problema capturado vía IDS en este ciclo.",
      },
    };

    // Build template fallback from real data (used when OpenAI is unavailable or fails)
    const buildFallback = () => {
      const f = FB[lang];
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
      const idsOpen = idsList.filter((i: any) => i.status !== "converted" && i.status !== "closed_no_action").length;

      const executive_summary =
        f.meeting(report.cycle_label, report.period_start, report.period_end) +
        f.followed(kpisList.length, excellentKpis, greenKpis, amberKpis, redKpis) +
        `${checkin ? f.mood(checkin.mood_score, checkin.focus_level) : ""}` +
        f.respAvg(respsList.length, avgResp) +
        f.problems(idsList.length, idsOpen) +
        f.objectives(objsList.length) +
        f.autogen;

      const key_actions = [
        redKpis > 0 ? f.actionRed(redKpis) : f.actionConsolidate,
        f.actionObjectives(objsList.length),
        f.actionIds,
      ];

      const kpi_synthesis = kpisList.length
        ? f.kpiSynth(kpisList.length, greenKpis, amberKpis, redKpis)
        : f.kpiNone;

      const management_synthesis = checkin
        ? f.mgmtWithCheckin(checkin.mood_score, checkin.focus_level, avgResp)
        : f.mgmtNoCheckin(avgResp);

      const ids_synthesis = idsList.length
        ? f.idsSynth(idsList.length, idsOpen)
        : f.idsNone;

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
                content: SYSTEM_PROMPTS[lang],
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
      language: lang,
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
