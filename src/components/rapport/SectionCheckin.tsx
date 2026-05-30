import { useEffect, useMemo, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import type { SectionStatus } from "@/pages/RapportDetail";
import { EmojiScore } from "./EmojiScore";
import { useCheckin, useUpsertCheckin, parseKeyContext } from "@/hooks/useCheckin";

interface Props {
  reportId: string;
  onStatusChange: (status: SectionStatus) => void;
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
            className={`text-sm min-h-[60px] ${missing ? "border-destructive" : ""}`}
            placeholder={commentPlaceholder}
            maxLength={150}
            value={comment}
            onChange={(e) => onCommentChange(e.target.value)}
          />
          <div className="text-xs text-muted-foreground text-right mt-0.5">{comment.length}/150</div>
        </div>
      )}
    </div>
  );
}

export function SectionCheckin({ reportId, onStatusChange }: Props) {
  const { data: row } = useCheckin(reportId);
  const { debouncedUpsert } = useUpsertCheckin();

  const [equipeScore, setEquipeScore] = useState(0);
  const [managerScore, setManagerScore] = useState(0);
  const [equipeComment, setEquipeComment] = useState("");
  const [managerComment, setManagerComment] = useState("");
  const [situation, setSituation] = useState("");
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from DB once
  useEffect(() => {
    if (hydrated) return;
    if (row === undefined) return;
    if (row !== null) {
      const ctx = parseKeyContext(row.key_context);
      setEquipeScore(row.mood_score ?? 0);
      setManagerScore(row.focus_level ?? 0);
      setEquipeComment(ctx.equipeComment ?? "");
      setManagerComment(ctx.managerComment ?? "");
      setSituation(ctx.situation ?? "");
    }
    setHydrated(true);
  }, [row, hydrated]);

  // Autosave (debounced) on any change once hydrated
  useEffect(() => {
    if (!hydrated || !reportId) return;
    if (equipeScore === 0 && managerScore === 0 && !equipeComment && !managerComment && !situation) {
      return;
    }
    debouncedUpsert({
      report_id: reportId,
      mood_score: equipeScore,
      focus_level: managerScore,
      key_context: { equipeComment, managerComment, situation },
    });
  }, [hydrated, reportId, equipeScore, managerScore, equipeComment, managerComment, situation, debouncedUpsert]);

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
        <Textarea
          className="text-sm min-h-[60px]"
          placeholder="En une phrase, comment se porte le spa ce cycle ?"
          maxLength={250}
          value={situation}
          onChange={(e) => setSituation(e.target.value)}
        />
        <div className="text-xs text-muted-foreground text-right mt-0.5">{situation.length}/250</div>
      </div>
    </section>
  );
}
