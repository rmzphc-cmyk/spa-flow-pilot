import { authenticate, authorizeReportAccess, corsHeaders, internalError, json } from "../_shared/auth.ts";
import { buildMeetingSections } from "../_shared/meetingSnapshot.ts";

// =============================================================================
// Agent coach mensuel — précision-first, un seul appel structuré.
// Entrées : snapshot AVANT + état APRÈS (diff) + transcript + références.
// Sortie  : ai_output (verdict, executive_summary, highlights, decisions,
//           proposals, blind_spots), dans la langue de la réunion.
// =============================================================================

type Lang = "fr" | "en" | "es" | "ro";
const SUPPORTED: Lang[] = ["fr", "en", "es", "ro"];
const LANG_NAME: Record<Lang, string> = {
  fr: "français",
  en: "English",
  es: "español",
  ro: "română (roumain)",
};

// Whisper renvoie soit un code ISO (fr/en/es/ro), soit un nom anglais
// (french/english/spanish/romanian) — les 2 premières lettres coïncident
// pour nos 4 langues, d'où le slice(0,2).
const normalizeLang = (raw: unknown): Lang => {
  if (typeof raw !== "string") return "fr";
  const v = raw.toLowerCase().slice(0, 2);
  return (SUPPORTED as string[]).includes(v) ? (v as Lang) : "fr";
};

const buildSystemPrompt = (langName: string) => `# RÔLE
Tu es le copilote de réunion du Spa Manager de Sanagua (exploitant de spas en resort).
Tu interviens APRÈS la réunion mensuelle. Tu n'es pas un rédacteur de compte-rendu :
tu es un coach de pilotage. Ton rôle est d'aider le manager à voir ce qu'il n'a pas vu,
à transformer la discussion en décisions et en actions claires, et à ne rien laisser tomber.

# CE QUE TU REÇOIS
1. ÉTAT AVANT — l'état des sections du rapport au démarrage de la réunion.
2. ÉTAT APRÈS — les mêmes sections à la fin (manager + Direction les ont éditées en direct).
   La différence AVANT→APRÈS = ce qui a bougé pendant la réunion.
3. TRANSCRIPT — la transcription audio de la réunion (PEUT être absente).
4. RÉFÉRENCES — journal des objectifs, mémoire du mois précédent, valeurs N-1 des KPI.

# PRINCIPE ABSOLU : PRÉCISION AVANT EXHAUSTIVITÉ
- N'invente RIEN. Chaque affirmation, décision ou proposition s'appuie sur une SOURCE
  vérifiable : un changement du diff AVANT→APRÈS, ou un passage du transcript.
- Sans preuve, tu ne le dis pas. Mieux vaut 3 décisions certaines que 8 dont 4 inventées.
- Confiance basse → tu le déclares ("confidence": "low").
- Transcript absent → tu travailles sur le seul diff, tu mets "audio_used": false et tu signales
  dans blind_spots que la détection des décisions orales et des oublis est dégradée.

# SYNTHÈSE PAR EXCEPTION
Le compte-rendu (executive_summary) ne récite pas tout. Il met en avant ce qui mérite
l'attention de la Direction : ce qui a changé de façon notable, les tensions/blocages, les
engagements pris, les écarts aux objectifs et au mois précédent. Le nominal : une ligne.

# COACH FRANC
Sois direct. Objectif du mois précédent non avancé → dis-le. Décision floue (pas de responsable,
pas d'échéance) → signale-la dans blind_spots. Tu sers le manager, pas la complaisance.

# PROPOSITIONS (IDS / TO-DO / OBJECTIF)
Tu proposes — tu ne décides pas. Le manager acceptera, modifiera ou annulera chacune.
- Classement suggéré (suggested_triage) : "bloquant" (urgent+important) · "priorite"
  (important non bloquant) · "deleguer" (à confier) · "veille" (à surveiller).
- RÈGLE DE TITRE : le "title" d'une action (todo/objective) porte la SOLUTION (l'action à
  mener), JAMAIS le problème. Le problème va dans "problem".
- N'invente pas d'échéance : ne remplis "due" que si une date est explicite dans le transcript.

# LANGUE
Rédige TOUTE ta sortie (executive_summary, highlights, decisions, proposals, blind_spots)
dans la langue : ${langName}. Noms propres et termes techniques inchangés.

# FORMAT
Réponds UNIQUEMENT par un objet JSON valide conforme au schéma fourni. Aucun texte hors du JSON.`;

