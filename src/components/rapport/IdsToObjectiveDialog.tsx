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
import { useConvertIdsToObjective, type DbIdsItem } from "@/hooks/useIdsItems";
import {
  useObjectives,
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
  reportId: string;
  /** L'IDS à convertir ; le dialog est ouvert tant que non-null. */
  item: DbIdsItem | null;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

/**
 * Formulaire de conversion IDS → Objectif : titre (pré-rempli avec la capture),
 * nature (chiffré/projet), champs indicateur ou étapes, date cible. La
 * conversion passe par l'EF ids-convert (cf. useConvertIdsToObjective) qui
 * porte la garde de limite serveur.
 * Partagé entre SectionIds (rapport) et MeetingView (réunion).
 */
export function IdsToObjectiveDialog({ reportId, item, onOpenChange, onCreated }: Props) {
  const { t } = useTranslation();
  const { spaId } = useAuth();
  const convertToObjective = useConvertIdsToObjective(reportId);
  // Souscription uniquement dialog ouvert (item non-null) — évite de charger
  // les objectifs pour chaque ligne IDS qui monte ce dialog fermé.
  const { data: objectives } = useObjectives(item ? spaId : null);
  // Garde UI — l'autorité reste le trigger serveur (OBJECTIVE_LIMIT_REACHED).
  const atLimit = (objectives?.length ?? 0) >= MAX_ACTIVE_OBJECTIVES;

  const [values, setValues] = useState<ObjectiveFormValues>(makeEmptyObjectiveFormValues);

  useEffect(() => {
    if (item) {
      setValues({ ...makeEmptyObjectiveFormValues(), title: item.capture_text });
    }
  }, [item]);

  const submit = () => {
    if (!item || atLimit || !isObjectiveFormValid(values)) return;
    convertToObjective.mutate(
      { item, ...objectiveFormToPayload(values) },
      {
        onSuccess: (data) => {
          onOpenChange(false);
          onCreated?.();
          if (data?.already) {
            // L'IDS avait déjà été converti (double clic, autre session…) —
            // info, pas succès : rien de nouveau n'a été créé.
            toast({
              title: t("report.ids.toastObjectifAlreadyTitle"),
              description: t("report.ids.toastObjectifAlreadyDesc"),
            });
          } else {
            toast({
              title: t("report.ids.toastObjectifTitle"),
              description: t("report.ids.toastObjectifDesc"),
            });
          }
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
      },
    );
  };

  return (
    <Dialog open={!!item} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("report.ids.convertObjectifTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {item && (
            <p className="text-sm text-foreground bg-muted/50 rounded-lg p-3">
              {item.capture_text}
            </p>
          )}
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
            disabled={atLimit || !isObjectiveFormValid(values) || convertToObjective.isPending}
            className="gap-1.5"
          >
            {convertToObjective.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {t("report.ids.createObjectifBtn")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
