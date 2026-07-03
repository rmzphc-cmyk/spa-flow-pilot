import { authenticate, corsHeaders, internalError, json } from "../_shared/auth.ts";

// Conversion / triage des IDS + création d'objectifs via service_role.
//
// POURQUOI une Edge Function : la policy RLS `ids_update_manager` interdit au
// spa_manager tout UPDATE d'un ids_item dont le rapport parent est verrouillé
// (is_locked=true). Or le tri et la conversion des IDS se font typiquement
// pendant la réunion mensuelle, sur des weeklies DÉJÀ finalisés → l'UPDATE
// échouait silencieusement (HTTP 200 / 0 ligne) côté client. Ici on passe par
// service_role (bypass RLS) AVEC un contrôle d'autorisation explicite, sans la
// garde de verrou : le verrou continue de protéger les éditions directes.
//
// Refonte objectifs (Phase 1) : chemin de création UNIFIÉ des objectifs.
// - `convert_to_objective` étendu (kind numeric|steps + champs chiffrés/étapes).
// - `create_objective` : création directe sans IDS source (décision A).
// La limite de 3 objectifs actifs est appliquée par le trigger serveur
// `trg_objective_active_limit` (décision C) → on catche son erreur, on ne
// pré-compte pas (race condition).

type Action = "set_triage" | "convert_to_todo" | "convert_to_objective" | "create_objective";

type ObjectiveKind = "numeric" | "steps";

const TRIAGE_MODES = ["bloquant", "priorite", "deleguer", "veille"];

interface Payload {
  action: Action;
  ids_item_id?: string;
  triage_mode?: string | null;
  due_date?: string | null;
  target_date?: string | null;
  responsible?: string;
  // Refonte objectifs (Phase 1)
  // create_objective : requis. convert_to_objective : optionnel — s'il est non
  // vide, il remplace capture_text comme titre de l'objectif.
  title?: string;
  spa_id?: string; // admin uniquement (create_objective) — ignoré sinon
  kind?: ObjectiveKind;
  metric?: string;
  unit?: string;
  start_value?: number;
  target_value?: number;
  steps?: string[];
}

// Client service_role tel que renvoyé par authenticate() — évite de réimporter
// supabase-js ici.
type AdminClient = Extract<Awaited<ReturnType<typeof authenticate>>, { ok: true }>["admin"];

function numOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function strOrNull(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

// Valide les champs objectif du payload et construit :
// - les colonnes réelles (kind, metric, unit, start_value, target_value, current_value),
// - le blob legacy `description` (DUAL-WRITE obligatoire — forme exacte lue par
//   parseObjectiveDescription dans src/hooks/useObjectives.ts ; la clé `start`
//   porte la baseline pour la progression relative côté frontend),
// - la liste d'étapes à insérer (type projet).
// `legacyAllowed` : rétrocompat convert_to_objective — un ancien payload sans
// `kind` ni `target_value` reste accepté (numeric, colonnes null, target 0 en legacy).
function buildObjectiveFields(
  body: Payload,
  opts: { legacyAllowed: boolean },
):
  | {
    ok: true;
    columns: Record<string, unknown>;
    description: string;
    steps: string[];
  }
  | { ok: false; response: Response } {
  const kind: ObjectiveKind = body.kind ?? "numeric";
  if (kind !== "numeric" && kind !== "steps") {
    return { ok: false, response: json({ error: `Invalid kind: ${body.kind}` }, 400) };
  }

  if (kind === "steps") {
    const steps = (Array.isArray(body.steps) ? body.steps : [])
      .filter((s) => typeof s === "string" && s.trim().length > 0)
      .map((s) => s.trim());
    if (steps.length === 0) {
      return { ok: false, response: json({ error: "STEPS_REQUIRED" }, 400) };
    }
    return {
      ok: true,
      steps,
      columns: {
        kind,
        metric: null,
        unit: null,
        start_value: null,
        target_value: null,
        current_value: null,
      },
      // Lecteurs legacy : affichent « 0/N » (current/target). `start` =
      // baseline pour la progression relative côté frontend.
      description: JSON.stringify({
        metric: "",
        target: steps.length,
        unit: "",
        current: 0,
        start: 0,
        status_ui: "on_track",
        comment: "",
      }),
    };
  }

  // kind === "numeric"
  const target = numOrNull(body.target_value);
  const start = numOrNull(body.start_value);
  // Ancien client : ni kind ni target_value → pas d'exigence de cible.
  const isLegacyPayload = opts.legacyAllowed && body.kind === undefined &&
    body.target_value === undefined;
  if (target === null && !isLegacyPayload) {
    return { ok: false, response: json({ error: "TARGET_REQUIRED" }, 400) };
  }
  // Objectif dégénéré (nouveau style) : cible ET baseline fournies mais égales
  // → aucune progression mesurable. target=0 seul (sans start_value) reste
  // permis ; les payloads legacy (target null) ne passent jamais ici.
  if (target !== null && start !== null && target === start) {
    return { ok: false, response: json({ error: "TARGET_EQUALS_START" }, 400) };
  }
  return {
    ok: true,
    steps: [],
    columns: {
      kind,
      metric: strOrNull(body.metric),
      unit: strOrNull(body.unit),
      start_value: start,
      target_value: target,
      current_value: start, // au départ, le courant = la baseline
    },
    description: JSON.stringify({
      metric: strOrNull(body.metric) ?? "",
      target: target ?? 0,
      unit: strOrNull(body.unit) ?? "",
      current: start ?? 0, // vraie valeur courante à la création
      start: start ?? 0, // baseline pour la progression relative côté frontend
      status_ui: "on_track",
      comment: "",
    }),
  };
}

// Insère l'objectif puis ses étapes éventuelles.
// - Limite de 3 actifs : le trigger `trg_objective_active_limit` fait autorité
//   → son erreur est mappée en HTTP 409 { error: "OBJECTIVE_LIMIT_REACHED" }.
// - Pas de transaction via PostgREST : si l'insert des étapes échoue, on
//   supprime l'objectif (compensation) pour éviter un « projet » sans étapes.
async function insertObjectiveWithSteps(
  admin: AdminClient,
  row: Record<string, unknown>,
  steps: string[],
  spaId: string,
): Promise<{ ok: true; objectiveId: string } | { ok: false; response: Response }> {
  const { data: obj, error: e1 } = await admin
    .from("objectives")
    .insert(row)
    .select()
    .single();
  if (e1) {
    const pgError = e1 as unknown as { message: string; details?: string; hint?: string };
    const details = [pgError.message, pgError.details, pgError.hint]
      .filter(Boolean)
      .join(" ");
    if (details.includes("OBJECTIVE_LIMIT_REACHED")) {
      return { ok: false, response: json({ error: "OBJECTIVE_LIMIT_REACHED" }, 409) };
    }
    return { ok: false, response: json({ error: e1.message }, 400) };
  }
  const objectiveId = (obj as unknown as { id: string }).id;

  if (steps.length > 0) {
    const { error: e2 } = await admin.from("objective_steps").insert(
      steps.map((label, index) => ({
        objective_id: objectiveId,
        spa_id: spaId,
        label,
        display_order: index,
      })),
    );
    if (e2) {
      // Compensation vérifiée : un échec du delete laisserait un « projet »
      // sans étapes → on le logge au lieu de l'ignorer en silence.
      const { error: delErr } = await admin.from("objectives").delete().eq("id", objectiveId);
      if (delErr) {
        console.error(
          `[ids-convert] compensation failed: objective ${objectiveId} (spa ${spaId}) left without steps, delete error:`,
          delErr,
        );
      }
      return { ok: false, response: json({ error: e2.message }, 400) };
    }
  }

  return { ok: true, objectiveId };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = await authenticate(req);
    if (!auth.ok) return auth.response;
    const { caller, admin } = auth;

    const body = (await req.json()) as Payload;
    if (!body?.action) return json({ error: "Missing action" }, 400);

    // ── Création directe d'un objectif (décision A) — pas d'IDS source ──────
    if (body.action === "create_objective") {
      const title = strOrNull(body.title);
      if (!title) return json({ error: "Missing title" }, 400);

      // spa_id : dérivé CÔTÉ SERVEUR de caller.spaId (app_metadata via
      // authenticate) — MÊME source de vérité que l'autorisation des actions
      // IDS plus bas ; le spa_id client est ignoré. Requis dans le body pour
      // l'admin.
      let spaId: string | null = null;
      if (caller.role === "spa_manager") {
        spaId = caller.spaId;
        if (!spaId) {
          return json(
            { error: "Aucun spa associé à cet utilisateur (app_metadata.spa_id manquant)." },
            400,
          );
        }
      } else if (caller.role === "admin") {
        spaId = strOrNull(body.spa_id);
        if (!spaId) return json({ error: "Missing spa_id" }, 400);
      } else {
        return json({ error: "Forbidden" }, 403);
      }

      const fields = buildObjectiveFields(body, { legacyAllowed: false });
      if (!fields.ok) return fields.response;

      const inserted = await insertObjectiveWithSteps(
        admin,
        {
          spa_id: spaId,
          report_id_created: null,
          created_by: caller.userId,
          title,
          status: "active",
          source: "manual",
          target_date: body.target_date ?? null,
          description: fields.description,
          ...fields.columns,
        },
        fields.steps,
        spaId,
      );
      if (!inserted.ok) return inserted.response;

      return json({ ok: true, objective_id: inserted.objectiveId }, 200);
    }

    // ── Actions IDS existantes ──────────────────────────────────────────────
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
      if (e2) {
        // Compensation (symétrique de convert_to_objective) : sans lien posé
        // sur l'IDS, un retry recréerait un doublon (la garde
        // anti-double-conversion ne verrait rien) → on supprime le todo
        // orphelin, et on logge si le delete échoue à son tour.
        const todoId = (todo as unknown as { id: string }).id;
        const idsItemId = (item as unknown as { id: string }).id;
        const { error: delErr } = await admin.from("todos").delete().eq("id", todoId);
        if (delErr) {
          console.error(
            `[ids-convert] compensation failed: todo ${todoId} (ids_item ${idsItemId}) left orphaned, delete error:`,
            delErr,
          );
        }
        return json({ error: e2.message }, 400);
      }

      return json({ ok: true, todo_id: (todo as any).id }, 200);
    }

    if (body.action === "convert_to_objective") {
      // Garde anti-double-conversion : si déjà lié, renvoie l'existant.
      if ((item as any).converted_to_objective_id) {
        return json(
          { ok: true, objective_id: (item as any).converted_to_objective_id, already: true },
          200,
        );
      }

      // Rétrocompat : ancien payload sans kind/champs → numeric, colonnes null,
      // dual-write legacy avec target 0.
      const fields = buildObjectiveFields(body, { legacyAllowed: true });
      if (!fields.ok) return fields.response;

      const inserted = await insertObjectiveWithSteps(
        admin,
        {
          spa_id: (item as any).spa_id,
          report_id_created: (item as any).report_id,
          ids_item_id: (item as unknown as { id: string }).id, // provenance de la conversion
          created_by: caller.userId,
          // Titre éditable à la conversion : optionnel, fallback = texte capturé.
          title: strOrNull(body.title) ?? (item as any).capture_text,
          status: "active",
          source: "ids_conversion",
          target_date: body.target_date ?? null,
          description: fields.description,
          ...fields.columns,
        },
        fields.steps,
        (item as unknown as { spa_id: string }).spa_id,
      );
      if (!inserted.ok) return inserted.response;

      const { error: e2 } = await admin
        .from("ids_items")
        .update({
          converted_to_objective_id: inserted.objectiveId,
          status: "converted",
          updated_at: new Date().toISOString(),
        })
        .eq("id", (item as any).id);
      if (e2) {
        // Compensation : sans lien posé sur l'IDS, un retry recréerait un
        // doublon (la garde anti-double-conversion ci-dessus ne verrait rien)
        // → on supprime l'objectif orphelin (les étapes suivent via ON DELETE
        // CASCADE), et on logge si le delete échoue à son tour.
        const { error: delErr } = await admin
          .from("objectives")
          .delete()
          .eq("id", inserted.objectiveId);
        if (delErr) {
          console.error(
            `[ids-convert] compensation failed: objective ${inserted.objectiveId} (ids_item ${
              (item as unknown as { id: string }).id
            }) left orphaned, delete error:`,
            delErr,
          );
        }
        return json({ error: e2.message }, 400);
      }

      return json({ ok: true, objective_id: inserted.objectiveId }, 200);
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return internalError(e);
  }
});
