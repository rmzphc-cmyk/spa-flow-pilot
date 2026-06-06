import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Textarea } from "@/components/ui/textarea";
import type { SectionStatus } from "@/pages/RapportDetail";
import { EmojiScore } from "./EmojiScore";
import { useCheckin, useUpsertCheckin, parseKeyContext } from "@/hooks/useCheckin";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VoiceRecordButton } from "@/components/VoiceRecordButton";
import { useStructureVoiceNote } from "@/hooks/useStructureVoiceNote";

const MAX_SITUATION = 250;

interface Props {
  reportId: string;
  onStatusChange: (status: SectionStatus) => void;
  isLocked?: boolean;
}

function Field({
  label,
  sublabel,
  value,
  onChange,
  comment,
  onCommentChange,
  commentPlaceholder,
}: {
  label: string;
  sublabel: string;
  value: number;
  onChange: (v: number) => void;
  comment: string;
  onCommentChange: (v: string) => void;
  commentPlaceholder: string;
}) {
  const needsComment = value > 0 && value <= 2;
  const missing = needsComment && !comment.trim();

  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
      <label className="font-medium text-foreground text-sm block mb-1">{label}</label>
      <p className="text-xs text-muted-foreground mb-4">{sublabel}</p>

      <EmojiScore value={value} onChange={onChange} />

      {needsComment && (
        <div className="mt-4 transition-all">
          <label className="text-xs font-medium text-foreground mb-1 block">
            Commentaire requis <span className="text-destructive">*</span>
          </label>
          <Textarea
            className={`text-sm min-h-[60px] ${missing ? "border-red-500 ring-1 ring-red-500" : ""}`}
            placeholder={commentPlaceholder}
            maxLength={150}
            value={comment}
            onChange={(e) => onCommentChange(e.target.value)}
          />
          {missing && (
            <p className="text-xs text-red-500 mt-1">Un commentaire est requis pour un score ≤ 2</p>
          )}
          <div className="text-xs text-muted-foreground text-right mt-0.5">{comment.length}/150</div>
        </div>
      )}
    </div>
  );
}

export function SectionCheckin({ reportId, onStatusChange, isLocked = false }: Props) {
  const { i18n } = useTranslation();
  const speechLang = i18n.language === "es" ? "es-ES" : i18n.language === "en" ? "en-US" : "fr-FR";
  const { data: row, isFetching } = useCheckin(reportId);
  const { debouncedUpsert } = useUpsertCheckin();
  const structureMutation = useStructureVoiceNote();

  const handleStructureSituation = () => {
    if (!situation.trim()) return;
    structureMutation.mutate(
      { text: situation, context: "check_in" },
      {
        onSuccess: (structured) => {
          if (structured) setSituation(structured.slice(0, MAX_SITUATION));
        },
      },
    );
  };

  const [equipeScore, setEquipeScore] = useState(0);
  const [managerScore, setManagerScore] = useState(0);
  const [equipeComment, setEquipeComment] = useState("");
  const [managerComment, setManagerComment] = useState("");
  const [situation, setSituation] = useState("");
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from DB once
  useEffect(() => {
    if (hydrated) return;
    if (isFetching) return;
    if (row !== null) {
      const ctx = parseKeyContext(row.key_context);
      setEquipeScore(row.mood_score ?? 0);
      setManagerScore(row.focus_level ?? 0);
      setEquipeComment(ctx.equipeComment ?? "");
      setManagerComment(ctx.managerComment ?? "");
      setSituation(ctx.situation ?? "");
    }
    setHydrated(true);
  }, [row, hydrated, isFetching]);

  // Autosave (debounced) on any change once hydrated
  useEffect(() => {
    if (!hydrated || !reportId || isLocked) return;
    if (equipeScore === 0 && managerScore === 0 && !equipeComment && !managerComment && !situation) {
      return;
    }
    debouncedUpsert({
      report_id: reportId,
      mood_score: equipeScore,
      focus_level: managerScore,
      key_context: { equipeComment, managerComment, situation },
    });
  }, [hydrated, reportId, equipeScore, managerScore, equipeComment, managerComment, situation, debouncedUpsert, isLocked]);

  const isComplete = useMemo(() => {
    if (equipeScore === 0 || managerScore === 0) return false;
    if (equipeScore <= 2 && !equipeComment.trim()) return false;
    if (managerScore <= 2 && !managerComment.trim()) return false;
    return true;
  }, [equipeScore, managerScore, equipeComment, managerComment]);

  const hasWarning = isComplete && !situation.trim();

  useEffect(() => {
    onStatusChange(isComplete ? (hasWarning ? "warning" : "complete") : "incomplete");
  }, [isComplete, hasWarning, onStatusChange]);

  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold text-foreground">Check-in humain</h2>
      <p className="text-sm text-muted-foreground mb-4">État d'équipe et énergie managériale</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <Field
          label="Météo de l'équipe"
          sublabel="Comment va l'équipe ce cycle ?"
          value={equipeScore}
          onChange={setEquipeScore}
          comment={equipeComment}
          onCommentChange={setEquipeComment}
          commentPlaceholder="Qu'est-ce qui pèse sur l'équipe en ce moment ?"
        />
        <Field
          label="Énergie manager"
          sublabel="Comment vous sentez-vous ce cycle ?"
          value={managerScore}
          onChange={setManagerScore}
          comment={managerComment}
          onCommentChange={setManagerComment}
          commentPlaceholder="Qu'est-ce qui impacte votre énergie ?"
        />
      </div>

      <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-1">
          <label className="font-medium text-foreground text-sm">Situation globale</label>
          {!situation.trim() && (
            <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Optionnel</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          En une phrase, comment se porte le spa ce cycle ?
          <span className="italic ml-1">Sera visible par la Direction</span>
        </p>
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <VoiceRecordButton
            context="check_in"
            lang={speechLang}
            onTranscript={(transcript) =>
              setSituation((prev) =>
                prev ? (prev + " " + transcript).slice(0, MAX_SITUATION) : transcript.slice(0, MAX_SITUATION),
              )
            }
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            disabled={!situation.trim() || structureMutation.isPending}
            onClick={handleStructureSituation}
          >
            {structureMutation.isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Structuration…
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                Structurer avec l'IA
              </>
            )}
          </Button>
        </div>
        <Textarea
          className="text-sm min-h-[60px]"
          placeholder="En une phrase, comment se porte le spa ce cycle ?"
          maxLength={MAX_SITUATION}
          value={situation}
          onChange={(e) => setSituation(e.target.value)}
        />
        <div className="text-xs text-muted-foreground text-right mt-0.5">{situation.length}/250</div>
      </div>
    </section>
  );
}
