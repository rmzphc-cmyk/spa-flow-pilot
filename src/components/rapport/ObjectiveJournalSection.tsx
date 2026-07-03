import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { friendlyError } from "@/lib/errorMessages";
import {
  useAddObjectiveUpdate,
  type DbObjective,
  type DbObjectiveUpdate,
  type ObjectiveSituation,
} from "@/hooks/useObjectives";

const SITUATION_OPTIONS: {
  key: ObjectiveSituation;
  emoji: string;
  labelKey: string;
  selectedClasses: string;
}[] = [
  {
    key: "on_track",
    emoji: "🟢",
    labelKey: "objectifs.journal.situationOnTrack",
    selectedClasses: "bg-emerald-100 text-emerald-800 border-emerald-300",
  },
  {
    key: "complicated",
    emoji: "🟠",
    labelKey: "objectifs.journal.situationComplicated",
    selectedClasses: "bg-amber-100 text-amber-800 border-amber-300",
  },
  {
    key: "struggling",
    emoji: "🔴",
    labelKey: "objectifs.journal.situationStruggling",
    selectedClasses: "bg-red-100 text-red-800 border-red-300",
  },
];

function formatEntryDate(iso: string, locale: string): string {
  try {
    return new Date(iso).toLocaleDateString(locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

function EntryRow({
  entry,
  unit,
  locale,
}: {
  entry: DbObjectiveUpdate;
  unit: string;
  locale: string;
}) {
  const situationOption = SITUATION_OPTIONS.find((s) => s.key === entry.situation);
  return (
    <div className="flex gap-3 px-3 py-2.5 border-b border-border last:border-0">
      <span className="text-sm leading-5 shrink-0 mt-0.5">{situationOption?.emoji ?? "•"}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">
            {formatEntryDate(entry.created_at, locale)}
          </span>
          {entry.value !== null && (
            <span className="text-xs font-medium text-foreground bg-muted rounded px-1.5 py-0.5 tabular-nums">
              {entry.value}
              {unit}
            </span>
          )}
        </div>
        {entry.action_text && (
          <p className="text-sm text-foreground leading-snug mt-0.5">{entry.action_text}</p>
        )}
      </div>
    </div>
  );
}

interface Props {
  objective: DbObjective;
  /** Entrées de journal de CET objectif, plus récentes en premier. */
  entries: DbObjectiveUpdate[];
  /** Weekly courant — pointeur d'audit stocké sur chaque entrée. */
  reportId: string;
  /** Unité affichée à côté des valeurs (chiffré). */
  unit: string;
  /** Dernière valeur connue (rappel sous l'input). */
  lastValue: number | null;
  /** true = rapport validé : timeline seule, pas de saisie. */
  isLocked: boolean;
  /** false = timeline seule (ex. bilan mensuel). */
  canAddEntry: boolean;
}

/**
 * Journal d'actions d'un objectif (cœur de la Phase 2) : formulaire d'entrée
 * de la semaine (tag situation + valeur pour le chiffré + texte) + timeline
 * append-only. L'écriture passe par l'EF ids-convert — jamais d'insert client
 * (perdu en silence sur weekly verrouillé).
 */
export function ObjectiveJournalSection({
  objective,
  entries,
  reportId,
  unit,
  lastValue,
  isLocked,
  canAddEntry,
}: Props) {
  const { t, i18n } = useTranslation();
  const addUpdate = useAddObjectiveUpdate();

  const isNumeric = objective.kind === "numeric";

  const [situation, setSituation] = useState<ObjectiveSituation | null>(null);
  const [actionText, setActionText] = useState("");
  const [value, setValue] = useState<string>("");

  // Chiffré : tag requis. Projet : tag OU texte (jamais d'entrée vide).
  const hasContent = isNumeric
    ? situation !== null
    : situation !== null || actionText.trim().length > 0;
  const canSubmit = !isLocked && canAddEntry && hasContent && !addUpdate.isPending;

  const alreadyThisReport = entries.some((e) => e.report_id === reportId);

  const handleSubmit = () => {
    if (!canSubmit) return;
    const numValue = isNumeric && value.trim() !== "" ? Number(value) : null;
    addUpdate.mutate(
      {
        objectiveId: objective.id,
        spaId: objective.spa_id,
        situation,
        actionText: actionText.trim() || undefined,
        value: Number.isFinite(numValue as number) ? numValue : null,
        reportId,
      },
      {
        onSuccess: () => {
          setSituation(null);
          setActionText("");
          setValue("");
          toast({
            title: t("objectifs.journal.successToast"),
            description: t("objectifs.journal.successDesc"),
          });
        },
        onError: (e) => {
          toast({
            title: t("report.ids.toastError"),
            description: friendlyError(e),
            variant: "destructive",
          });
        },
      },
    );
  };

  return (
    <div className="mt-3 space-y-3">
      {/* ── Saisie de la semaine ── */}
      {!isLocked && canAddEntry && (
        <div className="border border-border rounded-lg p-3.5 bg-muted/30 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-xs font-medium text-foreground">
              {t("objectifs.journal.newEntry")}
            </p>
            {alreadyThisReport && (
              <span className="text-xs text-emerald-700">
                {t("objectifs.journal.doneThisWeek")}
              </span>
            )}
          </div>

          {/* Tag situation */}
          <div className="flex gap-1.5 flex-wrap">
            {SITUATION_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setSituation(situation === opt.key ? null : opt.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  situation === opt.key
                    ? opt.selectedClasses
                    : "bg-card text-muted-foreground border-border hover:bg-muted"
                }`}
              >
                {opt.emoji} {t(opt.labelKey)}
              </button>
            ))}
          </div>

          {/* Valeur (chiffré) */}
          {isNumeric && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">
                {t("objectifs.journal.valueLabel")}
                {lastValue !== null && (
                  <span className="ml-1.5 text-muted-foreground/70">
                    {t("objectifs.journal.lastValue", { value: lastValue, unit })}
                  </span>
                )}
              </p>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  className="w-28 text-right"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                />
                {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
              </div>
            </div>
          )}

          {/* Texte libre */}
          <Textarea
            className="text-sm min-h-[56px]"
            placeholder={t("objectifs.journal.actionPlaceholder")}
            maxLength={400}
            value={actionText}
            onChange={(e) => setActionText(e.target.value)}
          />

          <div className="flex justify-end">
            <Button size="sm" disabled={!canSubmit} onClick={handleSubmit} className="gap-1.5">
              {addUpdate.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {t("objectifs.journal.submitBtn")}
            </Button>
          </div>
        </div>
      )}

      {/* ── Timeline (append-only, lecture seule) ── */}
      {entries.length > 0 ? (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5">
            {t("objectifs.journal.historyTitle", { count: entries.length })}
          </p>
          <div className="border border-border rounded-lg overflow-hidden bg-card max-h-64 overflow-y-auto">
            {entries.map((entry) => (
              <EntryRow key={entry.id} entry={entry} unit={unit} locale={i18n.language} />
            ))}
          </div>
        </div>
      ) : (
        (isLocked || !canAddEntry) && (
          <p className="text-xs text-muted-foreground italic">
            {t("objectifs.journal.noHistory")}
          </p>
        )
      )}
    </div>
  );
}
