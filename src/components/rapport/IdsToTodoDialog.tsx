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
import { useConvertIdsToTodo, type DbIdsItem } from "@/hooks/useIdsItems";

interface Props {
  reportId: string;
  /** L'IDS à convertir ; le dialog est ouvert tant que non-null. */
  item: DbIdsItem | null;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

/**
 * Formulaire de conversion IDS → To-Do : permet de fixer un responsable et une
 * date d'échéance avant création (le flux triage créait sinon le to-do sans date).
 * Partagé entre SectionIds (rapport) et MeetingView (mode réunion).
 */
export function IdsToTodoDialog({ reportId, item, onOpenChange, onCreated }: Props) {
  const { t } = useTranslation();
  const convertToTodo = useConvertIdsToTodo(reportId);
  const [responsible, setResponsible] = useState("");
  const [dueDate, setDueDate] = useState("");

  // Réinitialise les champs à chaque ouverture / changement d'item.
  useEffect(() => {
    if (item) {
      setResponsible("");
      setDueDate("");
    }
  }, [item]);

  const submit = () => {
    if (!item || !dueDate) return;
    convertToTodo.mutate(
      { item, dueDate, responsible: responsible.trim() },
      {
        onSuccess: () => {
          onOpenChange(false);
          onCreated?.();
          toast({
            title: t("report.ids.toastTodoTitle"),
            description: t("report.ids.toastTodoDesc"),
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
          <DialogTitle>{t("report.ids.convertTodoTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {item && (
            <p className="text-sm text-foreground bg-muted/50 rounded-lg p-3">
              {item.capture_text}
            </p>
          )}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("report.ids.labelResponsible")}</label>
            <Input
              value={responsible}
              onChange={(e) => setResponsible(e.target.value)}
              placeholder={t("report.ids.placeholderResponsible")}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("report.ids.labelDueDate")}</label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("report.ids.cancel")}
          </Button>
          <Button
            onClick={submit}
            disabled={!dueDate || convertToTodo.isPending}
            className="gap-1.5"
          >
            {convertToTodo.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {t("report.ids.createTodoBtn")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
