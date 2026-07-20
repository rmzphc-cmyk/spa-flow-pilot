import { authenticate, corsHeaders, internalError, json } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authResult = await authenticate(req);
    if (!authResult.ok) return authResult.response;
    const { caller, admin } = authResult;

    if (caller.role !== "spa_manager" && caller.role !== "admin") {
      return json({ error: "Forbidden" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const meeting_schedule = body?.meeting_schedule;
    if (!meeting_schedule) {
      return json({ error: "Missing meeting_schedule" }, 400);
    }

    const targetSpaId: string | null =
      caller.role === "admin" ? (body?.spa_id ?? caller.spaId ?? null) : caller.spaId;

    if (!targetSpaId) {
      return json({ error: "No spa associated to this user" }, 400);
    }

    const { error } = await admin
      .from("spas")
      .update({ meeting_schedule })
      .eq("id", targetSpaId);

    if (error) {
      console.error("update-meeting-schedule update error", error);
      return json({ error: error.message }, 500);
    }

    return json({ success: true }, 200);
  } catch (e) {
    return internalError(e);
  }
});
