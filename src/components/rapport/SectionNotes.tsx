import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { PenLine, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCheckin, useUpsertCheckin, parseKeyContext } from "@/hooks/useCheckin";
import { VoiceRecordButton } from "@/components/VoiceRecordButton";
import { useStructureVoiceNote } from "@/hooks/useStructureVoiceNote";
import type { SectionStatus } from "@/pages/RapportDetail";


interface Props {
  reportId: string;
  onStatusChange: (status: SectionStatus) => void;
  isLocked?: boolean;
}

export function SectionNotes({ reportId, onStatusChange, isLocked = false }: Props) {
  const { t, i18n } = useTranslation();
  const speechLang = i18n.language === "es" ? "es-ES" : i18n.language === "en" ? "en-US" : "fr-FR";
  const { data: row, isFetching } = useCheckin(reportId);
  const { debouncedUpsert } = useUpsertCheckin();
  const structureMutation = useStructureVoiceNote();

  const MAX_LENGTH = 3000;

  const [note, setNote] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (hydrated) return;
    if (isFetching) return;
    if (row !== null) setNote(parseKeyContext(row.key_context).free_note ?? "");
    setHydrated(true);
  }, [row, hydrated, isFetching]);

  useEffect(() => {
    onStatusChange("complete");
  }, [onStatusChange]);

  useEffect(() => {
    if (!hydrated || !reportId || isLocked) return;
    debouncedUpsert({
      report_id: reportId,
      mood_score: row?.mood_score ?? 0,
      focus_level: row?.focus_level ?? 0,
      key_context: {
        ...parseKeyContext(row?.key_context ?? null),
        free_note: note,
      },
    });
  }, [note, hydrated, reportId, debouncedUpsert, isLocked]);

  const handleStructure = () => {
    if (!note.trim()) return;
    structureMutation.mutate(
      { text: note, context: "free_note" },
      {
        onSuccess: (structured) => {
          if (structured) setNote(structured.slice(0, MAX_LENGTH));
        },
      }
    );
  };

  return (
    <section className="mb-8">
      <div className="flex items-center gap-2">
        <PenLine className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold text-foreground">{t("report.notes.title")}</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">{t("report.notes.subtitle")}</p>

      <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <label className="font-medium text-foreground text-sm">{t("report.notes.label")}</label>
          <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">{t("common.optional")}</span>
        </div>

        <div className="flex flex-row gap-2 mb-2">
          <VoiceRecordButton
            context="free_note"
            lang={speechLang}
            onTranscript={(transcript) =>
              setNote((prev) => (prev ? (prev + " " + transcript).slice(0, MAX_LENGTH) : transcript.slice(0, MAX_LENGTH)))
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
                {t("common.structuring")}
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5 text-violet-500" />
                {t("common.structureWithAI")}
              </>
            )}
          </Button>
        </div>

        <Textarea
          className="text-sm min-h-[140px]"
          placeholder={t("report.notes.placeholder")}
          maxLength={3000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="text-xs text-muted-foreground text-right mt-0.5">{note.length}/3000</div>

        <p className="text-xs text-muted-foreground mt-3 bg-muted/40 rounded-lg px-3 py-2">
          {t("report.notes.info")}
        </p>
      </div>
    </section>
  );
}
