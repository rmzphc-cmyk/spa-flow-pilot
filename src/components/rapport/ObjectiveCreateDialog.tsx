import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { friendlyError } from "@/lib/errorMessages";
import { useAuth } from "@/contexts/AuthContext";
import {
  useObjectives,
  useCreateObjective,
  isObjectiveLimitError,
  isTargetEqualsStartError,
  MAX_ACTIVE_OBJECTIVES,
} from "@/hooks/useObjectives";
import {
  ObjectiveFormFields,
  makeEmptyObjectiveFormValues,
  isObjectiveFormValid,
  objectiveFormToPayload,
  type ObjectiveFormValues,
} from "./ObjectiveFormFields";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Création directe d'un objectif (décision A — chemin secondaire, la voie
 * primaire reste la conversion IDS). Passe par l'EF ids-convert : garde de
 * limite serveur + dual-write legacy. Monté depuis /objectifs et SectionObjectifs.
 */
export function ObjectiveCreateDialog({ open, onOpenChange }: Props) {
  const { t } = useTranslation();
  const { spaId } = useAuth();
  const createObjective = useCreateObjective();
  const { data: objectives } = useObjectives(open ? spaId : null);
  // Garde UI — l'autorité reste le trigger serveur (OBJECTIVE_LIMIT_REACHED).
  const atLimit = (objectives?.length ?? 0) >= MAX_ACTIVE_OBJECTIVES;

  const [values, setValues] = useState<ObjectiveFormValues>(makeEmptyObjectiveFormValues);

  useEffect(() => {
    if (open) setValues(makeEmptyObjectiveFormValues());
  }, [open]);

  const submit = () => {
    if (atLimit || !isObjectiveFormValid(values)) return;
    createObjective.mutate(objectiveFormToPayload(values), {
      onSuccess: () => {
        onOpenChange(false);
        toast({
          title: t("report.ids.toastObjectifTitle"),
          description: t("objectifs.create.toastDesc"),
        });
      },
      onError: (e) => {
        toast({
          title: t("report.ids.toastError"),
          description: isObjectiveLimitError(e)
            ? t("objectifs.limitReachedError")
            : isTargetEqualsStartError(e)
              ? t("objectifs.form.targetEqualsStartError")
              : friendlyError(e),
          variant: "destructive",
        });
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("objectifs.create.title")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <ObjectiveFormFields values={values} onChange={setValues} />
          {atLimit ? (
            <p className="text-xs font-medium text-destructive">
              {t("objectifs.limitReached")}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">{t("report.ids.maxObjectifs")}</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("report.ids.cancel")}
          </Button>
          <Button
            onClick={submit}
            disabled={atLimit || !isObjectiveFormValid(values) || createObjective.isPending}
            className="gap-1.5"
          >
            {createObjective.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {t("report.ids.createObjectifBtn")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
