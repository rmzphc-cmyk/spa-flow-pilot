import { useTranslation } from "react-i18next";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { friendlyError } from "@/lib/errorMessages";
import {
  useToggleObjectiveStep,
  type DbObjectiveStep,
} from "@/hooks/useObjectives";

interface Props {
  steps: DbObjectiveStep[];
  spaId: string;
  /** true = lecture seule (rapport validé). */
  isLocked: boolean;
}

/**
 * Checklist des étapes d'un objectif projet. Le cochage passe par l'EF
 * ids-convert (dual-write du blob « x/N » lu par le PDF et la Direction).
 */
export function ObjectiveStepsChecklist({ steps, spaId, isLocked }: Props) {
  const { t } = useTranslation();
  const toggleStep = useToggleObjectiveStep();

  if (steps.length === 0) return null;

  const handleToggle = (step: DbObjectiveStep, checked: boolean) => {
    toggleStep.mutate(
      { stepId: step.id, spaId, isDone: checked },
      {
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
    <div className="mt-3">
      <p className="text-xs font-medium text-muted-foreground mb-1.5">
        {t("objectifs.steps.title")}
      </p>
      <div className="space-y-1.5">
        {steps.map((step) => (
          <label
            key={step.id}
            className={`flex items-start gap-2.5 rounded-lg border border-border px-3 py-2 bg-card ${
              isLocked ? "opacity-80" : "cursor-pointer hover:bg-muted/50"
            }`}
          >
            <Checkbox
              checked={step.is_done}
              disabled={isLocked || toggleStep.isPending}
              onCheckedChange={(checked) => handleToggle(step, checked === true)}
              className="mt-0.5"
            />
            <span
              className={`text-sm leading-snug ${
                step.is_done ? "text-muted-foreground line-through" : "text-foreground"
              }`}
            >
              {step.label}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
