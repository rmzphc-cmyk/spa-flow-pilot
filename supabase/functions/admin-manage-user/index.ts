import { authenticate, corsHeaders, internalError, json } from "../_shared/auth.ts";

type Action = "invite" | "update" | "delete" | "reset";

// Seuls rôles que l'UI admin peut attribuer. "admin" est seedé en base, jamais
// invité ; tout autre valeur (faute de frappe, payload forgé) doit être rejetée
// AVANT createUser pour ne pas laisser le trigger retomber sur son défaut.
type InvitableRole = "spa_manager" | "direction";
const INVITABLE_ROLES: InvitableRole[] = ["spa_manager", "direction"];
const isInvitableRole = (v: unknown): v is InvitableRole =>
  typeof v === "string" && (INVITABLE_ROLES as string[]).includes(v);

interface Payload {
  action: Action;
  user_id?: string;
  email?: string;
  full_name?: string;
  role?: InvitableRole;
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

    // Admin manages tout. Direction gère les spa_manager de sa destination
    // (invite/update/delete/reset) — scoping vérifié plus bas.
    if (caller.role !== "admin" && caller.role !== "direction") {
      return json({ error: "Forbidden" }, 403);
    }

    // Charger la destination du caller (direction) une fois pour scoping.
    let callerDestinationId: string | null = null;
    if (caller.role === "direction") {
      const { data: me } = await admin
        .from("users")
        .select("destination_id")
        .eq("id", caller.userId)
        .maybeSingle();
      callerDestinationId = (me as any)?.destination_id ?? null;
      if (!callerDestinationId) return json({ error: "Direction sans destination assignée." }, 403);
    }

    // Helper: le spa cible appartient-il à la destination du direction ?
    const assertSpaInDirectionDestination = async (spaId: string) => {
      if (caller.role !== "direction") return null;
      const { data: spa } = await admin
        .from("spas")
        .select("destination_id")
        .eq("id", spaId)
        .maybeSingle();
      if (!spa || (spa as any).destination_id !== callerDestinationId) {
        return json({ error: "Forbidden: spa hors de votre destination." }, 403);
      }
      return null;
    };

    if (body.action === "invite") {
      if (!body.email || !body.role) return json({ error: "Missing email or role" }, 400);
      if (!isInvitableRole(body.role)) return json({ error: `Invalid role: ${body.role}` }, 400);
      if (body.role === "spa_manager" && !body.spa_id) {
        return json({ error: "spa_id required for spa_manager" }, 400);
      }
      if (body.role === "direction" && !body.destination_id && !body.organization_id) {
        return json({ error: "destination_id or organization_id required for direction" }, 400);
      }

      // Direction : peut UNIQUEMENT inviter des spa_manager de sa destination.
      if (caller.role === "direction") {
        if (body.role !== "spa_manager") {
          return json({ error: "Forbidden: direction ne peut inviter que des spa_manager." }, 403);
        }
        const denied = await assertSpaInDirectionDestination(body.spa_id!);
        if (denied) return denied;
      }


      // Pre-check: a public.users row may already exist with this email (from a
      // prior failed invite or manual insert). Its unique partial index would
      // make the handle_new_user trigger fail with an opaque 500. Detect early.
      const { data: existing } = await admin
        .from("users")
        .select("id")
        .eq("email", body.email)
        .maybeSingle();
      if (existing) {
        return json({ error: "Un utilisateur avec cet email existe déjà." }, 409);
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
        const rawMsg = createErr?.message
          ?? (createErr ? JSON.stringify(createErr) : "")
          ?? "";
        const msg = rawMsg && rawMsg !== "{}" ? rawMsg : "createUser failed (unknown error)";
        const isDup = /already been registered|already registered|email_exists|duplicate key|users_email/i.test(msg);
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

      // Charger la cible pour scoping direction (ne peut toucher que ses spa_manager).
      const { data: target } = await admin
        .from("users")
        .select("role, destination_id, spa_id")
        .eq("id", body.user_id)
        .maybeSingle();
      if (!target) return json({ error: "Utilisateur introuvable." }, 404);

      if (caller.role === "direction") {
        if ((target as any).role !== "spa_manager"
            || (target as any).destination_id !== callerDestinationId) {
          return json({ error: "Forbidden" }, 403);
        }
        // Direction ne peut pas changer le rôle ni la destination.
        if (body.role !== undefined || body.destination_id !== undefined || body.organization_id !== undefined) {
          return json({ error: "Forbidden: champs non autorisés." }, 403);
        }
        if (body.spa_id !== undefined && body.spa_id) {
          const denied = await assertSpaInDirectionDestination(body.spa_id);
          if (denied) return denied;
        }
      }

      const update: Record<string, unknown> = {};
      if (body.full_name !== undefined) update.full_name = body.full_name;
      if (body.role !== undefined) update.role = body.role;
      if (body.spa_id !== undefined) {
        update.spa_id = body.spa_id;
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
