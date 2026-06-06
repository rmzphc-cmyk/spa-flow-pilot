import { authenticate, authorizeReportAccess, corsHeaders, internalError, json } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = await authenticate(req);
    if (!auth.ok) return auth.response;
    const { caller, admin } = auth;
    const userId = caller.userId;

    const { report_id } = (await req.json()) as { report_id?: string };
    if (!report_id) return json({ error: "Missing report_id" }, 400);

    const access = await authorizeReportAccess(admin, caller, report_id);
    if (!access.ok) return access.response;
    const report = access.report;

    if (report.cycle_type !== "monthly") return json({ error: "Rapport non mensuel." }, 409);
    if (report.status !== "post_meeting_generated")
      return json({ error: "Le rapport n'est pas en post-réunion." }, 409);

    // IDS — comptage informatif uniquement (non bloquant)
    const { data: idsItems, error: idsErr } = await admin
      .from("ids_items")
      .select("id, proposed_solution, root_cause, converted_to_todo_id, converted_to_objective_id, capture_text")
      .eq("report_id", report_id);
    if (idsErr) throw idsErr;
    const allIds = idsItems ?? [];
    const missingCount = allIds.filter(
      (i) => !i.proposed_solution || i.proposed_solution.trim() === "",
    ).length;

    // Synthèse — toujours requise
    const { data: summary, error: sErr } = await admin
      .from("meeting_summaries")
      .select("id, executive_summary")
      .eq("report_id", report_id)
      .maybeSingle();
    if (sErr) throw sErr;
    if (!summary || !summary.executive_summary) {
      return json({ error: "La synthèse IA n'est pas encore générée.", field: "summary" }, 422);
    }

    const now = new Date().toISOString();

    // Valider la synthèse
    const { error: us1 } = await admin
      .from("meeting_summaries")
      .update({
        is_validated: true,
        validated_by: userId,
        validated_at: now,
        updated_at: now,
      })
      .eq("report_id", report_id);
    if (us1) throw us1;

    // Valider le rapport
    const { error: us2 } = await admin
      .from("reports")
      .update({
        status: "validated",
        is_locked: true,
        validated_at: now,
        validated_by: userId,
        updated_at: now,
      })
      .eq("id", report_id);
    if (us2) throw us2;

    // Auto-créer todos depuis IDS avec solution mais non encore convertis
    const spaId = report.spa_id as string;
    for (const ids of allIds) {
      if (ids.converted_to_todo_id) continue;
      if (!ids.proposed_solution?.trim()) continue;
      await admin.from("todos").upsert({
        spa_id: spaId,
        report_id: report_id,
        title: ids.capture_text,
        description: JSON.stringify({ responsible: "", followUp: ids.proposed_solution }),
        status: "pending",
        priority: "medium",
        source: "ids_conversion",
        ids_item_id: ids.id,
        created_by: userId,
        created_at: now,
        updated_at: now,
      }, { onConflict: 'ids_item_id' }).select().maybeSingle();
    }

    // Récupérer le rapport final
    const { data: finalReport, error: fErr } = await admin
      .from("reports")
      .select("*")
      .eq("id", report_id)
      .single();
    if (fErr) throw fErr;

    // Notifier les utilisateurs Direction
    try {
      const { data: { users } } = await admin.auth.admin.listUsers();
      const directionUsers = (users ?? []).filter(
        (u) => u.app_metadata?.role === "direction",
      );
      if (directionUsers.length > 0) {
        await admin.from("notifications").insert(
          directionUsers.map((u) => ({
            user_id: u.id,
            title: "Nouveau rapport disponible",
            body: `Le rapport mensuel a été validé et est disponible.`,
            type: "synthesis_ready",
            language: u.app_metadata?.language ?? "fr",
            report_id: report_id,
            spa_id: spaId,
            is_read: false,
            created_at: now,
          })),
        );
      }
    } catch (_notifErr) {
      // Notifications non bloquantes
    }

    return json({ data: finalReport, warnings: missingCount > 0 ? `${missingCount} IDS sans solution` : null }, 200);
  } catch (e) {
    return internalError(e);
  }
});
