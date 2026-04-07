import { useState, useEffect, useMemo } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import type { SectionStatus } from "@/pages/RapportDetail";

const equipeAnchors = [
  { pos: 3, label: "Situation difficile" },
  { pos: 6, label: "Ça tourne, quelques tensions" },
  { pos: 9, label: "Équipe engagée et fluide" },
];

const managerAnchors = [
  { pos: 3, label: "Épuisé, sous pression" },
  { pos: 6, label: "Correct, quelques soucis" },
  { pos: 9, label: "En pleine forme" },
];

function getSliderColor(value: number) {
  if (value >= 7) return "text-emerald-600";
  if (value >= 5) return "text-amber-500";
  return "text-destructive";
}

function SliderField({
  label,
  sublabel,
  anchors,
  value,
  onChange,
  comment,
  onCommentChange,
  commentPlaceholder,
}: {
  label: string;
  sublabel: string;
  anchors: { pos: number; label: string }[];
  value: number;
  onChange: (v: number) => void;
  comment: string;
  onCommentChange: (v: string) => void;
  commentPlaceholder: string;
}) {
  const needsComment = value <= 5 && value > 0;
  const color = value > 0 ? getSliderColor(value) : "text-muted-foreground";

  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
      <label className="font-medium text-foreground text-sm block mb-1">{label}</label>
      <p className="text-xs text-muted-foreground mb-4">{sublabel}</p>

      <div className="flex items-center gap-4 mb-2">
        <Slider
          min={1}
          max={10}
          step={1}
          value={[value || 5]}
          onValueChange={([v]) => onChange(v)}
          className="flex-1"
        />
        <span className={`text-2xl font-bold w-10 text-center ${color}`}>
          {value || "—"}
        </span>
      </div>

      {/* Anchors */}
      <div className="flex justify-between text-xs text-muted-foreground mb-3 px-1">
        {anchors.map((a) => (
          <span key={a.pos} className="text-center max-w-[120px]">{a.label}</span>
        ))}
      </div>

      {/* Conditional comment */}
      {needsComment && (
        <div className="mt-3 transition-all">
          <label className="text-xs font-medium text-foreground mb-1 block">
            Commentaire requis <span className="text-destructive">*</span>
          </label>
          <Textarea
            className={`text-sm min-h-[60px] ${!comment.trim() ? "border-destructive" : ""}`}
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

interface Props {
  onStatusChange: (status: SectionStatus) => void;
}

export function SectionCheckin({ onStatusChange }: Props) {
  const [equipeScore, setEquipeScore] = useState(0);
  const [managerScore, setManagerScore] = useState(0);
  const [equipeComment, setEquipeComment] = useState("");
  const [managerComment, setManagerComment] = useState("");
  const [situation, setSituation] = useState("");

  const isComplete = useMemo(() => {
    if (equipeScore === 0 || managerScore === 0) return false;
    if (equipeScore <= 5 && !equipeComment.trim()) return false;
    if (managerScore <= 5 && !managerComment.trim()) return false;
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
        <SliderField
          label="Météo de l'équipe"
          sublabel="Comment va l'équipe ce cycle ?"
          anchors={equipeAnchors}
          value={equipeScore}
          onChange={setEquipeScore}
          comment={equipeComment}
          onCommentChange={setEquipeComment}
          commentPlaceholder="Qu'est-ce qui pèse sur l'équipe en ce moment ?"
        />
        <SliderField
          label="Énergie manager"
          sublabel="Comment vous sentez-vous ce cycle ?"
          anchors={managerAnchors}
          value={managerScore}
          onChange={setManagerScore}
          comment={managerComment}
          onCommentChange={setManagerComment}
          commentPlaceholder="Qu'est-ce qui impacte votre énergie ?"
        />
      </div>

      {/* Situation globale */}
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
