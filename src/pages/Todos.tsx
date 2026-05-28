import { useMemo, useState } from "react";
import { CheckCircle2, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useReports } from "@/hooks/useReports";
import {
  useTodos,
  useUpdateTodoStatus,
  useUpdateFollowUp,
  parseTodoDescription,
  type DbTodo,
} from "@/hooks/useTodos";

const TODOS_KEY = "all";

type TabKey = "open" | "done" | "all";

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
  const updateFollowUp = useUpdateFollowUp(TODOS_KEY);
  const [showPostpone, setShowPostpone] = useState(false);
  const [note, setNote] = useState("");

  const handleDone = async () => {
    try {
      await updateStatus.mutateAsync({ id: todo.id, status: "done" });
      toast({ title: "Action terminée ✓" });
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    }
  };

  const handlePostpone = async () => {
    if (!note.trim()) {
      toast({ title: "Note requise", description: "Indiquez pourquoi reporter.", variant: "destructive" });
      return;
    }
    try {
      await updateFollowUp.mutateAsync({
        id: todo.id,
        followUp: note.trim(),
        currentDescription: todo.description,
      });
      await updateStatus.mutateAsync({ id: todo.id, status: "deferred" });
      toast({ title: "Action reportée" });
      setShowPostpone(false);
      setNote("");
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    }
  };

  const pending = updateStatus.isPending || updateFollowUp.isPending;

  return (
    <div className="bg-card border border-border rounded-xl shadow-sm p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-medium text-foreground">{todo.title}</h3>
            {!done && <DueBadge due={todo.due_date} />}
            {done && (
              <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/10 border-0">
                Terminé
              </Badge>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2 flex-wrap text-sm text-muted-foreground">
            {meta.responsible && <span>Responsable : {meta.responsible}</span>}
            {cycleLabel && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-muted text-xs">
                {cycleLabel}
              </span>
            )}
          </div>
          {meta.followUp && done === false && todo.status === "deferred" && (
            <p className="mt-2 text-xs text-muted-foreground italic">Note : {meta.followUp}</p>
          )}
        </div>

        {!done && (
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              onClick={handleDone}
              disabled={pending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "✓ Fait"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowPostpone((s) => !s)}
              disabled={pending}
            >
              → Reporter
            </Button>
          </div>
        )}
      </div>

      {showPostpone && !done && (
        <div className="mt-3 flex items-center gap-2">
          <Input
            placeholder="Note de report (raison, nouvelle échéance...)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="flex-1"
            autoFocus
          />
          <Button size="sm" onClick={handlePostpone} disabled={pending}>
            Confirmer
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setShowPostpone(false);
              setNote("");
            }}
          >
            Annuler
          </Button>
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

  const openTodos = todos.filter((t) => t.status !== "done");
  const doneTodos = todos.filter((t) => t.status === "done");

  const visible = tab === "open" ? openTodos : tab === "done" ? doneTodos : todos;

  const tabs: { key: TabKey; label: string }[] = [
    { key: "open", label: "En cours" },
    { key: "done", label: "Terminées" },
    { key: "all", label: "Toutes" },
  ];

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground">Actions</h1>
          <Badge className="bg-primary/10 text-primary hover:bg-primary/10 border-0">
            {openTodos.length} en cours
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
      ) : visible.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-xl p-10 text-center">
          <CheckCircle2 className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-foreground font-medium">
            {tab === "done" ? "Aucune action terminée" : "Aucune action en cours"}
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