const OUTPUT_SCHEMA_INSTRUCTION = `=== SORTIE ATTENDUE ===
Réponds UNIQUEMENT par un objet JSON avec EXACTEMENT ces clés :
{
  "meeting_language": "code langue",
  "audio_used": true | false,
  "verdict": "on_track" | "attention" | "at_risk",
  "executive_summary": "compte-rendu par exception, 5-10 lignes",
  "highlights": [ { "label": "...", "detail": "...", "severity": "info" | "watch" | "alert", "source": "..." } ],
  "decisions": [ { "statement": "...", "owner": "..." | null, "due": "YYYY-MM-DD" | null, "source": "...", "confidence": "high" | "medium" | "low" } ],
  "proposals": [ { "type": "ids" | "todo" | "objective", "title": "l'ACTION (solution)", "problem": "..." | null, "suggested_triage": "bloquant" | "priorite" | "deleguer" | "veille" | null, "owner": "..." | null, "due": "YYYY-MM-DD" | null, "justification": "...", "source": "...", "confidence": "high" | "medium" | "low" } ],
  "blind_spots": [ "point à clarifier / décision sans responsable / oubli détecté" ]
}`;

// Messages de repli localisés (IA indisponible) — honnêtes, sans rien fabriquer.
const FALLBACK_SUMMARY: Record<Lang, string> = {
  fr: "[Synthèse IA indisponible — compte-rendu à rédiger manuellement.]",
  en: "[AI summary unavailable — report to be written manually.]",
  es: "[Síntesis de IA no disponible — redactar el informe manualmente.]",
  ro: "[Rezumat AI indisponibil — raportul trebuie redactat manual.]",
};
const FALLBACK_BLIND: Record<Lang, string> = {
  fr: "Synthèse automatique indisponible : vérifier la configuration IA (clé OpenAI).",
  en: "Automatic summary unavailable: check AI configuration (OpenAI key).",
  es: "Síntesis automática no disponible: verificar la configuración de IA (clave OpenAI).",
  ro: "Rezumat automat indisponibil: verificați configurația AI (cheia OpenAI).",
};

// ---- Normalisation défensive de la sortie GPT (drop des entrées malformées) ----
const asStr = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;

function oneOf<T extends string>(v: unknown, allowed: T[], fallback: T | null): T | null {
  return typeof v === "string" && (allowed as string[]).includes(v) ? (v as T) : fallback;
}

