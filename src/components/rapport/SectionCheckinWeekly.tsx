import { useState, useEffect, useMemo } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import type { SectionStatus } from "@/pages/RapportDetail";

const meteoAnchors = [
  { pos: 3, label: "Difficile" },
  { pos: 6, label: "Correcte" },
  { pos: 9, label: "Fluide" },
];

function getSliderColor(value: number) {
  if (value >= 7) return "text-emerald-600";
  if (value >= 5) return "text-amber-500";
  return "text-destructive";
}

interface Props {
  onStatusChange: (status: SectionStatus) => void;
}

export function SectionCheckinWeekly({ onStatusChange }: Props) {
  const [meteoScore, setMeteoScore] = useState(0);
  const [note, setNote] = useState("");

  const isComplete = useMemo(() => {
    return meteoScore > 0;
  }, [meteoScore]);

  useEffect(() => {
    onStatusChange(isComplete ? "complete" : "incomplete");
  }, [isComplete, onStatusChange]);

  const color = meteoScore > 0 ? getSliderColor(meteoScore) : "text-muted-foreground";

  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold text-foreground">Check-in rapide</h2>
      <p className="text-sm text-muted-foreground mb-4">30 secondes · Votre état et celui de l'équipe</p>

      {/* Météo de l'équipe */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-sm mb-4">
        <label className="font-medium text-foreground text-sm block mb-1">Météo de l'équipe cette semaine</label>
        <p className="text-xs text-muted-foreground mb-4">Comment va l'équipe cette semaine ?</p>

        <div className="flex items-center gap-4 mb-2">
          <Slider
            min={1}
            max={10}
            step={1}
            value={[meteoScore || 5]}
            onValueChange={([v]) => setMeteoScore(v)}
            className="flex-1"
          />
          <span className={`text-2xl font-bold w-10 text-center ${color}`}>
            {meteoScore || "—"}
          </span>
        </div>

        <div className="flex justify-between text-xs text-muted-foreground px-1">
          {meteoAnchors.map((a) => (
            <span key={a.pos} className="text-center">{a.label}</span>
          ))}
        </div>
      </div>

      {/* Un mot sur cette semaine */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-1">
          <label className="font-medium text-foreground text-sm">Un mot sur cette semaine</label>
          <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Optionnel</span>
        </div>
        <p className="text-xs text-muted-foreground mb-3">Une chose notable de cette semaine</p>
        <Textarea
          className="text-sm min-h-[60px]"
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
