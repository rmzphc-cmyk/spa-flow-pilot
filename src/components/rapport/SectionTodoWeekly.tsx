import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, CalendarClock, Check, CheckCircle2, Play, RotateCcw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { friendlyError } from "@/lib/errorMessages";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  useTodos,
  useUpdateTodoStatusWithComment,
  useDeferTodo,
  parseTodoDescription,
  priorityDbToUi,
  sourceDbToUi,
  type DbTodo,
} from "@/hooks/useTodos";
import type { SectionStatus } from "@/pages/RapportDetail";

interface Props {
  reportId: string;
  periodStart: string;
  periodEnd: string;
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

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  } catch {
    return "—";
  }
}

function daysBetween(a: Date, b: Date) {
  const ms = a.getTime() - b.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export function SectionTodoWeekly({ reportId, periodStart, periodEnd, onStatusChange }: Props) {
  const { spaId } = useAuth();
  const { t } = useTranslation();
  const { data: dbTodos = [] } = useTodos(reportId, spaId);
  const updateMutation = useUpdateTodoStatusWithComment();
  const deferMutation = useDeferTodo();

  const [deferForm, setDeferForm] = useState<{
    id: string; reason: string; newDate: string; currentTodo: DbTodo;
  } | null>(null);
  const [enCoursForm, setEnCoursForm] = useState<{
    id: string; reason: string; newDate: string; currentTodo: DbTodo;
  } | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { onStatusChange("complete"); }, []);

  const { doneInWeek, activeInWeek, upcoming, deferred } = useMemo(() => {
    const weekStart = new Date(periodStart);
    const weekEnd = new Date(periodEnd);
    weekEnd.setHours(23, 59, 59, 999);
    const today = new Date();

    const inRange = (d: string | null) => {
      if (!d) return false;
      const dt = new Date(d);
      return dt >= weekStart && dt <= weekEnd;
    };
    const isActive = (item: DbTodo) => item.status !== "done" && item.status !== "deferred";

    const done = dbTodos.filter((item) => item.status === "done" && inRange(item.due_date));
    const active = dbTodos
      .filter((item) => isActive(item) && inRange(item.due_date))
      .sort((a, b) => {
        const aOver = a.due_date ? new Date(a.due_date) < today : false;
        const bOver = b.due_date ? new Date(b.due_date) < today : false;
        if (aOver && !bOver) return -1;
        if (!aOver && bOver) return 1;
        return (a.due_date ?? "").localeCompare(b.due_date ?? "");
      });
    // Actions actives dont l'échéance dépasse la semaine (ou sans date) : sinon
    // invisibles (ex. to-do issu d'un IDS avec deadline future).
    const up = dbTodos
      .filter(
        (item) =>
          isActive(item) && !inRange(item.due_date) && (!item.due_date || new Date(item.due_date) > weekEnd),
      )
      .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));
    const def = dbTodos.filter((item) => item.status === "deferred");
    return { doneInWeek: done, activeInWeek: active, upcoming: up, deferred: def };
  }, [dbTodos, periodStart, periodEnd]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const handleDeferSubmit = () => {
    if (!deferForm) return;
    deferMutation.mutate(
      {
        id: deferForm.id,
        reason: deferForm.reason,
        newDueDate: deferForm.newDate,
        currentTodo: deferForm.currentTodo,
        currentDescription: deferForm.currentTodo.description,
      },
      {
        onSuccess: () => {
          setDeferForm(null);
          toast({ title: t("report.todo.weekly.toastDeferred") });
        },
        onError: (e) =>
          toast({ title: t("common.error"), description: friendlyError(e), variant: "destructive" }),
      },
    );
  };

  const handleEnCoursOverdueSubmit = async (item: DbTodo) => {
    if (!enCoursForm) return;
    await updateMutation.mutateAsync({
      id: item.id,
      status: "in_progress",
      comment: enCoursForm.reason,
      currentDescription: item.description,
    });
    if (enCoursForm.newDate) {
      const { error } = await supabase
        .from("todos")
        .update({ due_date: enCoursForm.newDate, updated_at: new Date().toISOString() })
        .eq("id", item.id);
      if (error) {
        toast({ title: t("common.error"), description: friendlyError(error), variant: "destructive" });
      }
    }
    setEnCoursForm(null);
  };

  /* ─────────── BLOC 1 ─────────── */
  const renderBloc1 = () => (
    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <CheckCircle2 className="h-4 w-4 text-emerald-700" />
        <h3 className="text-sm font-semibold text-emerald-900">{t("report.todo.weekly.doneThisWeek")}</h3>
        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 ml-auto">
          {t("report.todo.weekly.actionCount", { count: doneInWeek.length })}
        </Badge>
      </div>
      {doneInWeek.length === 0 ? (
        <p className="text-xs text-emerald-800/70 italic">{t("report.todo.weekly.noDone")}</p>
      ) : (
        <div className="space-y-2">
          {doneInWeek.map((item) => {
            const source = sourceDbToUi(item.source);
            return (
              <div
                key={item.id}
                className="bg-white/60 border border-emerald-100 rounded-lg p-3 flex items-center gap-2"
              >
                <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                <span className="text-sm line-through text-muted-foreground">{item.title}</span>
                {source && sourceStyles[source] && (
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${sourceStyles[source].classes}`}>
                    {sourceStyles[source].label}
                  </span>
                )}
                <span className="text-xs text-muted-foreground ml-auto">{fmtDate(item.due_date)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  /* ─────────── BLOC 2 ─────────── */
  const renderActiveCard = (item: DbTodo) => {
    const isOverdue = item.due_date ? new Date(item.due_date) < today : false;
    const overdueDays = isOverdue && item.due_date ? daysBetween(today, new Date(item.due_date)) : 0;
    const source = sourceDbToUi(item.source);
    const priority = priorityDbToUi(item.priority);
    const isInProgress = item.status === "in_progress";
    const deferOpen = deferForm?.id === item.id;
    const enCoursOpen = enCoursForm?.id === item.id;

    return (
      <div
        key={item.id}
        className={`bg-card border rounded-xl p-4 shadow-sm space-y-3 ${
          isOverdue ? "border-l-4 border-l-destructive" : "border-border"
        }`}
      >
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-foreground">{item.title}</span>
              {source && sourceStyles[source] && (
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${sourceStyles[source].classes}`}>
                  {sourceStyles[source].label}
                </span>
              )}
              {item.deferred_count > 0 && (
                <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-amber-100 text-amber-800">
                  ↩ {item.deferred_count}×
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs mt-1 flex-wrap">
              <span className="text-muted-foreground">{fmtDate(item.due_date)}</span>
              {isOverdue && (
                <span className="text-destructive font-medium">
                  {t("report.todo.weekly.overdueFor", { count: overdueDays })}
                </span>
              )}
              {isInProgress && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[11px] font-medium">
                  <Play className="h-3 w-3" /> {t("report.todo.status.inProgress")}
                </span>
              )}
            </div>
          </div>
          <span className="text-sm shrink-0">{priorityIcons[priority]}</span>
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 h-8 text-xs gap-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
            onClick={() =>
              updateMutation.mutate({
                id: item.id,
                status: "done",
                comment: "Réalisé",
                currentDescription: item.description,
              })
            }
          >
            <CheckCircle2 className="h-3 w-3" /> {t("report.todo.status.done")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className={`flex-1 h-8 text-xs gap-1 ${
              isInProgress
                ? "bg-blue-50 border-blue-300 text-blue-700"
                : "border-blue-300 text-blue-700 hover:bg-blue-50"
            }`}
            onClick={() => {
              if (isOverdue) {
                setEnCoursForm({ id: item.id, reason: "", newDate: "", currentTodo: item });
              } else {
                updateMutation.mutate({
                  id: item.id,
                  status: "in_progress",
                  comment: "",
                  currentDescription: item.description,
                });
              }
            }}
          >
            <Play className="h-3 w-3" /> {t("report.todo.status.inProgress")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 h-8 text-xs gap-1 border-amber-300 text-amber-700 hover:bg-amber-50"
            onClick={() => setDeferForm({ id: item.id, reason: "", newDate: "", currentTodo: item })}
          >
            <RotateCcw className="h-3 w-3" /> {t("report.todo.status.deferred")}
          </Button>
        </div>

        {enCoursOpen && enCoursForm && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-blue-900">
                {t("report.todo.weekly.whyLate")}
              </label>
              <Input
                autoFocus
                value={enCoursForm.reason}
                onChange={(e) => setEnCoursForm({ ...enCoursForm, reason: e.target.value })}
                className="h-8 text-sm bg-white"
                placeholder={t("report.todo.weekly.justificationPlaceholder")}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-blue-900">{t("report.todo.weekly.newDeadline")}</label>
              <Input
                type="date"
                value={enCoursForm.newDate}
                onChange={(e) => setEnCoursForm({ ...enCoursForm, newDate: e.target.value })}
                className="h-8 text-sm bg-white"
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="h-8"
                disabled={!enCoursForm.reason.trim() || !enCoursForm.newDate}
                onClick={() => handleEnCoursOverdueSubmit(item)}
              >
                {t("report.todo.confirm")}
              </Button>
              <Button size="sm" variant="outline" className="h-8" onClick={() => setEnCoursForm(null)}>
                {t("common.cancel")}
              </Button>
            </div>
          </div>
        )}

        {deferOpen && deferForm && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-amber-900">{t("report.todo.deferReasonLabel")}</label>
              <Input
                autoFocus
                value={deferForm.reason}
                onChange={(e) => setDeferForm({ ...deferForm, reason: e.target.value })}
                className="h-8 text-sm bg-white"
                placeholder={t("report.todo.deferReasonPlaceholder")}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-amber-900">{t("report.todo.deferTo")}</label>
              <Input
                type="date"
                value={deferForm.newDate}
                onChange={(e) => setDeferForm({ ...deferForm, newDate: e.target.value })}
                className="h-8 text-sm bg-white"
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="h-8 bg-amber-600 hover:bg-amber-700 text-white"
                disabled={!deferForm.reason.trim() || !deferForm.newDate}
                onClick={handleDeferSubmit}
              >
                {t("report.todo.confirmDefer")}
              </Button>
              <Button size="sm" variant="outline" className="h-8" onClick={() => setDeferForm(null)}>
                {t("common.cancel")}
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderBloc2 = () => (
    <div className="bg-card border rounded-xl p-4 mt-4">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-sm font-semibold text-foreground">{t("report.todo.weekly.thisWeek")}</h3>
        <Badge variant="secondary" className="ml-auto">
          {t("report.todo.weekly.actionCount", { count: activeInWeek.length })} {t("report.todo.weekly.toProcess")}
        </Badge>
      </div>
      {activeInWeek.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">{t("report.todo.weekly.noActive")}</p>
      ) : (
        <div className="space-y-3">{activeInWeek.map(renderActiveCard)}</div>
      )}
    </div>
  );

  /* ─────────── BLOC « À VENIR » (échéance hors semaine) ─────────── */
  const renderBlocUpcoming = () => (
    <div className="bg-card border rounded-xl p-4 mt-4">
      <div className="flex items-center gap-2 mb-1">
        <CalendarClock className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">{t("report.todo.weekly.upcoming")}</h3>
        <Badge variant="secondary" className="ml-auto">
          {t("report.todo.weekly.actionCount", { count: upcoming.length })}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground mb-3">{t("report.todo.weekly.upcomingHint")}</p>
      <div className="space-y-3">{upcoming.map(renderActiveCard)}</div>
    </div>
  );

  /* ─────────── BLOC 3 ─────────── */
  const renderDeferredCard = (item: DbTodo) => {
    const meta = parseTodoDescription(item.description);
    const source = sourceDbToUi(item.source);
    const deferOpen = deferForm?.id === item.id;
    return (
      <div key={item.id} className="bg-white border border-amber-100 rounded-xl p-4 shadow-sm space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-foreground">{item.title}</span>
          {source && sourceStyles[source] && (
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${sourceStyles[source].classes}`}>
              {sourceStyles[source].label}
            </span>
          )}
          <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-amber-100 text-amber-800">
            ↩ {item.deferred_count}×
          </span>
        </div>
        <div className="text-xs text-muted-foreground space-y-0.5">
          {item.deferred_from_date && (
            <div>{t("report.todo.weekly.originallyScheduled", { date: fmtDate(item.deferred_from_date) })}</div>
          )}
          <div>{t("report.todo.weekly.deferredTo", { date: fmtDate(item.due_date) })}</div>
        </div>
        {meta.followUp && (
          <p className="text-xs italic text-amber-900 bg-amber-50/60 rounded px-2 py-1.5">
            "{meta.followUp}"
          </p>
        )}

        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 h-8 text-xs gap-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
            onClick={() =>
              updateMutation.mutate({
                id: item.id,
                status: "done",
                comment: "Réalisé",
                currentDescription: item.description,
              })
            }
          >
            <CheckCircle2 className="h-3 w-3" /> {t("report.todo.weekly.doneAfterAll")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 h-8 text-xs gap-1 border-blue-300 text-blue-700 hover:bg-blue-50"
            onClick={() =>
              updateMutation.mutate({
                id: item.id,
                status: "in_progress",
                comment: "",
                currentDescription: item.description,
              })
            }
          >
            <Play className="h-3 w-3" /> {t("report.todo.status.inProgress")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 h-8 text-xs gap-1 border-amber-300 text-amber-700 hover:bg-amber-50"
            onClick={() => setDeferForm({ id: item.id, reason: "", newDate: "", currentTodo: item })}
          >
            <RotateCcw className="h-3 w-3" /> {t("report.todo.weekly.deferAgain")}
          </Button>
        </div>

        {deferOpen && deferForm && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-amber-900">{t("report.todo.deferReasonLabel")}</label>
              <Input
                autoFocus
                value={deferForm.reason}
                onChange={(e) => setDeferForm({ ...deferForm, reason: e.target.value })}
                className="h-8 text-sm bg-white"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-amber-900">{t("report.todo.deferTo")}</label>
              <Input
                type="date"
                value={deferForm.newDate}
                onChange={(e) => setDeferForm({ ...deferForm, newDate: e.target.value })}
                className="h-8 text-sm bg-white"
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="h-8 bg-amber-600 hover:bg-amber-700 text-white"
                disabled={!deferForm.reason.trim() || !deferForm.newDate}
                onClick={handleDeferSubmit}
              >
                {t("report.todo.confirmDefer")}
              </Button>
              <Button size="sm" variant="outline" className="h-8" onClick={() => setDeferForm(null)}>
                {t("common.cancel")}
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderBloc3 = () => (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mt-4">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="h-4 w-4 text-amber-700" />
        <h3 className="text-sm font-semibold text-amber-900">{t("report.todo.weekly.deferredActions")}</h3>
        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 ml-auto">
          {t("report.todo.weekly.actionCount", { count: deferred.length })}
        </Badge>
      </div>
      <div className="space-y-3">{deferred.map(renderDeferredCard)}</div>
    </div>
  );

  return (
    <section className="mb-8 px-6 pt-4">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-foreground">{t("report.todo.weekly.title")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("report.todo.weekly.subtitle")}
        </p>
      </div>

      {renderBloc1()}
      {renderBloc2()}
      {upcoming.length > 0 && renderBlocUpcoming()}
      {deferred.length > 0 && renderBloc3()}

      <p className="mt-4 text-xs text-muted-foreground italic">
        {t("report.todo.weekly.statusHint")}
      </p>
      <div className="mt-2 rounded-lg bg-muted/50 px-4 py-3 text-xs text-muted-foreground">
        {t("report.todo.weekly.createHint")}
      </div>
    </section>
  );
}
