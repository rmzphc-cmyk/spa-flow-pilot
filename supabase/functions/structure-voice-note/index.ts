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
  check_in:
    "Tu es assistant pour un manager de spa. Restructure ce texte dicté en un check-in d'équipe clair et professionnel en français. Garde toutes les informations. Si des collaborateurs sont mentionnés, organise un bref paragraphe par personne. 300 mots maximum. Ne rajoute rien qui n'a pas été dit.",
  free_note:
    "Tu es assistant pour un manager de spa. Restructure ce texte dicté en une note professionnelle claire en français. Garde toutes les informations, reformule proprement. 300 mots maximum.",
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
        temperature: 0.3,
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
