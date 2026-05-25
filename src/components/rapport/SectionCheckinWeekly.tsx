import { useEffect, useMemo } from "react";
import { Textarea } from "@/components/ui/textarea";
import type { SectionStatus } from "@/pages/RapportDetail";
import { usePersistedSection } from "@/lib/usePersistedSection";
import { EmojiScore } from "./EmojiScore";

interface Props {
  reportId: string;
  onStatusChange: (status: SectionStatus) => void;
}

export function SectionCheckinWeekly({ reportId, onStatusChange }: Props) {
  const [state, setState] = usePersistedSection<{ meteoScore: number; note: string }>(
    reportId,
    "checkin",
    { meteoScore: 0, note: "" },
  );
  const { meteoScore, note } = state;
  const setMeteoScore = (v: number) => setState((p) => ({ ...p, meteoScore: v }));
  const setNote = (v: string) => setState((p) => ({ ...p, note: v }));

  const needsComment = meteoScore > 0 && meteoScore <= 2;
  const missing = needsComment && !note.trim();

  const isComplete = useMemo(() => {
    if (meteoScore === 0) return false;
    if (needsComment && !note.trim()) return false;
    return true;
  }, [meteoScore, needsComment, note]);

  useEffect(() => {
    onStatusChange(isComplete ? "complete" : "incomplete");
  }, [isComplete, onStatusChange]);

  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold text-foreground">Check-in rapide</h2>
      <p className="text-sm text-muted-foreground mb-4">30 secondes · Votre état et celui de l'équipe</p>

      <div className="bg-card border border-border rounded-xl p-5 shadow-sm mb-4">
        <label className="font-medium text-foreground text-sm block mb-1">Météo de l'équipe cette semaine</label>
        <p className="text-xs text-muted-foreground mb-4">Comment va l'équipe cette semaine ?</p>
        <EmojiScore value={meteoScore} onChange={setMeteoScore} />
      </div>

      <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-1">
          <label className="font-medium text-foreground text-sm">Un mot sur cette semaine</label>
          {needsComment ? (
            <span className="text-xs text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">Requis</span>
          ) : (
            <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Optionnel</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mb-3">Une chose notable de cette semaine</p>
        <Textarea
          className={`text-sm min-h-[60px] ${missing ? "border-destructive" : ""}`}
          placeholder="Une chose notable de cette semaine..."
          maxLength={200}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="text-xs text-muted-foreground text-right mt-0.5">{note.length}/200</div>
      </div>
    </section>
  );
}
