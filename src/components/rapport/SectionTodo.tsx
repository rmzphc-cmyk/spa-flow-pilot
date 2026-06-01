import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertTriangle,
  Plus,
  History,
  MessageSquare,
  Square,
  Play,
  CheckCircle2,
  RotateCcw,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import {
  useTodos,
  useAddTodo,
  useUpdateTodoStatusWithComment,
  useUpdateFollowUp,
  useDeferTodo,
  parseTodoDescription,
  priorityDbToUi,
  sourceDbToUi,
  type DbTodo,
  type DbTodoStatus,
} from "@/hooks/useTodos";

interface Todo {
  id: string;
  title: string;
  responsible: string;
  deadline: string;
  priority: "critical" | "high" | "normal";
  dbStatus: DbTodoStatus;
  overdueDays?: number;
  source?: "ids" | "ia" | "previous";
  originCycle?: string;
  followUp?: string;
  _description: string | null;
  _raw: DbTodo;
}

const priorityIcons: Record<string, string> = {
  critical: "🔴",
  high: "🟠",
  normal: "🔵",
};

const sourceStyles: Record<string, { label: string; classes: string }> = {
  ids: { label: "IDS", classes: "bg-violet-100 text-violet-800" },
  ia: { label: "IA", classes: "bg-accent text-accent-foreground" },
  previous: { label: "Cycle N-1", classes: "bg-blue-100 text-blue-800" },
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
  if (!due) return "À définir";
  try {
    const d = new Date(due);
    return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  } catch {
    return "À définir";
  }
}

