import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { SectionStatus } from "@/pages/RapportDetail";
import { EmojiScore } from "./EmojiScore";
import { useCheckin, useUpsertCheckin, parseKeyContext } from "@/hooks/useCheckin";
import { VoiceRecordButton } from "@/components/VoiceRecordButton";
import { useStructureVoiceNote } from "@/hooks/useStructureVoiceNote";


interface Props {
  reportId: string;
  onStatusChange: (status: SectionStatus) => void;
  isLocked?: boolean;
}

export function SectionCheckinWeekly({ reportId, onStatusChange, isLocked = false }: Props) {
  const { t, i18n } = useTranslation();
  const speechLang = i18n.language === "es" ? "es-ES" : i18n.language === "en" ? "en-US" : "fr-FR";
  const { data: row, isFetching } = useCheckin(reportId);
  const { debouncedUpsert } = useUpsertCheckin();
  const structureMutation = useStructureVoiceNote();

  const MAX_LENGTH = 1000;

  const [meteoScore, setMeteoScore] = useState(0);
  const [note, setNote] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (hydrated) return;
    if (isFetching) return;
    if (row !== null) {
      const ctx = parseKeyContext(row.key_context);
      setMeteoScore(row.mood_score ?? 0);
      setNote(ctx.note ?? ctx.situation ?? "");
    }
    setHydrated(true);
  }, [row, hydrated, isFetching]);

  useEffect(() => {
    if (!hydrated || !reportId || isLocked) return;
    if (meteoScore === 0 && !note) return;
    debouncedUpsert({
      report_id: reportId,
      mood_score: meteoScore,
      focus_level: 0,
      key_context: { ...parseKeyContext(row?.key_context ?? null), note },
    });
  }, [hydrated, reportId, meteoScore, note, debouncedUpsert, isLocked]);

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
          if (structured) setNote(structured.slice(0, MAX_LENGTH));
        },
      }
    );
  };

  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold text-foreground">{t("report.checkinWeekly.title")}</h2>
      <p className="text-sm text-muted-foreground mb-4">{t("report.checkinWeekly.subtitle")}</p>

      <div className="bg-card border border-border rounded-xl p-5 shadow-sm mb-4">
        <label className="font-medium text-foreground text-sm block mb-1">
          {t("report.checkinWeekly.meteo.label")}
        </label>
        <p className="text-xs text-muted-foreground mb-4">{t("report.checkinWeekly.meteo.sublabel")}</p>
        <EmojiScore value={meteoScore} onChange={setMeteoScore} />
      </div>

      <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-1">
          <label className="font-medium text-foreground text-sm">{t("report.checkinWeekly.context.label")}</label>
          {needsComment ? (
            <span className="text-xs text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">
              {t("common.required")}
            </span>
          ) : (
            <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
              {t("common.optional")}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          {t("report.checkinWeekly.context.sublabel")}
        </p>

        <div className="flex flex-row gap-2 mb-2">
          <VoiceRecordButton
            context="check_in"
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
          className={`text-sm min-h-[100px] ${missing ? "border-destructive" : ""}`}
          placeholder={t("report.checkinWeekly.context.placeholder")}
          maxLength={1000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="text-xs text-muted-foreground text-right mt-0.5">{note.length}/1000</div>
      </div>
    </section>
  );
}
