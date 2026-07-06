import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { normalizeEfError, type ObjectiveKind } from "@/hooks/useObjectives";
import type { Json } from "@/integrations/supabase/types";

// ============================================================================
// Arbitrage des propositions du coach mensuel (meeting_summaries.ai_output).
// Le manager accepte / ajuste / ignore chaque proposition ; l'acceptation la
// matérialise en vrai ids_item / todo / objective via l'EF ids-convert
// (service_role — contourne le verrou is_locked), puis trace la décision dans
// ai_output.proposals[i].arbitration. Aucune écriture tant que rien n'est accepté.
// ============================================================================

export type AiVerdict = "on_track" | "attention" | "at_risk";
export type AiSeverity = "info" | "watch" | "alert";
export type AiConfidence = "high" | "medium" | "low";
export type AiProposalType = "ids" | "todo" | "objective";
export type AiTriage = "bloquant" | "priorite" | "deleguer" | "veille";

export interface AiHighlight {
  label: string;
  detail: string;
  severity: AiSeverity;
  source: string;
}

export interface AiDecision {
  statement: string;
  owner: string | null;
  due: string | null;
  source: string;
  confidence: AiConfidence;
}

/** Trace posée sur une proposition une fois arbitrée par le manager. */
export interface AiArbitration {
  status: "accepted" | "dismissed";
  created_type?: AiProposalType;
  created_id?: string;
  at: string;
}

export interface AiProposal {
  type: AiProposalType;
  title: string;
  problem: string | null;
  suggested_triage: AiTriage | null;
  owner: string | null;
  due: string | null;
  justification: string;
  source: string;
  confidence: AiConfidence;
  arbitration?: AiArbitration | null;
}

export interface AiOutput {
  meeting_language: string;
  audio_used: boolean;
  verdict: AiVerdict;
  executive_summary: string;
  highlights: AiHighlight[];
  decisions: AiDecision[];
  proposals: AiProposal[];
  blind_spots: string[];
}

const VERDICTS: AiVerdict[] = ["on_track", "attention", "at_risk"];

/** Parse léger — l'EF normalise déjà défensivement à la génération. */
export function parseAiOutput(raw: unknown): AiOutput | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  return {
    meeting_language: typeof o.meeting_language === "string" ? o.meeting_language : "fr",
    audio_used: o.audio_used === true,
    verdict: VERDICTS.includes(o.verdict as AiVerdict) ? (o.verdict as AiVerdict) : "attention",
    executive_summary: typeof o.executive_summary === "string" ? o.executive_summary : "",
    highlights: Array.isArray(o.highlights) ? (o.highlights as AiHighlight[]) : [],
    decisions: Array.isArray(o.decisions) ? (o.decisions as AiDecision[]) : [],
    proposals: Array.isArray(o.proposals) ? (o.proposals as AiProposal[]) : [],
    blind_spots: Array.isArray(o.blind_spots)
      ? (o.blind_spots as unknown[]).filter((s): s is string => typeof s === "string")
      : [],
  };
}

/** Champs spécifiques exigés par create_objective (kind + cible ou étapes). */
export interface ObjectiveFields {
  kind: ObjectiveKind;
  metric?: string;
  unit?: string;
  startValue?: number;
  targetValue?: number;
  steps?: string[];
  targetDate?: string | null;
}

export interface ArbitrateInput {
  index: number;
  decision: "accept" | "dismiss" | "restore";
  /** Valeurs finales de la proposition (éventuellement ajustées par le manager). */
  proposal: AiProposal;
  /** Requis pour accepter une proposition de type objective. */
  objective?: ObjectiveFields;
}

export function useArbitrateProposal(reportId: string | undefined, aiOutput: AiOutput | null) {
  const qc = useQueryClient();
  const { spaId } = useAuth();

  return useMutation({
    mutationFn: async (input: ArbitrateInput) => {
      if (!reportId || !aiOutput) throw new Error("Rapport indisponible");
      let arbitration: AiArbitration | null = null;

      if (input.decision === "accept") {
        const p = input.proposal;
        let createdId: string | undefined;

        if (p.type === "ids") {
          const { data, error } = await supabase.functions.invoke("ids-convert", {
            body: {
              action: "create_ids",
              report_id: reportId,
              title: p.title,
              problem: p.problem,
              triage_mode: p.suggested_triage,
            },
          });
          if (error) throw await normalizeEfError(error);
          if (data?.error) throw new Error(data.error);
          createdId = data?.ids_item_id;
        } else if (p.type === "todo") {
          const { data, error } = await supabase.functions.invoke("ids-convert", {
            body: {
              action: "create_todo",
              report_id: reportId,
              title: p.title,
              problem: p.problem,
              responsible: p.owner ?? "",
              due_date: p.due,
            },
          });
          if (error) throw await normalizeEfError(error);
          if (data?.error) throw new Error(data.error);
          createdId = data?.todo_id;
        } else {
          const o = input.objective;
          if (!o) throw new Error("OBJECTIVE_FIELDS_REQUIRED");
          const { data, error } = await supabase.functions.invoke("ids-convert", {
            body: {
              action: "create_objective",
              title: p.title,
              target_date: o.targetDate ?? p.due ?? null,
              kind: o.kind,
              metric: o.metric,
              unit: o.unit,
              start_value: o.startValue,
              target_value: o.targetValue,
              steps: o.steps,
            },
          });
          if (error) throw await normalizeEfError(error);
          if (data?.error) throw new Error(data.error);
          createdId = data?.objective_id;
        }

        arbitration = {
          status: "accepted",
          created_type: p.type,
          created_id: createdId,
          at: new Date().toISOString(),
        };
      } else if (input.decision === "dismiss") {
        arbitration = { status: "dismissed", at: new Date().toISOString() };
      }
      // "restore" → arbitration = null (la proposition redevient arbitrable)

      // Trace : valeurs finales + arbitrage, réécrites dans le JSONB.
      const proposals = aiOutput.proposals.map((orig, i) =>
        i === input.index ? { ...input.proposal, arbitration } : orig,
      );
      const patched = { ...aiOutput, proposals };
      const { error: upErr } = await supabase
        .from("meeting_summaries")
        .update({
          ai_output: patched as unknown as Json,
          updated_at: new Date().toISOString(),
        })
        .eq("report_id", reportId);
      if (upErr) throw upErr;

      return input;
    },
    onSuccess: (input) => {
      qc.invalidateQueries({ queryKey: ["meeting_summary", reportId] });
      if (input.decision === "accept") {
        if (input.proposal.type === "ids") {
          qc.invalidateQueries({ queryKey: ["ids_items", reportId] });
          qc.invalidateQueries({ queryKey: ["ids_items_monthly_preview"] });
        }
        if (input.proposal.type === "todo") qc.invalidateQueries({ queryKey: ["todos"] });
        if (input.proposal.type === "objective") qc.invalidateQueries({ queryKey: ["objectives", spaId] });
      }
    },
  });
}
