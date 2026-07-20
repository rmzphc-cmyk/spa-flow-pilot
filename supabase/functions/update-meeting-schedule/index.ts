import { authenticate, corsHeaders, internalError, json } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authResult = await authenticate(req);
    if (!authResult.ok) return authResult.response;
    const { caller, admin } = authResult;

    if (caller.role !== "spa_manager" && caller.role !== "admin" && caller.role !== "direction") {
      return json({ error: "Forbidden" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const meeting_schedule = body?.meeting_schedule;
    if (!meeting_schedule) {
      return json({ error: "Missing meeting_schedule" }, 400);
    }

    const targetSpaId: string | null =
      caller.role === "spa_manager" ? caller.spaId : (body?.spa_id ?? caller.spaId ?? null);

    if (!targetSpaId) {
      return json({ error: "No spa associated to this user" }, 400);
    }

    if (caller.role === "direction") {
      const [{ data: directionUser, error: userError }, { data: targetSpa, error: spaError }] =
        await Promise.all([
          admin
            .from("users")
            .select("destination_id")
            .eq("id", caller.userId)
            .maybeSingle(),
          admin
            .from("spas")
            .select("destination_id")
            .eq("id", targetSpaId)
            .maybeSingle(),
        ]);

      if (userError || spaError) {
        console.error("update-meeting-schedule scope lookup error", { userError, spaError });
        return json({ error: "Internal server error" }, 500);
      }

      if (
        !directionUser?.destination_id ||
        !targetSpa?.destination_id ||
        directionUser.destination_id !== targetSpa.destination_id
      ) {
        return json({ error: "Forbidden" }, 403);
      }
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
