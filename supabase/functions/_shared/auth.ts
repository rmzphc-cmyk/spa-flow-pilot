import { createClient } from "jsr:@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export type Caller = {
  userId: string;
  role: string;
  spaId: string | null;
};

export async function authenticate(req: Request): Promise<
  { ok: true; caller: Caller; admin: ReturnType<typeof createClient> } | { ok: false; response: Response }
> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { ok: false, response: json({ error: "Unauthorized" }, 401) };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error } = await authClient.auth.getUser();
  if (error || !user) {
    return { ok: false, response: json({ error: "Unauthorized" }, 401) };
  }

  const appMeta = user.app_metadata ?? {};
  const caller: Caller = {
    userId: user.id,
    role: (appMeta.role as string) ?? "anonymous",
    spaId: appMeta.spa_id ? (appMeta.spa_id as string) : null,
  };

  const admin = createClient(supabaseUrl, serviceKey);
  return { ok: true, caller, admin };
}

export async function authorizeReportAccess(
  admin: ReturnType<typeof createClient>,
  caller: Caller,
  reportId: string,
): Promise<{ ok: true; report: any } | { ok: false; response: Response }> {
  const { data: report, error } = await admin
    .from("reports")
    .select("*")
    .eq("id", reportId)
    .maybeSingle();

  if (error) {
    console.error("authorizeReportAccess error", error);
    return { ok: false, response: json({ error: "Internal server error" }, 500) };
  }
  if (!report) return { ok: false, response: json({ error: "Rapport introuvable." }, 404) };

  if (caller.role === "admin") return { ok: true, report };
  if (caller.role === "spa_manager" && report.spa_id === caller.spaId) {
    return { ok: true, report };
  }
  return { ok: false, response: json({ error: "Forbidden" }, 403) };
}

export function internalError(e: unknown): Response {
  console.error("Edge function error:", e);
  return json({ error: "Internal server error" }, 500);
}
