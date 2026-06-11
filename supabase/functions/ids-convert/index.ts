import { authenticate, corsHeaders, internalError, json } from "../_shared/auth.ts";

// Conversion / triage des IDS via service_role.
//
// POURQUOI une Edge Function : la policy RLS `ids_update_manager` interdit au
// spa_manager tout UPDATE d'un ids_item dont le rapport parent est verrouillé
// (is_locked=true). Or le tri et la conversion des IDS se font typiquement
// pendant la réunion mensuelle, sur des weeklies DÉJÀ finalisés → l'UPDATE
// échouait silencieusement (HTTP 200 / 0 ligne) côté client. Ici on passe par
// service_role (bypass RLS) AVEC un contrôle d'autorisation explicite, sans la
// garde de verrou : le verrou continue de protéger les éditions directes.

type Action = "set_triage" | "convert_to_todo" | "convert_to_objective";

const TRIAGE_MODES = ["bloquant", "priorite", "deleguer", "veille"];

interface Payload {
  action: Action;
  ids_item_id?: string;
  triage_mode?: string | null;
  due_date?: string | null;
  target_date?: string | null;
  responsible?: string;
}

const EMPTY_OBJECTIVE_DESC = JSON.stringify({
  metric: "",
  target: 0,
  unit: "",
  current: 0,
  status_ui: "on_track",
  comment: "",
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = await authenticate(req);
    if (!auth.ok) return auth.response;
    const { caller, admin } = auth;

    const body = (await req.json()) as Payload;
    if (!body?.action) return json({ error: "Missing action" }, 400);
    if (!body.ids_item_id) return json({ error: "Missing ids_item_id" }, 400);

    // Charge l'IDS (service_role) — source de vérité du spa + rapport.
    const { data: item, error: itemErr } = await admin
      .from("ids_items")
      .select("id, spa_id, report_id, capture_text, converted_to_todo_id, converted_to_objective_id")
      .eq("id", body.ids_item_id)
      .maybeSingle();
    if (itemErr) return json({ error: itemErr.message }, 400);
    if (!item) return json({ error: "IDS introuvable." }, 404);

    // Autorisation : admin, ou spa_manager du spa de l'IDS. Pas de garde de
    // verrou ici — c'est tout l'intérêt de passer par l'EF.
    const isOwnerManager = caller.role === "spa_manager" && caller.spaId === (item as any).spa_id;
    if (caller.role !== "admin" && !isOwnerManager) {
      return json({ error: "Forbidden" }, 403);
    }

    if (body.action === "set_triage") {
      const mode = body.triage_mode ?? null;
      if (mode !== null && !TRIAGE_MODES.includes(mode)) {
        return json({ error: `Invalid triage_mode: ${mode}` }, 400);
      }
      const { error } = await admin
        .from("ids_items")
        .update({ triage_mode: mode, updated_at: new Date().toISOString() })
        .eq("id", (item as any).id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true }, 200);
    }

    if (body.action === "convert_to_todo") {
      // Garde anti-double-conversion : si déjà lié, renvoie l'existant.
      if ((item as any).converted_to_todo_id) {
        return json({ ok: true, todo_id: (item as any).converted_to_todo_id, already: true }, 200);
      }
      const { data: todo, error: e1 } = await admin
        .from("todos")
        .insert({
          spa_id: (item as any).spa_id,
          report_id: (item as any).report_id,
          title: (item as any).capture_text,
          description: JSON.stringify({
            responsible: (body.responsible ?? "").trim() || "—",
            followUp: "",
          }),
          status: "pending",
          priority: "medium",
          source: "ids_conversion",
          ids_item_id: (item as any).id,
          due_date: body.due_date ?? null,
          created_by: caller.userId,
        })
        .select()
        .single();
      if (e1) return json({ error: e1.message }, 400);

      const { error: e2 } = await admin
        .from("ids_items")
        .update({
          converted_to_todo_id: (todo as any).id,
          status: "converted",
          updated_at: new Date().toISOString(),
        })
        .eq("id", (item as any).id);
      if (e2) return json({ error: e2.message }, 400);

      return json({ ok: true, todo_id: (todo as any).id }, 200);
    }

    if (body.action === "convert_to_objective") {
      if ((item as any).converted_to_objective_id) {
        return json(
          { ok: true, objective_id: (item as any).converted_to_objective_id, already: true },
          200,
        );
      }
      const { data: obj, error: e1 } = await admin
        .from("objectives")
        .insert({
          spa_id: (item as any).spa_id,
          report_id_created: (item as any).report_id,
          created_by: caller.userId,
          title: (item as any).capture_text,
          status: "active",
          source: "ids_conversion",
          target_date: body.target_date ?? null,
          description: EMPTY_OBJECTIVE_DESC,
        })
        .select()
        .single();
      if (e1) return json({ error: e1.message }, 400);

      const { error: e2 } = await admin
        .from("ids_items")
        .update({
          converted_to_objective_id: (obj as any).id,
          status: "converted",
          updated_at: new Date().toISOString(),
        })
        .eq("id", (item as any).id);
      if (e2) return json({ error: e2.message }, 400);

      return json({ ok: true, objective_id: (obj as any).id }, 200);
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return internalError(e);
  }
});