function computeOverdueDays(due: string | null): number | undefined {
  if (!due) return undefined;
  const d = new Date(due);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  const diff = Math.floor((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : undefined;
}

function mapDbToTodo(db: DbTodo, currentReportId: string): Todo {
  const meta = parseTodoDescription(db.description);
  const isPrevious = db.report_id !== currentReportId;
  const baseSource = sourceDbToUi(db.source);
  return {
    id: db.id,
    title: db.title,
    responsible: meta.responsible,
    deadline: formatDeadline(db.due_date),
    priority: priorityDbToUi(db.priority),
    dbStatus: db.status,
    overdueDays: computeOverdueDays(db.due_date),
    source: isPrevious ? "previous" : baseSource,
    originCycle: meta.originCycle,
    followUp: meta.followUp,
    _description: db.description,
    _raw: db,
  };
}

interface Props { reportId: string }

export function SectionTodo({ reportId }: Props) {
  const { spaId } = useAuth();
  const { data: dbTodos = [] } = useTodos(reportId, spaId);
  const addTodo = useAddTodo(reportId);
  const updateWithComment = useUpdateTodoStatusWithComment();
  const deferMutation = useDeferTodo();
  const updateFollowUp = useUpdateFollowUp(reportId);

  const todos = useMemo(
    () => dbTodos.map((t) => mapDbToTodo(t, reportId)),
    [dbTodos, reportId]
  );

  const [newOpen, setNewOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newResponsible, setNewResponsible] = useState("");
  const [newDeadline, setNewDeadline] = useState("next_meeting");
  const [newPriority, setNewPriority] = useState("normal");
  const [editingFollowUp, setEditingFollowUp] = useState<string | null>(null);
  const [followUpDraft, setFollowUpDraft] = useState("");
  const [pendingChange, setPendingChange] = useState<{
    id: string;
    status: DbTodoStatus;
    comment: string;
    newDueDate?: string;
  } | null>(null);
  const [confirmReset, setConfirmReset] = useState<string | null>(null);

  const inherited = todos.filter((t) => t.source === "previous");
  const inheritedPending = inherited.filter((t) => t.dbStatus !== "done");
  const inheritedDoneCount = inherited.filter((t) => t.dbStatus === "done").length;
  const inheritedMissingFollowUp = inheritedPending.filter((t) => !t.followUp?.trim()).length;

  const current = todos.filter((t) => t.source !== "previous");
  const overdue = current.filter((t) => t.overdueDays && t.overdueDays > 0 && t.dbStatus !== "done");
  const active = current
    .filter((t) => !t.overdueDays && t.dbStatus !== "done")
    .sort((a, b) => {
      const prio = { critical: 0, high: 1, normal: 2 };
      return prio[a.priority] - prio[b.priority];
    });
  const doneCurrent = current.filter((t) => t.dbStatus === "done");

  const handleStatusClick = (t: Todo, status: DbTodoStatus) => {
    if (t.dbStatus === status) return;
    if (status === "pending" && t.dbStatus === "done") {
      setConfirmReset(t.id);
      return;
    }
    if (status === "pending" || status === "in_progress" || status === "done") {
      updateWithComment.mutate({
        id: t.id,
        status,
        comment: "",
        currentDescription: t._description,
      });
      setPendingChange(null);
      return;
    }
    setPendingChange({ id: t.id, status, comment: "", newDueDate: "" });
  };

  const confirmResetTodo = (t: Todo) => {
    updateWithComment.mutate({
      id: t.id,
      status: "pending",
      comment: "",
      currentDescription: t._description,
    });
    setPendingChange(null);
    setConfirmReset(null);
  };

  const confirmChange = (t: Todo) => {
    if (!pendingChange) return;
    if (pendingChange.status === "deferred") {
      deferMutation.mutate({
        id: t.id,
        reason: pendingChange.comment,
        newDueDate: pendingChange.newDueDate!,
        currentTodo: t._raw,
        currentDescription: t._description,
      });
    } else {
      updateWithComment.mutate({
        id: t.id,
        status: pendingChange.status,
        comment: pendingChange.comment,
        currentDescription: t._description,
      });
    }
    setPendingChange(null);
  };

  const skipChange = (t: Todo) => {
    updateWithComment.mutate({
      id: t.id,
      status: "in_progress",
      comment: "",
      currentDescription: t._description,
    });
    setPendingChange(null);
  };

  const saveFollowUp = (id: string) => {
    const todo = todos.find((t) => t.id === id);
    updateFollowUp.mutate({
      id,
      followUp: followUpDraft,
      currentDescription: todo?._description ?? null,
    });
    setEditingFollowUp(null);
    setFollowUpDraft("");
  };

  const handleCreate = () => {
    if (!newTitle.trim()) return;
    let due: string | null = null;
    if (newDeadline === "next_meeting") {
      const d = new Date();
      d.setMonth(d.getMonth() + 1, 0);
      due = d.toISOString().slice(0, 10);
    }
    addTodo.mutate({
      title: newTitle,
      responsible: newResponsible || "",
      priority: newPriority as "critical" | "high" | "normal",
      due_date: due,
    });
    setNewTitle("");
    setNewResponsible("");
    setNewOpen(false);
  };

  const renderStatusBar = (t: Todo) => {
    const isDeferOpen = pendingChange?.id === t.id && pendingChange.status === "deferred";
    const isResetConfirm = confirmReset === t.id;
    return (
      <div className="space-y-2">
        {isResetConfirm && (
          <div className="bg-muted border border-border rounded-lg p-3 space-y-2">
            <p className="text-xs text-foreground font-medium">
              Remettre cette action "À faire" effacera son statut de complétion. Continuer ?
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="destructive"
                className="h-7 text-xs"
                onClick={() => confirmResetTodo(t)}
              >
                Confirmer
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => setConfirmReset(null)}
              >
                Annuler
              </Button>
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-1.5">
          {STATUS_OPTIONS.map((s) => {
            const isActive = t.dbStatus === s.value;
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
        {isDeferOpen && pendingChange && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-amber-900">Reporter au *</label>
              <Input
                autoFocus
                type="date"
                value={pendingChange.newDueDate ?? ""}
                onChange={(e) =>
                  setPendingChange((p) => (p ? { ...p, newDueDate: e.target.value } : null))
                }
                className="text-sm h-8 bg-white"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-amber-900">
                Raison <span className="font-normal text-amber-700">(optionnel)</span>
              </label>
              <Input
                placeholder="Pourquoi ce report…"
                value={pendingChange.comment}
                onChange={(e) =>
                  setPendingChange((p) => (p ? { ...p, comment: e.target.value } : null))
                }
                className="text-sm h-8 bg-white"
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="h-8 bg-amber-600 hover:bg-amber-700 text-white"
                disabled={!pendingChange.newDueDate}
                onClick={() => confirmChange(t)}
              >
                Confirmer le report
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8"
                onClick={() => setPendingChange(null)}
              >
                Annuler
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderFollowUp = (t: Todo, warnIfMissing = false) => {
    if (editingFollowUp === t.id) {
      return (
        <div className="flex gap-2">
          <Input
            autoFocus
            placeholder="Ex: Retours positifs / Repoussé pour congé / Fait avec ajustement…"
            value={followUpDraft}
            onChange={(e) => setFollowUpDraft(e.target.value)}
            className="text-sm h-8"
            onKeyDown={(e) => { if (e.key === "Enter") saveFollowUp(t.id); }}
          />
          <Button size="sm" className="h-8" onClick={() => saveFollowUp(t.id)}>OK</Button>
        </div>
      );
    }
    return (
      <button
        onClick={() => { setEditingFollowUp(t.id); setFollowUpDraft(t.followUp || ""); }}
        className={`w-full text-left text-xs flex items-start gap-1.5 px-2 py-1.5 rounded transition-colors ${
          t.followUp
            ? "text-foreground bg-muted/50 hover:bg-muted"
            : warnIfMissing
              ? "text-amber-700 bg-amber-50 hover:bg-amber-100 italic"
              : "text-muted-foreground bg-muted/30 hover:bg-muted italic"
        }`}
      >
        <MessageSquare className="h-3 w-3 mt-0.5 shrink-0" />
        <span className="flex-1">
          {t.followUp || (warnIfMissing ? "Ajouter un commentaire de suivi…" : "Ajouter un suivi…")}
        </span>
      </button>
    );
  };

  const renderCard = (t: Todo, opts?: { overdue?: boolean }) => (
    <div key={t.id} className="bg-card border border-border rounded-xl p-4 shadow-sm space-y-3">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-foreground">{t.title}</span>
            {t.source && sourceStyles[t.source] && (
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${sourceStyles[t.source].classes}`}>
                {sourceStyles[t.source].label}
              </span>
            )}
            {opts?.overdue && t.overdueDays && (
              <span className="text-xs font-medium text-destructive">RETARD +{t.overdueDays}j</span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
            <span>{t.responsible || "—"}</span>
            <span>{t.deadline}</span>
            {t._raw.deferred_count > 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-amber-100 text-amber-800">
                ↩ {t._raw.deferred_count}×
              </span>
            )}
          </div>
        </div>
        <span className="text-sm shrink-0">{priorityIcons[t.priority]}</span>
      </div>
      {renderStatusBar(t)}
    </div>
  );

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">To-do</h2>
          <p className="text-sm text-muted-foreground">Actions à réaliser ce cycle</p>
        </div>
        <Dialog open={newOpen} onOpenChange={setNewOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> Ajouter
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nouvelle action</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              <Input placeholder="Titre de l'action *" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
              <Input placeholder="Responsable (ex : Marie)" value={newResponsible} onChange={(e) => setNewResponsible(e.target.value)} />
              <Select value={newDeadline} onValueChange={setNewDeadline}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="next_meeting">Prochaine réunion</SelectItem>
                  <SelectItem value="custom">Date précise</SelectItem>
                </SelectContent>
              </Select>
              <Select value={newPriority} onValueChange={setNewPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">🔴 Critique</SelectItem>
                  <SelectItem value="high">🟠 Haute</SelectItem>
                  <SelectItem value="normal">🔵 Normale</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleCreate} className="w-full">Créer l'action</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* 1. En retard */}
      {overdue.length > 0 && (
        <div className="rounded-xl p-4 mb-4 border-l-4 border-l-destructive" style={{ backgroundColor: "#FFF5F5" }}>
          <h3 className="text-sm font-bold text-destructive flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4" />
            {overdue.length} action{overdue.length > 1 ? "s" : ""} en retard
          </h3>
          <div className="space-y-2">
            {overdue.map((t) => renderCard(t, { overdue: true }))}
          </div>
        </div>
      )}

      {/* 2. Actions actives */}
      <div className="space-y-2 mb-4">
        {active.map((t) => renderCard(t))}
      </div>

      {/* 3. Faites ce cycle */}
      {doneCurrent.length > 0 && (
        <div className="rounded-xl p-4 mb-4 border border-emerald-200 bg-emerald-50/50">
          <h3 className="text-sm font-bold text-emerald-900 flex items-center gap-2 mb-3">
            <CheckCircle2 className="h-4 w-4" />
            Faites ce cycle
            <span className="font-normal text-emerald-700 ml-1">
              — {doneCurrent.length} action{doneCurrent.length > 1 ? "s" : ""}
            </span>
          </h3>
          <div className="space-y-2">
            {doneCurrent.map((t) => (
              <div key={t.id} className="bg-white/60 border border-emerald-100 rounded-lg p-3 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span className="text-sm line-through text-muted-foreground flex-1">{t.title}</span>
                <span className="text-xs text-muted-foreground">{t.responsible || "—"}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Héritées du cycle précédent — en dernier */}
      {inherited.length > 0 && (
        <div className="rounded-xl p-4 mb-4 border border-blue-200 bg-blue-50/50">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-blue-900 flex items-center gap-2">
              <History className="h-4 w-4" />
              Héritées du cycle précédent
              <span className="font-normal text-blue-700">
                {inherited[0].originCycle ? `— ${inherited[0].originCycle} · ` : "— "}
                {inheritedPending.length} en cours, {inheritedDoneCount} terminée{inheritedDoneCount > 1 ? "s" : ""}
              </span>
            </h3>
            {inheritedMissingFollowUp > 0 && (
              <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                {inheritedMissingFollowUp} commentaire{inheritedMissingFollowUp > 1 ? "s" : ""} de suivi manquant{inheritedMissingFollowUp > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <p className="text-xs text-blue-800/80 mb-3 italic">
            Chaque action décidée doit avoir une trace. Commentez l'avancement pour la Direction.
          </p>
          <div className="space-y-2">
            {inherited.map((t) => (
              <div key={t.id} className="bg-card border border-blue-100 rounded-lg p-3 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
                    <span className={`text-sm font-medium ${t.dbStatus === "done" ? "line-through text-muted-foreground" : "text-foreground"}`}>
                      {t.title}
                    </span>
                    <span className="text-xs text-muted-foreground">{t.responsible}</span>
                    <span className="text-xs text-muted-foreground">· {t.deadline}</span>
                    {t.overdueDays && t.dbStatus !== "done" && (
                      <span className="text-xs font-medium text-destructive">RETARD +{t.overdueDays}j</span>
                    )}
                  </div>
                </div>
                {renderStatusBar(t)}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
