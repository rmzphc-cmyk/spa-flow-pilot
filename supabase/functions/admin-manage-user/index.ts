import { authenticate, corsHeaders, internalError, json } from "../_shared/auth.ts";

type Action = "invite" | "update" | "delete";

interface Payload {
  action: Action;
  user_id?: string;
  email?: string;
  full_name?: string;
  role?: "spa_manager" | "direction";
  spa_id?: string | null;
  destination_id?: string | null;
  organization_id?: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = await authenticate(req);
    if (!auth.ok) return auth.response;
    const { caller, admin } = auth;

    if (caller.role !== "admin") return json({ error: "Forbidden" }, 403);

    const body = (await req.json()) as Payload;
    if (!body?.action) return json({ error: "Missing action" }, 400);

    if (body.action === "invite") {
      if (!body.email || !body.role) return json({ error: "Missing email or role" }, 400);
      if (body.role === "spa_manager" && !body.spa_id) {
        return json({ error: "spa_id required for spa_manager" }, 400);
      }
      if (body.role === "direction" && !body.destination_id && !body.organization_id) {
        return json({ error: "destination_id or organization_id required for direction" }, 400);
      }

      const tempPassword = `Tmp-${crypto.randomUUID().slice(0, 12)}!A1`;
      const { data: created, error: createErr } = await (admin as any).auth.admin.createUser({
        email: body.email,
        password: tempPassword,
        email_confirm: true,
        app_metadata: {
          role: body.role,
          spa_id: body.role === "spa_manager" ? body.spa_id : "",
        },
        user_metadata: {
          full_name: body.full_name ?? "",
        },
      });
      if (createErr || !created?.user) {
        return json({ error: createErr?.message ?? "createUser failed" }, 400);
      }

      // handle_new_user trigger has already inserted into public.users with role + spa_id.
      // Now patch with destination_id / organization_id / full_name.
      const update: Record<string, unknown> = {};
      if (body.destination_id !== undefined) update.destination_id = body.destination_id;
      if (body.organization_id !== undefined) update.organization_id = body.organization_id;
      if (body.full_name) update.full_name = body.full_name;

      if (Object.keys(update).length > 0) {
        const { error: updErr } = await admin.from("users").update(update).eq("id", created.user.id);
        if (updErr) return json({ error: updErr.message }, 400);
      }

      return json({ ok: true, user_id: created.user.id, temp_password: tempPassword }, 200);
    }

    if (body.action === "update") {
      if (!body.user_id) return json({ error: "Missing user_id" }, 400);

      const update: Record<string, unknown> = {};
      if (body.full_name !== undefined) update.full_name = body.full_name;
      if (body.role !== undefined) update.role = body.role;
      if (body.spa_id !== undefined) update.spa_id = body.spa_id;
      if (body.destination_id !== undefined) update.destination_id = body.destination_id;
      if (body.organization_id !== undefined) update.organization_id = body.organization_id;

      if (Object.keys(update).length > 0) {
        const { error: updErr } = await admin.from("users").update(update).eq("id", body.user_id);
        if (updErr) return json({ error: updErr.message }, 400);
      }

      // Sync app_metadata for role/spa_id changes
      if (body.role !== undefined || body.spa_id !== undefined) {
        const { data: cur } = await admin.from("users").select("role, spa_id").eq("id", body.user_id).maybeSingle();
        if (cur) {
          await (admin as any).auth.admin.updateUserById(body.user_id, {
            app_metadata: { role: cur.role, spa_id: cur.spa_id ?? "" },
          });
        }
      }

      return json({ ok: true }, 200);
    }

    if (body.action === "delete") {
      if (!body.user_id) return json({ error: "Missing user_id" }, 400);
      const { error: delErr } = await (admin as any).auth.admin.deleteUser(body.user_id);
      if (delErr) return json({ error: delErr.message }, 400);
      return json({ ok: true }, 200);
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return internalError(e);
  }
});
