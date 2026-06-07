import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
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

function computeOverdueDays(due: string | null): number | undefined {
  if (!due) return undefined;
  const d = new Date(due);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  const diff = Math.floor((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : undefined;
}

interface Props { reportId: string }

export function SectionTodo({ reportId }: Props) {
  const { spaId } = useAuth();
  const { t } = useTranslation();

  function formatDeadline(due: string | null): string {
    if (!due) return t("report.todo.deadlineUndefined");
    try {
      const d = new Date(due);
      return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
    } catch {
      return t("report.todo.deadlineUndefined");
    }
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

  const STATUS_OPTIONS: {
    value: DbTodoStatus;
    label: string;
    icon: typeof Square;
    color: string;
  }[] = [
    { value: "pending", label: t("report.todo.status.pending"), icon: Square, color: "#6B7280" },
    { value: "in_progress", label: t("report.todo.status.inProgress"), icon: Play, color: "#3B82F6" },
    { value: "done", label: t("report.todo.status.done"), icon: CheckCircle2, color: "#10B981" },
    { value: "deferred", label: t("report.todo.status.deferred"), icon: RotateCcw, color: "#F59E0B" },
  ];

  const PLACEHOLDERS: Record<DbTodoStatus, string> = {
    pending: "",
    in_progress: t("report.todo.placeholder.inProgress"),
    done: t("report.todo.placeholder.done"),
    deferred: t("report.todo.placeholder.deferred"),
  };

  const { data: dbTodos = [] } = useTodos(reportId, spaId);
  const addTodo = useAddTodo(reportId);
  const updateWithComment = useUpdateTodoStatusWithComment();
  const deferMutation = useDeferTodo();
  const updateFollowUp = useUpdateFollowUp(reportId);

  const todos = useMemo(
    () => dbTodos.map((item) => mapDbToTodo(item, reportId)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const inherited = todos.filter((item) => item.source === "previous");
  const inheritedPending = inherited.filter((item) => item.dbStatus !== "done");
  const inheritedDoneCount = inherited.filter((item) => item.dbStatus === "done").length;
  const inheritedMissingFollowUp = inheritedPending.filter((item) => !item.followUp?.trim()).length;

  const current = todos.filter((item) => item.source !== "previous");
  const overdue = current.filter((item) => item.overdueDays && item.overdueDays > 0 && item.dbStatus !== "done");
  const active = current
    .filter((item) => !item.overdueDays && item.dbStatus !== "done")
    .sort((a, b) => {
      const prio = { critical: 0, high: 1, normal: 2 };
      return prio[a.priority] - prio[b.priority];
    });
  const doneCurrent = current.filter((item) => item.dbStatus === "done");

  const handleStatusClick = (item: Todo, status: DbTodoStatus) => {
    if (item.dbStatus === status) return;
    if (status === "pending" && item.dbStatus === "done") {
      setConfirmReset(item.id);
      return;
    }
    if (status === "pending" || status === "in_progress" || status === "done") {
      updateWithComment.mutate({
        id: item.id,
        status,
        comment: "",
        currentDescription: item._description,
      });
      setPendingChange(null);
      return;
    }
    setPendingChange({ id: item.id, status, comment: "", newDueDate: "" });
  };

  const confirmResetTodo = (item: Todo) => {
    updateWithComment.mutate({
      id: item.id,
      status: "pending",
      comment: "",
      currentDescription: item._description,
    });
    setPendingChange(null);
    setConfirmReset(null);
  };

  const confirmChange = (item: Todo) => {
    if (!pendingChange) return;
    if (pendingChange.status === "deferred") {
      deferMutation.mutate({
        id: item.id,
        reason: pendingChange.comment,
        newDueDate: pendingChange.newDueDate!,
        currentTodo: item._raw,
        currentDescription: item._description,
      });
    } else {
      updateWithComment.mutate({
        id: item.id,
        status: pendingChange.status,
        comment: pendingChange.comment,
        currentDescription: item._description,
      });
    }
    setPendingChange(null);
  };

  const skipChange = (item: Todo) => {
    updateWithComment.mutate({
      id: item.id,
      status: "in_progress",
      comment: "",
      currentDescription: item._description,
    });
    setPendingChange(null);
  };

  const saveFollowUp = (id: string) => {
    const todo = todos.find((item) => item.id === id);
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

  const renderStatusBar = (item: Todo) => {
    const isDeferOpen = pendingChange?.id === item.id && pendingChange.status === "deferred";
    const isResetConfirm = confirmReset === item.id;
    return (
      <div className="space-y-2">
        {isResetConfirm && (
          <div className="bg-muted border border-border rounded-lg p-3 space-y-2">
            <p className="text-xs text-foreground font-medium">
              {t("report.todo.confirmResetMsg")}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="destructive"
                className="h-7 text-xs"
                onClick={() => confirmResetTodo(item)}
              >
                {t("report.todo.confirm")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => setConfirmReset(null)}
              >
                {t("common.cancel")}
              </Button>
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-1.5">
          {STATUS_OPTIONS.map((s) => {
            const isActive = item.dbStatus === s.value;
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
                onClick={() => handleStatusClick(item, s.value)}
              >
                <Icon className="h-3 w-3" /> {s.label}
              </Button>
            );
          })}
        </div>
        {isDeferOpen && pendingChange && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-amber-900">{t("report.todo.deferTo")}</label>
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
                {t("report.todo.reason")} <span className="font-normal text-amber-700">({t("common.optional").toLowerCase()})</span>
              </label>
              <Input
                placeholder={t("report.todo.deferReasonPlaceholder")}
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
                onClick={() => confirmChange(item)}
              >
                {t("report.todo.confirmDefer")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8"
                onClick={() => setPendingChange(null)}
              >
                {t("common.cancel")}
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderFollowUp = (item: Todo, warnIfMissing = false) => {
    if (editingFollowUp === item.id) {
      return (
        <div className="flex gap-2">
          <Input
            autoFocus
            placeholder={t("report.todo.followUpPlaceholder")}
            value={followUpDraft}
            onChange={(e) => setFollowUpDraft(e.target.value)}
            className="text-sm h-8"
            onKeyDown={(e) => { if (e.key === "Enter") saveFollowUp(item.id); }}
          />
          <Button size="sm" className="h-8" onClick={() => saveFollowUp(item.id)}>OK</Button>
        </div>
      );
    }
    return (
      <button
        onClick={() => { setEditingFollowUp(item.id); setFollowUpDraft(item.followUp || ""); }}
        className={`w-full text-left text-xs flex items-start gap-1.5 px-2 py-1.5 rounded transition-colors ${
          item.followUp
            ? "text-foreground bg-muted/50 hover:bg-muted"
            : warnIfMissing
              ? "text-amber-700 bg-amber-50 hover:bg-amber-100 italic"
              : "text-muted-foreground bg-muted/30 hover:bg-muted italic"
        }`}
      >
        <MessageSquare className="h-3 w-3 mt-0.5 shrink-0" />
        <span className="flex-1">
          {item.followUp || (warnIfMissing ? t("report.todo.addFollowUpWarn") : t("report.todo.addFollowUp"))}
        </span>
      </button>
    );
  };

  const renderCard = (item: Todo, opts?: { overdue?: boolean }) => (
    <div key={item.id} className="bg-card border border-border rounded-xl p-4 shadow-sm space-y-3">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-foreground">{item.title}</span>
            {item.source && sourceStyles[item.source] && (
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${sourceStyles[item.source].classes}`}>
                {sourceStyles[item.source].label}
              </span>
            )}
            {opts?.overdue && item.overdueDays && (
              <span className="text-xs font-medium text-destructive">
                {t("report.todo.overdueLabel", { days: item.overdueDays })}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
            <span>{item.responsible || "—"}</span>
            <span>{item.deadline}</span>
            {item._raw.deferred_count > 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-amber-100 text-amber-800">
                ↩ {item._raw.deferred_count}×
              </span>
            )}
          </div>
        </div>
        <span className="text-sm shrink-0">{priorityIcons[item.priority]}</span>
      </div>
      {renderStatusBar(item)}
    </div>
  );

  // suppress unused warning — skipChange is kept for potential external callers
  void skipChange;
  void PLACEHOLDERS;

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">To-do</h2>
          <p className="text-sm text-muted-foreground">{t("report.todo.subtitle")}</p>
        </div>
        <Dialog open={newOpen} onOpenChange={setNewOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> {t("report.todo.add")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("report.todo.newActionTitle")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              <Input placeholder={t("report.todo.titlePlaceholder")} value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
              <Input placeholder={t("report.todo.responsiblePlaceholder")} value={newResponsible} onChange={(e) => setNewResponsible(e.target.value)} />
              <Select value={newDeadline} onValueChange={setNewDeadline}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="next_meeting">{t("report.todo.nextMeeting")}</SelectItem>
                  <SelectItem value="custom">{t("report.todo.customDate")}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={newPriority} onValueChange={setNewPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">{t("report.todo.priority.critical")}</SelectItem>
                  <SelectItem value="high">{t("report.todo.priority.high")}</SelectItem>
                  <SelectItem value="normal">{t("report.todo.priority.normal")}</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleCreate} className="w-full">{t("report.todo.createAction")}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* 1. En retard */}
      {overdue.length > 0 && (
        <div className="rounded-xl p-4 mb-4 border-l-4 border-l-destructive" style={{ backgroundColor: "#FFF5F5" }}>
          <h3 className="text-sm font-bold text-destructive flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4" />
            {overdue.length} action{overdue.length > 1 ? "s" : ""} {t("report.todo.overdueSuffix")}
          </h3>
          <div className="space-y-2">
            {overdue.map((item) => renderCard(item, { overdue: true }))}
          </div>
        </div>
      )}

      {/* 2. Actions actives */}
      <div className="space-y-2 mb-4">
        {active.map((item) => renderCard(item))}
      </div>

      {/* 3. Faites ce cycle */}
      {doneCurrent.length > 0 && (
        <div className="rounded-xl p-4 mb-4 border border-emerald-200 bg-emerald-50/50">
          <h3 className="text-sm font-bold text-emerald-900 flex items-center gap-2 mb-3">
            <CheckCircle2 className="h-4 w-4" />
            {t("report.todo.doneThisCycle")}
            <span className="font-normal text-emerald-700 ml-1">
              — {doneCurrent.length} action{doneCurrent.length > 1 ? "s" : ""}
            </span>
          </h3>
          <div className="space-y-2">
            {doneCurrent.map((item) => (
              <div key={item.id} className="bg-white/60 border border-emerald-100 rounded-lg p-3 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span className="text-sm line-through text-muted-foreground flex-1">{item.title}</span>
                <span className="text-xs text-muted-foreground">{item.responsible || "—"}</span>
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
              {t("report.todo.inheritedTitle")}
              <span className="font-normal text-blue-700">
                {inherited[0].originCycle ? `— ${inherited[0].originCycle} · ` : "— "}
                {inheritedPending.length} {t("report.todo.status.inProgress").toLowerCase()}, {inheritedDoneCount} terminée{inheritedDoneCount > 1 ? "s" : ""}
              </span>
            </h3>
            {inheritedMissingFollowUp > 0 && (
              <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                {inheritedMissingFollowUp} commentaire{inheritedMissingFollowUp > 1 ? "s" : ""} de suivi manquant{inheritedMissingFollowUp > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <p className="text-xs text-blue-800/80 mb-3 italic">
            {t("report.todo.inheritedHint")}
          </p>
          <div className="space-y-2">
            {inherited.map((item) => (
              <div key={item.id} className="bg-card border border-blue-100 rounded-lg p-3 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
                    <span className={`text-sm font-medium ${item.dbStatus === "done" ? "line-through text-muted-foreground" : "text-foreground"}`}>
                      {item.title}
                    </span>
                    <span className="text-xs text-muted-foreground">{item.responsible}</span>
                    <span className="text-xs text-muted-foreground">· {item.deadline}</span>
                    {item.overdueDays && item.dbStatus !== "done" && (
                      <span className="text-xs font-medium text-destructive">
                        {t("report.todo.overdueLabel", { days: item.overdueDays })}
                      </span>
                    )}
                  </div>
                </div>
                {renderStatusBar(item)}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
