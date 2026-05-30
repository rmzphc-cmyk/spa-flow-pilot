import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  MessageSquare,
  Play,
  RotateCcw,
  Square,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import {
  useTodos,
  useUpdateTodoStatusWithComment,
  useUpdateFollowUp,
  parseTodoDescription,
  priorityDbToUi,
  sourceDbToUi,
  type DbTodo,
  type DbTodoStatus,
} from "@/hooks/useTodos";
import type { SectionStatus } from "@/pages/RapportDetail";

interface Props {
  reportId: string;
  onStatusChange: (status: SectionStatus) => void;
}

const priorityIcons: Record<string, string> = {
  critical: "🔴",
  high: "🟠",
  normal: "🔵",
};

const sourceStyles: Record<string, { label: string; classes: string }> = {
  ids: { label: "IDS", classes: "bg-violet-100 text-violet-800" },
  ia: { label: "IA", classes: "bg-emerald-50 text-emerald-700" },
};

const STATUS_OPTIONS: {
  value: DbTodoStatus;
  label: string;
  icon: typeof Square;
  color: string;
}[] = [
  { value: "pending", label: "À faire", icon: Square, color: "#6B7280" },
  { value: "in_progress", label: "En cours", icon: Play, color: "#3B82F6" },
  { value: "done", label: "Fait", icon: CheckCircle2, color: "#10B981" },
  { value: "deferred", label: "Reporter", icon: RotateCcw, color: "#F59E0B" },
];

const PLACEHOLDERS: Record<DbTodoStatus, string> = {
  pending: "",
  in_progress: "Avancement actuel, prochaine étape… (optionnel)",
  done: "Décrivez comment c'est fait, résultat obtenu…",
  deferred: "Raison du report, nouvelle échéance…",
};

function formatDeadline(due: string | null): string {
  if (!due) return "Sans échéance";
  try {
    return new Date(due).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  } catch {
    return "Sans échéance";
  }
}

function isOverdue(due: string | null): boolean {
  if (!due) return false;
  return new Date(due) < new Date(new Date().toDateString());
}

