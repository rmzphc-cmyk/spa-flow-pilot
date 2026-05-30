import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Info, CheckSquare, Target, Check, Loader2 } from "lucide-react";
import type { SectionStatus } from "@/pages/RapportDetail";
import {
  useIdsItems,
  useAddIdsItem,
  type DbIdsItem,
} from "@/hooks/useIdsItems";
import { useAddTodoFromIds } from "@/hooks/useTodos";
import { useAddObjectiveFromIds } from "@/hooks/useObjectives";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

interface Props {
  reportId: string;
  onStatusChange: (status: SectionStatus) => void;
}

export function SectionIdsWeekly({ reportId }: Props) {
  const { user, spaId } = useAuth();
  const { data: issues = [], isLoading } = useIdsItems(reportId);
  const addMutation = useAddIdsItem(reportId, "weekly");
  const toTodoMutation = useAddTodoFromIds();
  const toObjectifMutation = useAddObjectiveFromIds();

  const [showInput, setShowInput] = useState(false);
  const [newIssue, setNewIssue] = useState("");

  const [todoDialog, setTodoDialog] = useState<{ open: boolean; issue: DbIdsItem | null }>({
    open: false,
    issue: null,
  });
  const [todoTitle, setTodoTitle] = useState("");
  const [todoResponsible, setTodoResponsible] = useState("");
  const [todoDueDate, setTodoDueDate] = useState("");

  const [objectifDialog, setObjectifDialog] = useState<{ open: boolean; issue: DbIdsItem | null }>({
    open: false,
    issue: null,
  });
  const [objectifTitle, setObjectifTitle] = useState("");
  const [objectifTargetDate, setObjectifTargetDate] = useState("");

  useEffect(() => {
    if (!isLoading) onStatusChange("complete");
  }, [isLoading, onStatusChange]);

  const addIssue = () => {
    if (!newIssue.trim() || !user || !spaId) return;
    addMutation.mutate(newIssue.trim(), {
      onSuccess: () => {
        setNewIssue("");
        setShowInput(false);
      },
    });
  };

  const cancel = () => {
    setNewIssue("");
    setShowInput(false);
  };

  const openTodoDialog = (issue: DbIdsItem) => {
    setTodoTitle(issue.capture_text);
    setTodoResponsible("");
    setTodoDueDate("");
    setTodoDialog({ open: true, issue });
  };

  const submitTodo = () => {
    if (!todoDialog.issue || !todoTitle.trim() || !todoDueDate) return;
    toTodoMutation.mutate(
      {
        idsItemId: todoDialog.issue.id,
        reportId,
        title: todoTitle.trim(),
        responsible: todoResponsible.trim(),
        dueDate: todoDueDate,
      },
      {
        onSuccess: () => {
          setTodoDialog({ open: false, issue: null });
          toast({
            title: "To-do créé",
            description: "Visible dans la section Actions du rapport Monthly",
          });
        },
      },
    );
  };

  const openObjectifDialog = (issue: DbIdsItem) => {
    setObjectifTitle(issue.capture_text);
    setObjectifTargetDate("");
    setObjectifDialog({ open: true, issue });
  };

  const submitObjectif = () => {
    if (!objectifDialog.issue || !objectifTitle.trim() || !objectifTargetDate) return;
    toObjectifMutation.mutate(
      {
        idsItemId: objectifDialog.issue.id,
        reportId,
        title: objectifTitle.trim(),
        targetDate: objectifTargetDate,
      },
      {
        onSuccess: () => {
          setObjectifDialog({ open: false, issue: null });
          toast({
            title: "Objectif créé",
            description: "Visible dans la section Objectifs du rapport Monthly",
          });
        },
      },
    );
  };

  const todoCount = issues.filter((i) => i.converted_to_todo_id).length;
  const objectifCount = issues.filter((i) => i.converted_to_objective_id).length;

  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold text-foreground">Problèmes identifiés</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Capture rapide — convertissez en to-do ou objectif si besoin
      </p>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        issues.length > 0 && (
          <div className="space-y-2 mb-4">
            {issues.map((issue) => {
              const hasTodo = !!issue.converted_to_todo_id;
              const hasObjectif = !!issue.converted_to_objective_id;
              const dateFr = new Date(issue.created_at).toLocaleDateString("fr-FR");
              return (
                <div
                  key={issue.id}
                  className="bg-card border border-border rounded-xl p-3 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground">{issue.capture_text}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                          Identifié
                        </span>
                        <span className="text-xs text-muted-foreground">{dateFr}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-2.5 flex-wrap">
                    {hasTodo ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-1 rounded-full">
                        <Check className="h-3 w-3" /> To-do créé
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1.5"
                        onClick={() => openTodoDialog(issue)}
                      >
                        <CheckSquare className="h-3.5 w-3.5" /> → To-do
                      </Button>
                    )}
                    {hasObjectif ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-1 rounded-full">
                        <Check className="h-3 w-3" /> Objectif créé
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1.5"
                        onClick={() => openObjectifDialog(issue)}
                      >
                        <Target className="h-3.5 w-3.5" /> → Objectif
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {showInput ? (
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm space-y-3">
          <Input
            placeholder="Décrivez le problème en une phrase..."
            maxLength={150}
            value={newIssue}
            onChange={(e) => setNewIssue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addIssue()}
            autoFocus
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={addIssue}
              disabled={!newIssue.trim() || addMutation.isPending}
              className="gap-1.5"
            >
              {addMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Confirmer
            </Button>
            <Button size="sm" variant="ghost" onClick={cancel}>
              Annuler
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="outline"
          onClick={() => setShowInput(true)}
          className="gap-1.5 border-primary text-primary hover:bg-primary/5"
        >
          <Plus className="h-4 w-4" />
          Ajouter un problème
        </Button>
      )}

      {issues.length > 0 && (
        <p className="text-xs text-muted-foreground mt-3">
          {issues.length} problème(s) · {todoCount} to-do(s) créé(s) · {objectifCount} objectif(s) créé(s)
        </p>
      )}

      <div className="mt-6 flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <span>Les problèmes identifiés ici seront traités lors de la prochaine réunion Monthly.</span>
      </div>

      {/* Dialog To-do */}
      <Dialog
        open={todoDialog.open}
        onOpenChange={(open) => !open && setTodoDialog({ open: false, issue: null })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convertir en To-do</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Titre *</label>
              <Input value={todoTitle} onChange={(e) => setTodoTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Responsable</label>
              <Input
                value={todoResponsible}
                onChange={(e) => setTodoResponsible(e.target.value)}
                placeholder="Nom du responsable"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Date limite *</label>
              <Input
                type="date"
                value={todoDueDate}
                onChange={(e) => setTodoDueDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setTodoDialog({ open: false, issue: null })}
            >
              Annuler
            </Button>
            <Button
              onClick={submitTodo}
              disabled={!todoTitle.trim() || !todoDueDate || toTodoMutation.isPending}
              className="gap-1.5"
            >
              {toTodoMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Créer le to-do
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Objectif */}
      <Dialog
        open={objectifDialog.open}
        onOpenChange={(open) => !open && setObjectifDialog({ open: false, issue: null })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convertir en Objectif</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Titre *</label>
              <Input
                value={objectifTitle}
                onChange={(e) => setObjectifTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Date cible *</label>
              <Input
                type="date"
                value={objectifTargetDate}
                onChange={(e) => setObjectifTargetDate(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              ℹ️ Max 3 objectifs actifs par spa
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setObjectifDialog({ open: false, issue: null })}
            >
              Annuler
            </Button>
            <Button
              onClick={submitObjectif}
              disabled={
                !objectifTitle.trim() || !objectifTargetDate || toObjectifMutation.isPending
              }
              className="gap-1.5"
            >
              {toObjectifMutation.isPending && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              )}
              Créer l'objectif
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
