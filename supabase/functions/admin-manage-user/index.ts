import { authenticate, corsHeaders, internalError, json } from "../_shared/auth.ts";

type Action = "invite" | "update" | "delete" | "reset";

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

    const body = (await req.json()) as Payload;
    if (!body?.action) return json({ error: "Missing action" }, 400);

    // Only admin manages users (invite/update/delete). "reset" is also allowed
    // to direction, but scoped to their own spas — enforced inside that branch.
    if (caller.role !== "admin" && body.action !== "reset") {
      return json({ error: "Forbidden" }, 403);
    }

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
          must_change_password: true,
        },
      });
      if (createErr || !created?.user) {
        const msg = createErr?.message ?? "createUser failed";
        const isDup = /already been registered|already registered|email_exists/i.test(msg);
        return json(
          { error: isDup ? "Un utilisateur avec cet email existe déjà." : msg },
          isDup ? 409 : 400,
        );
      }

      // Use UPSERT — not plain UPDATE — so this works whether or not the
      // handle_new_user trigger has already created the public.users row.
      // UPDATE with no matching row silently affects 0 rows (no error in PostgREST).
      const upsertData: Record<string, unknown> = {
        id: created.user.id,
        email: body.email,
        full_name: body.full_name ?? "",
        role: body.role,
      };
      if (body.role === "spa_manager") {
        upsertData.spa_id = body.spa_id;
        const { data: spa } = await admin
          .from("spas")
          .select("organization_id, destination_id")
          .eq("id", body.spa_id)
          .maybeSingle();
        if (spa) {
          upsertData.organization_id = (spa as any).organization_id;
          upsertData.destination_id = (spa as any).destination_id;
        }
      } else if (body.role === "direction") {
        if (body.organization_id !== undefined) upsertData.organization_id = body.organization_id;
        if (body.destination_id !== undefined) upsertData.destination_id = body.destination_id;
      }

      const { error: updErr } = await admin.from("users").upsert(upsertData, { onConflict: "id" });
      if (updErr) return json({ error: updErr.message }, 400);

      return json({ ok: true, user_id: created.user.id, temp_password: tempPassword }, 200);
    }

    if (body.action === "update") {
      if (!body.user_id) return json({ error: "Missing user_id" }, 400);

      const update: Record<string, unknown> = {};
      if (body.full_name !== undefined) update.full_name = body.full_name;
      if (body.role !== undefined) update.role = body.role;
      if (body.spa_id !== undefined) {
        update.spa_id = body.spa_id;
        // Keep organization_id + destination_id in sync with the manager's spa.
        if (body.spa_id) {
          const { data: spa } = await admin
            .from("spas")
            .select("organization_id, destination_id")
            .eq("id", body.spa_id)
            .maybeSingle();
          if (spa) {
            update.organization_id = (spa as any).organization_id;
            update.destination_id = (spa as any).destination_id;
          }
        }
      }
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

      // Reassign NOT-NULL FK columns to the calling admin so cascades don't block.
      await admin.from("direction_spa_access").update({ granted_by: caller.userId }).eq("granted_by", body.user_id);
      await admin.from("todos").update({ created_by: caller.userId }).eq("created_by", body.user_id);
      await admin.from("objectives").update({ created_by: caller.userId }).eq("created_by", body.user_id);
      await admin.from("ids_items").update({ created_by: caller.userId }).eq("created_by", body.user_id);
      await admin.from("kpi_definitions").update({ created_by: caller.userId }).eq("created_by", body.user_id);
      await admin.from("spas").update({ created_by: caller.userId }).eq("created_by", body.user_id);
      // Nullify optional FK columns
      await admin.from("reports").update({ validated_by: null }).eq("validated_by", body.user_id);
      await admin.from("meeting_summaries").update({ validated_by: null }).eq("validated_by", body.user_id);
      await admin.from("todos").update({ assigned_to: null }).eq("assigned_to", body.user_id);
      // Reports.manager_id is NOT NULL — delete the manager's reports first
      await admin.from("reports").delete().eq("manager_id", body.user_id);

      const { error: delErr } = await (admin as any).auth.admin.deleteUser(body.user_id);
      if (delErr) return json({ error: delErr.message }, 400);
      return json({ ok: true }, 200);
    }

    if (body.action === "reset") {
      if (!body.user_id) return json({ error: "Missing user_id" }, 400);

      // Load the target user to authorize + preserve existing metadata.
      const { data: target, error: tErr } = await admin
        .from("users")
        .select("id, role, spa_id")
        .eq("id", body.user_id)
        .maybeSingle();
      if (tErr) return json({ error: tErr.message }, 400);
      if (!target) return json({ error: "Utilisateur introuvable." }, 404);

      // Authorization: admin can reset anyone; direction only managers of the
      // spas it is granted access to (direction_spa_access). No self-elevation.
      if (caller.role === "direction") {
        if (target.role !== "spa_manager" || !target.spa_id) {
          return json({ error: "Forbidden" }, 403);
        }
        const { data: access, error: aErr } = await admin
          .from("direction_spa_access")
          .select("spa_id")
          .eq("user_id", caller.userId)
          .eq("spa_id", target.spa_id)
          .maybeSingle();
        if (aErr) return json({ error: aErr.message }, 400);
        if (!access) return json({ error: "Forbidden" }, 403);
      } else if (caller.role !== "admin") {
        return json({ error: "Forbidden" }, 403);
      }

      // Preserve existing user_metadata (full_name, language…), flip the flag.
      const { data: got } = await (admin as any).auth.admin.getUserById(body.user_id);
      const existingMeta = (got?.user?.user_metadata ?? {}) as Record<string, unknown>;

      const tempPassword = `Tmp-${crypto.randomUUID().slice(0, 12)}!A1`;
      const { error: updErr } = await (admin as any).auth.admin.updateUserById(body.user_id, {
        password: tempPassword,
        user_metadata: { ...existingMeta, must_change_password: true },
      });
      if (updErr) return json({ error: updErr.message }, 400);

      return json({ ok: true, user_id: body.user_id, temp_password: tempPassword }, 200);
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return internalError(e);
  }
});
