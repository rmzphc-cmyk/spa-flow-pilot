import { authenticate, corsHeaders, internalError, json } from "../_shared/auth.ts";

interface Input {
  spa_id: string;
  cycle_type: "weekly" | "monthly";
  cycle_label: string;
  period_start: string;
  period_end: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = await authenticate(req);
    if (!auth.ok) return auth.response;
    const { caller, admin } = auth;
    const userId = caller.userId;

    const body = (await req.json()) as Input;
    if (!body.spa_id || !body.cycle_type || !body.cycle_label || !body.period_start || !body.period_end) {
      return json({ error: "Missing required fields" }, 400);
    }

    // Authorize: admin OR spa_manager creating for their own spa
    if (caller.role !== "admin") {
      if (caller.role !== "spa_manager" || body.spa_id !== caller.spaId) {
        return json({ error: "Forbidden" }, 403);
      }
    }

    const { data: existing, error: existingErr } = await admin
      .from("reports")
      .select("id")
      .eq("spa_id", body.spa_id)
      .eq("cycle_type", body.cycle_type)
      .neq("status", "validated")
      .maybeSingle();
    if (existingErr) throw existingErr;
    if (existing) {
      return json({ error: "Un rapport actif existe déjà pour ce cycle." }, 409);
    }

    // Vérifier qu'aucun rapport n'existe pour cette période exacte (quel que soit le statut)
    const { data: existingByPeriod, error: periodErr } = await admin
      .from("reports")
      .select("id, cycle_label, status")
      .eq("spa_id", body.spa_id)
      .eq("cycle_type", body.cycle_type)
      .eq("period_start", body.period_start)
      .maybeSingle();
    if (periodErr) throw periodErr;
    if (existingByPeriod) {
      return json({
        error: `Un rapport existe déjà pour cette période : "${existingByPeriod.cycle_label}" (statut : ${existingByPeriod.status}).`,
      }, 409);
    }

    const { data: newReport, error: insertErr } = await admin
      .from("reports")
      .insert({
        spa_id: body.spa_id,
        manager_id: userId,
        cycle_type: body.cycle_type,
        cycle_label: body.cycle_label,
        period_start: body.period_start,
        period_end: body.period_end,
        status: "draft_preparation",
      })
      .select("*")
      .single();
    if (insertErr) throw insertErr;
    const newReportId = newReport.id as string;

    const { data: prevReport } = await admin
      .from("reports")
      .select("id")
      .eq("spa_id", body.spa_id)
      .eq("cycle_type", body.cycle_type)
      .eq("status", "validated")
      .order("period_end", { ascending: false })
      .limit(1)
      .maybeSingle();
    const prevReportId = prevReport?.id as string | undefined;

    const { data: kpiDefs } = await admin
      .from("kpi_definitions")
      .select("id")
      .eq("spa_id", body.spa_id)
      .eq("is_active", true);

    if (kpiDefs && kpiDefs.length > 0) {
      let prevEntries: { kpi_definition_id: string; value_current: number | null }[] = [];
      if (prevReportId) {
        const { data: pe } = await admin
          .from("kpi_entries")
          .select("kpi_definition_id, value_current")
          .eq("report_id", prevReportId);
        prevEntries = pe ?? [];
      }
      const prevMap = new Map(prevEntries.map((e) => [e.kpi_definition_id, e.value_current]));
      const yearMonth = body.period_start.slice(0, 7);

      const { data: monthlyTargets } = await admin
        .from("kpi_monthly_targets")
        .select("kpi_definition_id, monthly_value, weekly_mode, weekly_override")
        .eq("spa_id", body.spa_id)
        .eq("year_month", yearMonth);

      const targetMap = new Map(
        (monthlyTargets ?? []).map((t) => [t.kpi_definition_id, t])
      );

      const rows = kpiDefs.map((d) => {
        const t = targetMap.get(d.id);
        let target_value: number | null = null;
        if (t && t.monthly_value !== null) {
          if (body.cycle_type === "monthly") {
            target_value = t.monthly_value;
          } else {
            if (t.weekly_override !== null) {
              target_value = t.weekly_override;
            } else if (t.weekly_mode === "divide") {
              target_value = t.monthly_value / 4;
            } else {
              target_value = t.monthly_value;
            }
          }
        }
        return {
          report_id: newReportId,
          kpi_definition_id: d.id,
          value_n1: prevMap.get(d.id) ?? null,
          status: "not_applicable",
          target_value,
        };
      });
      const { error: kpiErr } = await admin.from("kpi_entries").insert(rows);
      if (kpiErr && kpiErr.code !== "23505") throw kpiErr;
    }

    const { data: respTpls } = await admin
      .from("responsibility_templates")
      .select("id")
      .eq("spa_id", body.spa_id)
      .eq("is_active", true);

    if (respTpls && respTpls.length > 0) {
      const rows = respTpls.map((t) => ({
        report_id: newReportId,
        responsibility_template_id: t.id,
        completion_rate: 0,
      }));
      const { error: respErr } = await admin.from("responsibility_logs").insert(rows);
      if (respErr && respErr.code !== "23505") throw respErr;
    }

    if (prevReportId) {
      await admin
        .from("todos")
        .update({ report_id: newReportId })
        .eq("report_id", prevReportId)
        .in("status", ["pending", "in_progress"]);
    }

    const { data: finalReport, error: finalErr } = await admin
      .from("reports")
      .select("*")
      .eq("id", newReportId)
      .single();
    if (finalErr) throw finalErr;

    return json({ data: finalReport }, 200);
  } catch (e) {
    return internalError(e);
  }
});
