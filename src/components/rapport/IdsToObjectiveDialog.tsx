import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { useConvertIdsToObjective, type DbIdsItem } from "@/hooks/useIdsItems";

interface Props {
  reportId: string;
  /** L'IDS à convertir ; le dialog est ouvert tant que non-null. */
  item: DbIdsItem | null;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

/**
 * Formulaire de conversion IDS → Objectif : fixe une date cible avant création.
 * Pendant : la conversion passe par l'EF ids-convert (cf. useConvertIdsToObjective).
 * Partagé entre SectionIds (rapport) et MeetingView (mode réunion).
 */
export function IdsToObjectiveDialog({ reportId, item, onOpenChange, onCreated }: Props) {
  const { t } = useTranslation();
  const convertToObjective = useConvertIdsToObjective(reportId);
  const [targetDate, setTargetDate] = useState("");

  useEffect(() => {
    if (item) setTargetDate("");
  }, [item]);

  const submit = () => {
    if (!item || !targetDate) return;
    convertToObjective.mutate(
      { item, targetDate },
      {
        onSuccess: () => {
          onOpenChange(false);
          onCreated?.();
          toast({
            title: t("report.ids.toastObjectifTitle"),
            description: t("report.ids.toastObjectifDesc"),
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
    <Dialog open={!!item} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("report.ids.convertObjectifTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {item && (
            <p className="text-sm text-foreground bg-muted/50 rounded-lg p-3">
              {item.capture_text}
            </p>
          )}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("report.ids.labelTargetDate")}</label>
            <Input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
            />
          </div>
          <p className="text-xs text-muted-foreground">{t("report.ids.maxObjectifs")}</p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("report.ids.cancel")}
          </Button>
          <Button
            onClick={submit}
            disabled={!targetDate || convertToObjective.isPending}
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
