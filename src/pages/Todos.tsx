import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardList, Loader2, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useReports } from "@/hooks/useReports";
import {
  useTodos,
  useUpdateTodoStatus,
  useDeferTodo,
  parseTodoDescription,
  priorityDbToUi,
  sourceDbToUi,
  type DbTodo,
} from "@/hooks/useTodos";

const TODOS_KEY = "all";

type TabKey = "open" | "done" | "all";

const sourceStyles: Record<string, { label: string; classes: string }> = {
  ids: { label: "IDS", classes: "bg-violet-100 text-violet-800" },
  ia: { label: "IA", classes: "bg-accent text-accent-foreground" },
};

const priorityIcons: Record<string, string> = {
  critical: "🔴",
  high: "🟠",
  normal: "🔵",
};

function daysDelta(due: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(due);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

function DueBadge({ due }: { due: string | null }) {
  if (!due) return null;
  const delta = daysDelta(due);
  if (delta < 0) {
    return (
      <Badge className="bg-red-500/10 text-red-600 hover:bg-red-500/10 border-0">
        +{Math.abs(delta)}j de retard
      </Badge>
    );
  }
  if (delta <= 3) {
    return (
      <Badge className="bg-amber-500/10 text-amber-600 hover:bg-amber-500/10 border-0">
        {delta === 0 ? "Aujourd'hui" : `Dans ${delta}j`}
      </Badge>
    );
  }
  return null;
}

interface TodoRowProps {
  todo: DbTodo;
  cycleLabel?: string;
  done?: boolean;
}

function TodoRow({ todo, cycleLabel, done }: TodoRowProps) {
  const { toast } = useToast();
  const meta = parseTodoDescription(todo.description);
  const updateStatus = useUpdateTodoStatus(TODOS_KEY);
  const deferMutation = useDeferTodo();
  const [showDefer, setShowDefer] = useState(false);
  const [deferDate, setDeferDate] = useState("");
  const [deferReason, setDeferReason] = useState("");

  const source = sourceDbToUi(todo.source);
  const priority = priorityDbToUi(todo.priority);
  const isInProgress = todo.status === "in_progress";
  const isDeferred = todo.status === "deferred";
  const pending = updateStatus.isPending || deferMutation.isPending;

  const handleDone = async () => {
    try {
      await updateStatus.mutateAsync({ id: todo.id, status: "done" });
      toast({ title: "Action terminée ✓" });
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    }
  };

  const handleInProgress = async () => {
    try {
      await updateStatus.mutateAsync({ id: todo.id, status: "in_progress" });
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    }
  };

  const handleDefer = async () => {
    if (!deferDate) {
      toast({ title: "Date requise", description: "Choisissez une nouvelle échéance.", variant: "destructive" });
      return;
    }
    try {
      await deferMutation.mutateAsync({
        id: todo.id,
        reason: deferReason.trim(),
        newDueDate: deferDate,
        currentTodo: todo,
        currentDescription: todo.description,
      });
      toast({ title: "Action reportée" });
      setShowDefer(false);
      setDeferDate("");
      setDeferReason("");
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl shadow-sm p-4 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm shrink-0">{priorityIcons[priority]}</span>
            <h3 className="font-medium text-foreground text-sm">{todo.title}</h3>
            {!done && <DueBadge due={todo.due_date} />}
            {done && (
              <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/10 border-0">
                Terminé
              </Badge>
            )}
            {isInProgress && !done && (
              <Badge className="bg-blue-100 text-blue-700 border-0 hover:bg-blue-100">
                En cours
              </Badge>
            )}
            {isDeferred && !done && (
              <Badge className="bg-amber-100 text-amber-700 border-0 hover:bg-amber-100">
                Reporté
              </Badge>
            )}
            {source && sourceStyles[source] && (
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${sourceStyles[source].classes}`}>
                {sourceStyles[source].label}
              </span>
            )}
            {todo.deferred_count > 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-amber-100 text-amber-800">
                ↩ {todo.deferred_count}×
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
            {meta.responsible && <span>{meta.responsible}</span>}
            {cycleLabel && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-muted">
                {cycleLabel}
              </span>
            )}
          </div>
          {meta.followUp && (isDeferred || done) && (
            <p className="mt-1 text-xs text-muted-foreground italic">"{meta.followUp}"</p>
          )}
        </div>

        {!done && (
          <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
            <Button
              size="sm"
              className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
              onClick={handleDone}
              disabled={pending}
            >
              {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />} Fait
            </Button>
            {!isInProgress && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs border-blue-300 text-blue-700 hover:bg-blue-50 gap-1"
                onClick={handleInProgress}
                disabled={pending}
              >
                <Play className="h-3 w-3" /> En cours
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs border-amber-300 text-amber-700 hover:bg-amber-50 gap-1"
              onClick={() => setShowDefer((s) => !s)}
              disabled={pending}
            >
              <RotateCcw className="h-3 w-3" /> Reporter
            </Button>
          </div>
        )}
      </div>

      {showDefer && !done && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-amber-900">Reporter au *</label>
            <Input
              autoFocus
              type="date"
              value={deferDate}
              onChange={(e) => setDeferDate(e.target.value)}
              className="h-8 text-sm bg-white"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-amber-900">
              Raison <span className="font-normal text-amber-700">(optionnel)</span>
            </label>
            <Input
              placeholder="Pourquoi ce report…"
              value={deferReason}
              onChange={(e) => setDeferReason(e.target.value)}
              className="h-8 text-sm bg-white"
            />
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              className="h-8 bg-amber-600 hover:bg-amber-700 text-white"
              disabled={!deferDate || pending}
              onClick={handleDefer}
            >
              Confirmer le report
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              onClick={() => { setShowDefer(false); setDeferDate(""); setDeferReason(""); }}
            >
              Annuler
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Todos() {
  const { spaId } = useAuth();
  const [tab, setTab] = useState<TabKey>("open");
  const { data: todos = [], isLoading } = useTodos(TODOS_KEY, spaId);
  const { data: reportRows = [] } = useReports();

  const cycleLabelByReportId = useMemo(() => {
    const m = new Map<string, string>();
    reportRows.forEach((r) => m.set(r.id, r.cycle_label));
    return m;
  }, [reportRows]);

  const openTodos = todos.filter((t) => t.status !== "done" && t.status !== "deferred");
  const deferredTodos = todos.filter((t) => t.status === "deferred");
  const doneTodos = todos.filter((t) => t.status === "done");

  const visible = tab === "open" ? openTodos : tab === "done" ? doneTodos : todos;

  const overdueOpen = openTodos.filter((t) => t.due_date && daysDelta(t.due_date) < 0);
  const normalOpen = openTodos.filter((t) => !t.due_date || daysDelta(t.due_date) >= 0);

  const tabs: { key: TabKey; label: string }[] = [
    { key: "open", label: "À traiter" },
    { key: "done", label: "Terminées" },
    { key: "all", label: "Toutes" },
  ];

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground">Actions</h1>
          <Badge className="bg-primary/10 text-primary hover:bg-primary/10 border-0">
            {openTodos.length} à traiter
          </Badge>
        </div>
      </div>

      <div className="flex items-center gap-1 mb-4 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Chargement…
        </div>
      ) : tab === "open" ? (
        <div className="space-y-4">
          {overdueOpen.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <span className="text-sm font-semibold text-destructive">
                  {overdueOpen.length} en retard
                </span>
              </div>
              <div className="space-y-3">
                {overdueOpen.map((todo) => (
                  <TodoRow
                    key={todo.id}
                    todo={todo}
                    cycleLabel={todo.report_id ? cycleLabelByReportId.get(todo.report_id) : undefined}
                    done={false}
                  />
                ))}
              </div>
            </div>
          )}

          {normalOpen.length > 0 && (
            <div>
              {overdueOpen.length > 0 && (
                <span className="text-sm font-semibold text-foreground block mb-2">À traiter</span>
              )}
              <div className="space-y-3">
                {normalOpen.map((todo) => (
                  <TodoRow
                    key={todo.id}
                    todo={todo}
                    cycleLabel={todo.report_id ? cycleLabelByReportId.get(todo.report_id) : undefined}
                    done={false}
                  />
                ))}
              </div>
            </div>
          )}

          {deferredTodos.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <RotateCcw className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-semibold text-amber-700">
                  {deferredTodos.length} reportée{deferredTodos.length > 1 ? "s" : ""}
                </span>
              </div>
              <div className="space-y-3">
                {deferredTodos.map((todo) => (
                  <TodoRow
                    key={todo.id}
                    todo={todo}
                    cycleLabel={todo.report_id ? cycleLabelByReportId.get(todo.report_id) : undefined}
                    done={false}
                  />
                ))}
              </div>
            </div>
          )}

          {openTodos.length === 0 && deferredTodos.length === 0 && (
            <div className="bg-card border border-dashed border-border rounded-xl p-10 text-center">
              <ClipboardList className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-foreground font-medium">Aucune action à traiter</p>
            </div>
          )}
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-xl p-10 text-center">
          <CheckCircle2 className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-foreground font-medium">
            {tab === "done" ? "Aucune action terminée" : "Aucune action"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((todo) => (
            <TodoRow
              key={todo.id}
              todo={todo}
              cycleLabel={todo.report_id ? cycleLabelByReportId.get(todo.report_id) : undefined}
              done={todo.status === "done"}
            />
          ))}
        </div>
      )}
    </>
  );
}
