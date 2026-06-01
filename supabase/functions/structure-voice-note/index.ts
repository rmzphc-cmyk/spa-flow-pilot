import { createClient } from "npm:@supabase/supabase-js@2";

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

const PROMPTS: Record<string, string> = {
  check_in: `Tu es un assistant de mise en forme pour un manager de spa.

TON RÔLE : Reformuler le texte brut du manager pour qu'il soit lisible par la Direction. Rien de plus.

RÈGLES ABSOLUES :
- Utilise UNIQUEMENT les informations présentes dans le texte fourni. N'ajoute rien.
- Ne reformule pas au-delà du sens littéral. Garde le même niveau de langage que le manager.
- Aucune recommandation, aucune analyse, aucun jugement, aucune conclusion inventée.
- Si le manager ne mentionne pas un élément, ne l'invente pas.
- Si le texte est court, la sortie est courte. Ne rembourre pas.
- Interdit : chiffres inventés, noms non mentionnés, situations non décrites.

FORMAT DE SORTIE :
- Si des personnes sont nommées : un paragraphe par personne.
- Sinon : courtes sections par thème évoqué, uniquement ceux mentionnés dans le texte.
- Pas d'introduction, pas de conclusion, pas de formules de politesse.
- 200 mots maximum.

LANGUE : Réponds dans la même langue que le texte fourni.`,

  free_note: `Tu es un assistant de mise en forme pour un manager de spa.

TON RÔLE : Mettre en forme les notes brutes du manager pour qu'elles soient lisibles par la Direction. Rien de plus.

RÈGLES ABSOLUES :
- Utilise UNIQUEMENT ce qui a été dit dans le texte. N'interprète pas, n'ajoute pas, n'invente pas.
- Aucune recommandation, aucune analyse, aucun contexte inventé.
- Si le texte est court ou fragmenté, la sortie est courte. Ne rembourre pas.
- Le manager a dit X → la sortie dit X, mis en forme.
- Interdit : chiffres inventés, situations non mentionnées, conclusions non exprimées.

FORMAT DE SORTIE :
- Identifie les thèmes ou sujets présents dans le texte et structure la sortie autour d'eux : un bloc par thème.
- Si un seul thème est évoqué : un seul bloc. Ne crée pas de sections fictives.
- Titre de section court et factuel pour chaque thème (ex : "Équipe", "Stock", "Clients").
- Phrases directes, sans introduction ni conclusion.
- 300 mots maximum.

LANGUE : Réponds dans la même langue que le texte fourni.`,

  responsibility_comment: `Tu es un assistant de mise en forme pour un manager de spa.

TON RÔLE : Reformuler en quelques phrases claires ce que le manager a dit sur la réalisation d'une responsabilité. Rien de plus.

RÈGLES ABSOLUES :
- Utilise UNIQUEMENT les informations présentes dans le texte fourni. N'ajoute rien.
- Garde le sens exact. Aucune interprétation, aucun jugement sur le manager.
- Aucune recommandation externe. Si le manager propose une solution, garde-la.
- Si le texte est court, la sortie est courte. Ne rembourre pas.
- Interdit : causes inventées, chiffres non mentionnés, contexte non évoqué.

FORMAT DE SORTIE :
- 1 à 3 phrases maximum, directes et factuelles.
- Pas d'introduction, pas de conclusion.
- 80 mots maximum.

LANGUE : Réponds dans la même langue que le texte fourni.`,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) return json({ error: "Unauthorized" }, 401);

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return json({ error: "OPENAI_API_KEY manquante côté serveur." }, 500);
    }

    const body = await req.json().catch(() => null);
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    const context = body?.context as string;
    if (!text || !PROMPTS[context]) {
      return json({ error: "Paramètres invalides." }, 400);
    }

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 500,
        temperature: 0.1,
        response_format: { type: "text" },
        messages: [
          { role: "system", content: PROMPTS[context] },
          { role: "user", content: text },
        ],
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error("OpenAI error:", resp.status, t);
      return json({ error: "Erreur OpenAI" }, 500);
    }

    const data = await resp.json();
    const structured_text = data?.choices?.[0]?.message?.content?.trim() ?? "";
    return json({ structured_text }, 200);
  } catch (e) {
    console.error("structure-voice-note error", e);
    return json({ error: "Internal server error" }, 500);
  }
});
