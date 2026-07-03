import { authenticate, authorizeReportAccess, corsHeaders, internalError, json } from "../_shared/auth.ts";
import { notifyDirectionReportValidated } from "../_shared/email.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = await authenticate(req);
    if (!auth.ok) return auth.response;
    const { caller, admin } = auth;

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      console.error("OPENAI_API_KEY missing");
      return json({ error: "AI generation unavailable" }, 500);
    }

    const { report_id, notify } = (await req.json()) as { report_id?: string; notify?: boolean };
    if (!report_id) return json({ error: "Missing report_id" }, 400);

    const access = await authorizeReportAccess(admin, caller, report_id);
    if (!access.ok) return access.response;
    const report = access.report;

    const [{ data: kpis }, { data: ids }, { data: objs }] = await Promise.all([
      admin
        .from("kpi_entries")
        .select("*, kpi_definitions(name, unit)")
        .eq("report_id", report_id),
      admin
        .from("ids_items")
        .select("capture_text")
        .eq("report_id", report_id)
        .eq("cycle_type", "weekly"),
      admin
        .from("objectives")
        .select("id, title, kind, metric, unit, start_value, target_value, current_value, description")
        .eq("spa_id", report.spa_id)
        .eq("status", "active"),
    ]);

    // Journal des objectifs (Phase 3) : la synthèse lit les dernières entrées.
    // Celles liées à CE rapport sont marquées « cette semaine ».
    const objIds = (objs ?? []).map((o: any) => o.id);
    let objUpdates: any[] = [];
    let objSteps: any[] = [];
    if (objIds.length > 0) {
      const [u, s] = await Promise.all([
        admin
          .from("objective_updates")
          .select("objective_id, action_text, value, situation, created_at, report_id")
          .in("objective_id", objIds)
          .order("created_at", { ascending: false })
          .limit(40),
        admin
          .from("objective_steps")
          .select("objective_id, is_done")
          .in("objective_id", objIds),
      ]);
      objUpdates = u.data ?? [];
      objSteps = s.data ?? [];
    }

    const SITUATION_FR: Record<string, string> = {
      on_track: "en bonne voie",
      complicated: "compliqué",
      struggling: "en difficulté",
    };
    const objectivesBlock = (objs ?? [])
      .map((o: any) => {
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
          ? `- "${o.title}" (projet : ${current}/${target} étapes)`
          : `- "${o.title}" (${o.metric ?? blob.metric ?? "indicateur"} : ${current}${unit}, cible ${target}${unit})`;
        const lines = objUpdates
          .filter((u: any) => u.objective_id === o.id)
          .slice(0, 3)
          .map((u: any) => {
            const when = u.report_id === report_id ? "cette semaine" : (u.created_at ?? "").slice(0, 10);
            const situation = u.situation ? SITUATION_FR[u.situation] ?? u.situation : null;
            const value = u.value !== null && u.value !== undefined ? ` (valeur : ${u.value}${unit})` : "";
            return `  · [${when}${situation ? `, ${situation}` : ""}] ${u.action_text ?? ""}${value}`;
          });
        return [head, ...lines].join("\n");
      })
      .join("\n");

    const userPrompt = `Semaine "${report.cycle_label}" (${report.period_start} → ${report.period_end}).

KPI:
${(kpis ?? []).map((k: any) => `- ${k.kpi_definitions?.name ?? "?"}: ${k.value_current ?? "n/a"}${k.kpi_definitions?.unit ?? ""} (statut ${k.status})${k.comment ? ` — ${k.comment}` : ""}`).join("\n") || "Aucun"}

IDS:
${(ids ?? []).map((i: any) => `- ${i.capture_text}`).join("\n") || "Aucun"}

Objectifs long terme (journal des dernières semaines):
${objectivesBlock || "Aucun"}

Génère un JSON: { executive_summary (150 mots max — mentionne l'avancement des objectifs, en particulier ceux signalés en difficulté), key_actions (array de 3 strings max) }.`;

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
      console.error("OpenAI error:", t);
      return json({ error: "AI generation failed" }, 500);
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

    // Diffusion à la Direction uniquement quand l'appel vient de la finalisation
    // (notify=true depuis finalize-weekly-report). Non bloquant.
    if (notify) {
      try {
        await notifyDirectionReportValidated(admin, report, parsed.executive_summary ?? null);
      } catch (_notifErr) {
        // Diffusion non bloquante
      }
    }

    return json({ data: summary }, 200);
  } catch (e) {
    return internalError(e);
  }
});
