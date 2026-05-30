import { useEffect, useState } from "react";
import { PenLine } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useCheckin, useUpsertCheckin, parseKeyContext } from "@/hooks/useCheckin";
import { VoiceRecordButton } from "@/components/VoiceRecordButton";
import type { SectionStatus } from "@/pages/RapportDetail";


interface Props {
  reportId: string;
  onStatusChange: (status: SectionStatus) => void;
}

export function SectionNotes({ reportId, onStatusChange }: Props) {
  const { data: row } = useCheckin(reportId);
  const { debouncedUpsert } = useUpsertCheckin();
  

  const [note, setNote] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (hydrated) return;
    if (row) setNote(parseKeyContext(row.key_context).free_note ?? "");
    setHydrated(true);
  }, [row, hydrated]);

  useEffect(() => {
    onStatusChange("complete");
  }, [onStatusChange]);

  useEffect(() => {
    if (!hydrated || !reportId) return;
    debouncedUpsert({
      report_id: reportId,
      mood_score: row?.mood_score ?? 0,
      focus_level: row?.focus_level ?? 0,
      key_context: {
        ...parseKeyContext(row?.key_context ?? null),
        free_note: note,
      },
    });
  }, [note, hydrated, reportId, row, debouncedUpsert]);

  const handleStructure = () => {
    if (!note.trim()) return;
    structureMutation.mutate(
      { text: note, context: "free_note" },
      {
        onSuccess: (s) => {
          if (s) setNote(s.slice(0, 3000));
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
      <div className="flex items-center gap-2">
        <PenLine className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold text-foreground">Notes libres</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">Informations complémentaires pour la Direction</p>

      <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <label className="font-medium text-foreground text-sm">Vos notes</label>
          <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Optionnel</span>
        </div>

        <div className="flex flex-row gap-2 mb-2">
          <VoiceRecordButton
            onTranscript={(t) =>
              setNote((prev) => (prev ? (prev + " " + t).slice(0, 3000) : t.slice(0, 3000)))
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
          className="text-sm min-h-[140px]"
          placeholder="Ex : Retour sur la visite du directeur hôtel. Point sur la commande produits… Tout ce qui ne rentre pas ailleurs."
          maxLength={3000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="text-xs text-muted-foreground text-right mt-0.5">{note.length}/3000</div>

        <p className="text-xs text-muted-foreground mt-3 bg-muted/40 rounded-lg px-3 py-2">
          ℹ️ Ce bloc est transmis tel quel à la Direction. L'IA peut reformuler vos notes dictées.
        </p>
      </div>
    </section>
  );
}
