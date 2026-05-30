import { useEffect, useMemo, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import type { SectionStatus } from "@/pages/RapportDetail";
import { EmojiScore } from "./EmojiScore";
import { useCheckin, useUpsertCheckin, parseKeyContext } from "@/hooks/useCheckin";
import { VoiceRecordButton } from "@/components/VoiceRecordButton";


interface Props {
  reportId: string;
  onStatusChange: (status: SectionStatus) => void;
}

export function SectionCheckinWeekly({ reportId, onStatusChange }: Props) {
  const { data: row } = useCheckin(reportId);
  const { debouncedUpsert } = useUpsertCheckin();


  const [meteoScore, setMeteoScore] = useState(0);
  const [note, setNote] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (hydrated) return;
    if (row) {
      const ctx = parseKeyContext(row.key_context);
      setMeteoScore(row.mood_score ?? 0);
      setNote(ctx.note ?? ctx.situation ?? "");
    }
    setHydrated(true);
  }, [row, hydrated]);

  useEffect(() => {
    if (!hydrated || !reportId) return;
    if (meteoScore === 0 && !note) return;
    debouncedUpsert({
      report_id: reportId,
      mood_score: meteoScore,
      focus_level: 0,
      key_context: { note },
    });
  }, [hydrated, reportId, meteoScore, note, debouncedUpsert]);

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

  const handleStructure = () => {
    if (!note.trim()) return;
    structureMutation.mutate(
      { text: note, context: "check_in" },
      {
        onSuccess: (structured) => {
          if (structured) setNote(structured.slice(0, 1000));
        },
        onError: (e: any) => {
          toast({
            title: "Structuration impossible",
            description: e?.message ?? "Erreur inconnue",
            variant: "destructive",
          });
        },
      },
    );
  };

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
          <label className="font-medium text-foreground text-sm">Contexte équipe</label>
          {needsComment ? (
            <span className="text-xs text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">Requis</span>
          ) : (
            <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Optionnel</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Météo, ambiance, retour bref sur chaque collaborateur…
        </p>

        <div className="flex flex-row gap-2 mb-2">
          <VoiceRecordButton
            onTranscript={(transcript) =>
              setNote((prev) => (prev ? (prev + " " + transcript).slice(0, 1000) : transcript.slice(0, 1000)))
            }
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            disabled={!note.trim() || structureMutation.isPending}
            onClick={handleStructure}
          >
            {structureMutation.isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Structuration…
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5 text-violet-500" />
                Structurer avec l'IA
              </>
            )}
          </Button>
        </div>

        <Textarea
          className={`text-sm min-h-[100px] ${missing ? "border-destructive" : ""}`}
          placeholder="Ex : Bonne semaine globalement. Marie très engagée sur les soins duo. Thomas en retrait — à surveiller. Julie a géré l'incident piscine avec calme. Moral général positif malgré la charge."
          maxLength={1000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="text-xs text-muted-foreground text-right mt-0.5">{note.length}/1000</div>
      </div>
    </section>
  );
}