function normalizeCoachOutput(parsed: any, meetingLang: Lang, audioUsed: boolean) {
  const highlights = Array.isArray(parsed?.highlights)
    ? parsed.highlights
        .map((h: any) => ({
          label: asStr(h?.label) ?? "",
          detail: asStr(h?.detail) ?? "",
          severity: oneOf(h?.severity, ["info", "watch", "alert"], "info"),
          source: asStr(h?.source) ?? "",
        }))
        .filter((h: any) => h.label || h.detail)
    : [];

  const decisions = Array.isArray(parsed?.decisions)
    ? parsed.decisions
        .map((d: any) => ({
          statement: asStr(d?.statement),
          owner: asStr(d?.owner),
          due: asStr(d?.due),
          source: asStr(d?.source) ?? "",
          confidence: oneOf(d?.confidence, ["high", "medium", "low"], "medium"),
        }))
        .filter((d: any) => d.statement)
    : [];

  const proposals = Array.isArray(parsed?.proposals)
    ? parsed.proposals
        .map((p: any) => ({
          type: oneOf(p?.type, ["ids", "todo", "objective"], "ids"),
          title: asStr(p?.title),
          problem: asStr(p?.problem),
          suggested_triage: oneOf(p?.suggested_triage, ["bloquant", "priorite", "deleguer", "veille"], null),
          owner: asStr(p?.owner),
          due: asStr(p?.due),
          justification: asStr(p?.justification) ?? "",
          source: asStr(p?.source) ?? "",
          confidence: oneOf(p?.confidence, ["high", "medium", "low"], "medium"),
        }))
        .filter((p: any) => p.title)
    : [];

  const blind_spots = Array.isArray(parsed?.blind_spots)
    ? parsed.blind_spots.map(asStr).filter((s: string | null): s is string => !!s)
    : [];

  return {
    meeting_language: meetingLang,
    audio_used: audioUsed,
    verdict: oneOf(parsed?.verdict, ["on_track", "attention", "at_risk"], "attention"),
    executive_summary: asStr(parsed?.executive_summary) ?? FALLBACK_SUMMARY[meetingLang],
    highlights,
    decisions,
    proposals,
    blind_spots,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = await authenticate(req);
    if (!auth.ok) return auth.response;
    const { caller, admin } = auth;

    const openaiKey = Deno.env.get("OPENAI_API_KEY");

    const body = (await req.json()) as { report_id?: string; language?: string };
    const { report_id } = body;
    if (!report_id) return json({ error: "Missing report_id" }, 400);

    const access = await authorizeReportAccess(admin, caller, report_id);
    if (!access.ok) return access.response;
    const report = access.report;

    if (report.status !== "post_meeting_generated")
      return json({ error: "Rapport pas en post_meeting_generated." }, 409);

    // Langue de sortie = langue de la réunion (détectée par Whisper),
    // repli sur la langue passée par le frontend, repli final "fr".
    const meetingLang = normalizeLang(report.meeting_language ?? body.language);

    const { data: existing } = await admin
      .from("meeting_summaries")
      .select("*")
      .eq("report_id", report_id)
      .maybeSingle();

    // Idempotence : si le coach a déjà tourné (ai_output présent), on renvoie.
    if (existing?.ai_output) {
      return json({ data: existing }, 200);
    }

    const transcriptText: string | null =
      existing?.transcript_status === "done" ? existing.transcript_text ?? null : null;
    const audioUsed = !!(transcriptText && transcriptText.trim());

    // ---- Entrées : AVANT (snapshot) + APRÈS (état courant) ----
    const avant = report.snapshot_before_meeting ?? null;
    const apres = await buildMeetingSections(admin, report);

    // ---- Référence 1 : journal des objectifs actifs (actions hebdo du mois) ----
    const activeObjIds = (apres.objectifs as any[]).map((o) => o.id).filter(Boolean);
    let objJournal = "";
    if (activeObjIds.length) {
      const { data: updates } = await admin
        .from("objective_updates")
        .select("objective_id, action_text, value, situation, created_at")
        .in("objective_id", activeObjIds)
        .order("created_at", { ascending: false })
        .limit(40);
      const byObj = new Map<string, any[]>();
      for (const u of updates ?? []) {
        const arr = byObj.get(u.objective_id) ?? [];
        if (arr.length < 5) arr.push(u);
        byObj.set(u.objective_id, arr);
      }
      objJournal = (apres.objectifs as any[])
        .map((o: any) => {
          const ups = byObj.get(o.id) ?? [];
          if (!ups.length) return null;
          const lines = ups
            .map((u: any) => `  · [${(u.created_at ?? "").slice(0, 10)}] ${u.action_text ?? ""}${u.value != null ? ` (${u.value})` : ""}`)
            .join("\n");
          return `- "${o.title}":\n${lines}`;
        })
        .filter(Boolean)
        .join("\n");
    }

    // ---- Référence 2 : mémoire du mois précédent (dernier monthly validé) ----
    let prevMemory = "";
    const { data: prevReport } = await admin
      .from("reports")
      .select("id, period_start")
      .eq("spa_id", report.spa_id)
      .eq("cycle_type", "monthly")
      .eq("status", "validated")
      .lt("period_start", report.period_start)
      .order("period_start", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (prevReport) {
      const { data: prevSum } = await admin
        .from("meeting_summaries")
        .select("ai_output, executive_summary")
        .eq("report_id", prevReport.id)
        .maybeSingle();
      const prevDecisions = (prevSum?.ai_output as any)?.decisions;
      if (Array.isArray(prevDecisions) && prevDecisions.length) {
        prevMemory = prevDecisions
          .map((d: any) => `- ${d.statement}${d.owner ? ` (→ ${d.owner})` : ""}`)
          .join("\n");
      } else if (prevSum?.executive_summary) {
        prevMemory = prevSum.executive_summary;
      }
    }

    // ---- Construction du prompt utilisateur ----
    const userPrompt = `Rapport mensuel "${report.cycle_label}" — période ${report.period_start} → ${report.period_end}.

=== ÉTAT AVANT (au lancement de la réunion) ===
${avant ? JSON.stringify(avant) : "SNAPSHOT INDISPONIBLE (réunion démarrée avant la refonte). Diff impossible — analyse sur l'état final + transcript uniquement."}

=== ÉTAT APRÈS (fin de réunion, sections éditées en direct) ===
${JSON.stringify(apres)}

=== JOURNAL DES OBJECTIFS (actions hebdo du mois) ===
${objJournal || "Aucun."}

=== MÉMOIRE DU MOIS PRÉCÉDENT (décisions / compte-rendu) ===
${prevMemory || "Aucun rapport mensuel précédent."}

=== TRANSCRIPT DE LA RÉUNION ===
${transcriptText ?? "AUDIO ABSENT — aucune transcription. Travaille sur le seul diff AVANT→APRÈS, mets audio_used=false et signale le mode dégradé dans blind_spots."}

${OUTPUT_SCHEMA_INSTRUCTION}`;

    // ---- Appel GPT-4o ----
    let aiOutput: any = null;
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
            max_tokens: 3000,
            temperature: 0.3,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: buildSystemPrompt(LANG_NAME[meetingLang]) },
              { role: "user", content: userPrompt },
            ],
          }),
        });

        if (!openaiResp.ok) {
          console.error("OpenAI error:", openaiResp.status, await openaiResp.text());
          modelUsed = "template-fallback";
        } else {
          const completion = await openaiResp.json();
          const content = completion.choices?.[0]?.message?.content ?? "{}";
          aiOutput = normalizeCoachOutput(JSON.parse(content), meetingLang, audioUsed);
          tokensUsed = completion.usage?.total_tokens ?? null;
        }
      } catch (e) {
        console.error("OpenAI call threw:", e);
        modelUsed = "template-fallback";
      }
    } else {
      modelUsed = "template-fallback";
    }

    // Repli honnête si l'IA est indisponible (pas de fabrication de contenu).
    if (!aiOutput) {
      aiOutput = {
        meeting_language: meetingLang,
        audio_used: audioUsed,
        verdict: "attention",
        executive_summary: FALLBACK_SUMMARY[meetingLang],
        highlights: [],
        decisions: [],
        proposals: [],
        blind_spots: [FALLBACK_BLIND[meetingLang]],
      };
    }

    // key_actions (legacy) : dérivé des propositions pour les UI qui le lisent encore.
    const keyActions = (aiOutput.proposals as any[]).map((p) => p.title).slice(0, 5);

    const upsertPayload = {
      report_id,
      ai_output: aiOutput,
      executive_summary: aiOutput.executive_summary ?? null,
      key_actions: JSON.stringify(keyActions),
      model_used: modelUsed,
      generated_by_agent: "generate-meeting-summary",
      language: meetingLang,
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