export function SectionTodoWeekly({ reportId, onStatusChange }: Props) {
  const { spaId } = useAuth();
  const { data: dbTodos = [], isLoading } = useTodos(reportId, spaId);
  const updateWithComment = useUpdateTodoStatusWithComment();
  const updateFollowUp = useUpdateFollowUp(reportId);

  const [pendingChange, setPendingChange] = useState<{
    id: string;
    status: DbTodoStatus;
    comment: string;
  } | null>(null);
  const [editingFollowUp, setEditingFollowUp] = useState<string | null>(null);
  const [followUpDraft, setFollowUpDraft] = useState("");

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { onStatusChange("complete"); }, []);

  const pending = dbTodos.filter((t) => t.status !== "done" && t.status !== "deferred");
  const overdue = pending.filter((t) => isOverdue(t.due_date));
  const active = pending.filter((t) => !isOverdue(t.due_date));

  const handleStatusClick = (todo: DbTodo, status: DbTodoStatus) => {
    if (todo.status === status) return;
    if (status === "pending") {
      updateWithComment.mutate({
        id: todo.id,
        status,
        comment: "",
        currentDescription: todo.description,
      });
      setPendingChange(null);
      return;
    }
    setPendingChange({ id: todo.id, status, comment: "" });
  };

  const confirmChange = (todo: DbTodo) => {
    if (!pendingChange) return;
    updateWithComment.mutate({
      id: todo.id,
      status: pendingChange.status,
      comment: pendingChange.comment,
      currentDescription: todo.description,
    });
    setPendingChange(null);
  };

  const skipChange = (todo: DbTodo) => {
    if (!pendingChange) return;
    updateWithComment.mutate({
      id: todo.id,
      status: "in_progress",
      comment: "",
      currentDescription: todo.description,
    });
    setPendingChange(null);
  };

  const saveFollowUp = (id: string) => {
    const todo = dbTodos.find((t) => t.id === id);
    updateFollowUp.mutate({
      id,
      followUp: followUpDraft,
      currentDescription: todo?.description ?? null,
    });
    setEditingFollowUp(null);
    setFollowUpDraft("");
  };

  const renderStatusBar = (t: DbTodo) => {
    const isPending = pendingChange?.id === t.id;
    const commentRequired =
      pendingChange?.status === "done" || pendingChange?.status === "deferred";
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {STATUS_OPTIONS.map((s) => {
            const isActive = t.status === s.value;
            const Icon = s.icon;
            return (
              <Button
                key={s.value}
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1"
                style={
                  isActive
                    ? { backgroundColor: s.color, borderColor: s.color, color: "white" }
                    : { color: s.color, borderColor: s.color }
                }
                onClick={() => handleStatusClick(t, s.value)}
              >
                <Icon className="h-3 w-3" /> {s.label}
              </Button>
            );
          })}
        </div>
        {isPending && pendingChange && (
          <div className="flex gap-2">
            <Input
              autoFocus
              placeholder={PLACEHOLDERS[pendingChange.status]}
              value={pendingChange.comment}
              onChange={(e) =>
                setPendingChange({ ...pendingChange, comment: e.target.value })
              }
              className="text-sm h-8"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (!commentRequired || pendingChange.comment.trim())) {
                  confirmChange(t);
                }
              }}
            />
            <Button
              size="sm"
              className="h-8"
              disabled={commentRequired && !pendingChange.comment.trim()}
              onClick={() => confirmChange(t)}
            >
              Confirmer
            </Button>
            {pendingChange.status === "in_progress" && (
              <Button
                size="sm"
                variant="outline"
                className="h-8"
                onClick={() => skipChange(t)}
              >
                Passer
              </Button>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderCard = (t: DbTodo, overdueCard: boolean) => {
    const meta = parseTodoDescription(t.description);
    const source = sourceDbToUi(t.source);
    const priority = priorityDbToUi(t.priority);
    const deadline = formatDeadline(t.due_date);
    const editing = editingFollowUp === t.id;

    return (
      <div key={t.id} className="bg-card border border-border rounded-xl p-4 shadow-sm space-y-3">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-foreground">{t.title}</span>
              {source && sourceStyles[source] && (
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${sourceStyles[source].classes}`}>
                  {sourceStyles[source].label}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
              <span>{meta.responsible || "—"}</span>
              <span className={overdueCard ? "text-destructive font-medium" : ""}>{deadline}</span>
            </div>
          </div>
          <span className="text-sm shrink-0">{priorityIcons[priority]}</span>
        </div>

        {renderStatusBar(t)}

        {editing ? (
          <div className="flex gap-2">
            <Input
              autoFocus
              placeholder="Ex: Avancement, blocage, prochaine étape…"
              value={followUpDraft}
              onChange={(e) => setFollowUpDraft(e.target.value)}
              className="text-sm h-8"
              onKeyDown={(e) => { if (e.key === "Enter") saveFollowUp(t.id); }}
            />
            <Button size="sm" className="h-8" onClick={() => saveFollowUp(t.id)}>OK</Button>
          </div>
        ) : (
          <button
            onClick={() => { setEditingFollowUp(t.id); setFollowUpDraft(meta.followUp || ""); }}
            className={`w-full text-left text-xs flex items-start gap-1.5 px-2 py-1.5 rounded transition-colors ${
              meta.followUp
                ? "text-foreground bg-muted/50 hover:bg-muted"
                : "text-muted-foreground bg-muted/30 hover:bg-muted italic"
            }`}
          >
            <MessageSquare className="h-3 w-3 mt-0.5 shrink-0" />
            <span className="flex-1">{meta.followUp || "Ajouter un suivi…"}</span>
          </button>
        )}
      </div>
    );
  };

  return (
    <section className="mb-8 px-6 pt-4">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-foreground">Actions en cours</h2>
        <p className="text-sm text-muted-foreground">Mettez à jour l'avancement de vos actions</p>
      </div>

      {pending.length === 0 && !isLoading && (
        <div className="rounded-xl border border-border bg-card p-6 text-center shadow-sm">
          <Check className="h-6 w-6 text-emerald-600 mx-auto mb-2" />
          <p className="text-sm font-medium text-foreground">Tout est à jour</p>
          <p className="text-xs text-muted-foreground mt-1">Aucune action en attente pour ce spa</p>
        </div>
      )}

      {overdue.length > 0 && (
        <div className="rounded-xl p-4 mb-4 border-l-4 border-l-destructive" style={{ backgroundColor: "#FFF5F5" }}>
          <h3 className="text-sm font-bold text-destructive flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4" />
            {overdue.length} action{overdue.length > 1 ? "s" : ""} en retard
          </h3>
          <div className="space-y-2">
            {overdue.map((t) => renderCard(t, true))}
          </div>
        </div>
      )}

      {active.length > 0 && (
        <div className="space-y-2">
          {active.map((t) => renderCard(t, false))}
        </div>
      )}

      <div className="mt-6 rounded-lg bg-muted/50 px-4 py-3 text-xs text-muted-foreground">
        💡 Pour créer de nouvelles actions, rendez-vous dans votre rapport Monthly.
      </div>
    </section>
  );
}
