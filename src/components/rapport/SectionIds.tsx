import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lightbulb, Plus, Check, AlertCircle, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import type { SectionStatus } from "@/pages/RapportDetail";
import {
  useIdsItems,
  useAddIdsItem,
  useIdsItemsForMonthlyPeriod,
  useUpdateIdsTriage,
  useConvertIdsToTodo,
  useConvertIdsToObjective,
  TRIAGE_CONFIG,
  type DbIdsItem,
  type TriageMode,
} from "@/hooks/useIdsItems";

interface Props {
  reportId: string;
  reportType: "monthly" | "weekly";
  periodStart?: string;
  periodEnd?: string;
  onStatusChange?: (status: SectionStatus) => void;
}

const TRIAGE_SORT_ORDER: Record<string, number> = {
  bloquant: 0,
  deleguer: 1,
  priorite: 2,
  veille: 3,
};

export function SectionIds({ reportId, reportType, periodStart, periodEnd, onStatusChange }: Props) {
  const { t } = useTranslation();
  const { spaId } = useAuth();
  const { data: rawIssues = [], isLoading: isLoadingWeekly } = useIdsItems(reportId);
  const { data: monthlyPreviewItems, isLoading: isLoadingPreview } = useIdsItemsForMonthlyPeriod(
    reportType === "monthly" ? spaId ?? undefined : undefined,
    periodStart,
    periodEnd,
  );
  const addItem = useAddIdsItem(reportId, reportType);
  const updateTriage = useUpdateIdsTriage(reportId);
  const convertToTodo = useConvertIdsToTodo(reportId);
  const convertToObjective = useConvertIdsToObjective(reportId);

  const [newIssue, setNewIssue] = useState("");
  const [triagingItem, setTriagingItem] = useState<DbIdsItem | null>(null);
  const [triageStep, setTriageStep] = useState<"select" | "confirm">("select");
  const [selectedMode, setSelectedMode] = useState<TriageMode | null>(null);

  useEffect(() => {
    if (reportType === "weekly" && !isLoadingWeekly) {
      onStatusChange?.("complete");
    }
  }, [reportType, isLoadingWeekly, onStatusChange]);

  const issues = [...rawIssues].sort((a, b) => {
    const oa = a.triage_mode ? (TRIAGE_SORT_ORDER[a.triage_mode] ?? 4) : 5;
    const ob = b.triage_mode ? (TRIAGE_SORT_ORDER[b.triage_mode] ?? 4) : 5;
    return oa - ob || a.display_order - b.display_order;
  });

  const sortedMonthlyItems = [...(monthlyPreviewItems ?? [])].sort((a, b) => {
    const oa = a.triage_mode ? (TRIAGE_SORT_ORDER[a.triage_mode] ?? 4) : 5;
    const ob = b.triage_mode ? (TRIAGE_SORT_ORDER[b.triage_mode] ?? 4) : 5;
    return oa - ob;
  });

  const addIssue = () => {
    const text = newIssue.trim();
    if (!text) return;
    addItem.mutate(text, {
      onSuccess: (newItem) => {
        setTriagingItem(newItem);
        setTriageStep("select");
        setSelectedMode(null);
      },
    });
    setNewIssue("");
  };

  const handleTriageSelect = (mode: TriageMode) => {
    if (!triagingItem) return;
    setSelectedMode(mode);
    updateTriage.mutate({ id: triagingItem.id, triage_mode: mode });
    if (mode !== "veille") {
      setTriageStep("confirm");
    } else {
      setTriagingItem(null);
    }
  };

  const handleConversion = () => {
    if (!triagingItem || !selectedMode) return;
    if (selectedMode === "bloquant" || selectedMode === "deleguer") {
      convertToTodo.mutate(triagingItem);
    } else if (selectedMode === "priorite") {
      convertToObjective.mutate(triagingItem);
    }
    setTriagingItem(null);
  };

  const closeTriage = () => {
    setTriagingItem(null);
    setTriageStep("select");
    setSelectedMode(null);
  };

  const TriagePopup = () => (
    <Dialog open={!!triagingItem} onOpenChange={(open) => !open && closeTriage()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">
            {t("report.ids.triage.dialogTitle")}
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("report.ids.triage.dialogSubtitle")}
          </p>
        </DialogHeader>

        {triageStep === "select" && (
          <div className="space-y-2 mt-2">
            {(Object.keys(TRIAGE_CONFIG) as TriageMode[]).map((mode) => {
              const cfg = TRIAGE_CONFIG[mode];
              return (
                <button
                  key={mode}
                  onClick={() => handleTriageSelect(mode)}
                  className={`w-full text-left p-3 rounded-xl border-2 transition-all hover:border-current hover:shadow-sm ${cfg.color} ${cfg.borderColor}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base">{cfg.icon}</span>
                    <span className={`text-sm font-bold ${cfg.textColor}`}>{cfg.label}</span>
                  </div>
                  <p className={`text-xs font-medium ${cfg.textColor} mb-1.5 italic`}>
                    "{cfg.sentence}"
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {cfg.examples.map((ex, i) => (
                      <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded-full bg-white/60 ${cfg.textColor}`}>
                        · {ex}
                      </span>
                    ))}
                  </div>
                </button>
              );
            })}

            <button
              onClick={closeTriage}
              className="w-full text-center text-xs text-muted-foreground py-2 hover:underline"
            >
              {t("report.ids.triage.later")}
            </button>
          </div>
        )}

        {triageStep === "confirm" && selectedMode && (
          <div className="mt-2 space-y-4">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${TRIAGE_CONFIG[selectedMode].color}`}>
              <span>{TRIAGE_CONFIG[selectedMode].icon}</span>
              <span className={`text-sm font-semibold ${TRIAGE_CONFIG[selectedMode].textColor}`}>
                {t("report.ids.triage.marked", { label: TRIAGE_CONFIG[selectedMode].label })}
              </span>
            </div>

            <div className="border border-border rounded-xl p-4">
              <p className="text-sm font-medium text-foreground mb-3">
                {TRIAGE_CONFIG[selectedMode].conversionHint}
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1 bg-teal-600 hover:bg-teal-700 text-white text-xs"
                  onClick={handleConversion}
                  disabled={convertToTodo.isPending || convertToObjective.isPending}
                >
                  {t("report.ids.triage.confirmYes")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 text-xs"
                  onClick={closeTriage}
                >
                  {t("report.ids.triage.confirmLater")}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );

  const renderIssueRow = (item: DbIdsItem) => {
    const cfg = item.triage_mode ? TRIAGE_CONFIG[item.triage_mode] : null;
    const hasTodo = item.converted_to_todo_id !== null;
    const hasObj = item.converted_to_objective_id !== null;
    const isConverted = hasTodo || hasObj;

    return (
      <div key={item.id} className="bg-card border border-border rounded-xl p-3 shadow-sm">
        <div className="flex items-start gap-3">
          <Lightbulb className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
              <button
                onClick={() => {
                  setTriagingItem(item);
                  setTriageStep("select");
                  setSelectedMode(null);
                }}
                className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border cursor-pointer hover:opacity-80 transition-opacity ${
                  cfg
                    ? `${cfg.color} ${cfg.textColor} ${cfg.borderColor}`
                    : "bg-gray-100 text-gray-500 border-gray-300 border-dashed"
                }`}
                title={cfg ? t("report.ids.triage.requalify") : t("report.ids.triage.qualify")}
              >
                {cfg ? `${cfg.icon} ${cfg.label}` : `❓ ${t("report.ids.triage.toSort")}`}
              </button>

              {hasTodo && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                  <Check className="h-3 w-3" /> {t("report.ids.todoDone")}
                </span>
              )}
              {hasObj && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                  <Check className="h-3 w-3" /> {t("report.ids.objectiveDone")}
                </span>
              )}
            </div>

            <p className="text-sm text-foreground">{item.capture_text}</p>

            {!isConverted && cfg && item.triage_mode !== "veille" && (
              <div className="mt-2">
                {(item.triage_mode === "bloquant" || item.triage_mode === "deleguer") && (
                  <button
                    onClick={() => convertToTodo.mutate(item)}
                    className="text-[10px] text-teal-700 underline hover:no-underline"
                  >
                    {t("report.ids.createTodo")}
                  </button>
                )}
                {item.triage_mode === "priorite" && (
                  <button
                    onClick={() => convertToObjective.mutate(item)}
                    className="text-[10px] text-teal-700 underline hover:no-underline"
                  >
                    {t("report.ids.createObjective")}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (reportType === "monthly") {
    return (
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-foreground">{t("report.ids.monthlyTitle")}</h2>
        <p className="text-sm text-muted-foreground mb-4">
          {t("report.ids.monthlySubtitle")}
        </p>

        {isLoadingPreview ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : sortedMonthlyItems.length === 0 ? (
          <div className="bg-muted/50 border border-border rounded-xl p-8 text-center">
            <Lightbulb className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-foreground font-medium">{t("report.ids.monthlyEmpty")}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {t("report.ids.monthlyEmptyHint")}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {sortedMonthlyItems.map((item) => {
              const isUnresolved =
                item.converted_to_todo_id === null && item.converted_to_objective_id === null;
              return (
                <div key={item.id}>
                  <div className="flex items-center gap-2 mb-1 ml-7">
                    <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                      {item.report_cycle_label}
                    </span>
                    {isUnresolved && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                        <AlertCircle className="h-3 w-3" /> {t("report.ids.toProcess")}
                      </span>
                    )}
                  </div>
                  {renderIssueRow(item)}
                </div>
              );
            })}
          </div>
        )}

        <TriagePopup />
      </section>
    );
  }

  // Weekly
  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold text-foreground">{t("report.ids.weeklyTitle")}</h2>
      <p className="text-sm text-muted-foreground mb-4">
        {t("report.ids.weeklySubtitle")}
      </p>

      <div className="space-y-2 mb-4">{issues.map(renderIssueRow)}</div>

      <div className="flex gap-2">
        <Input
          placeholder={t("report.ids.placeholder")}
          maxLength={150}
          value={newIssue}
          onChange={(e) => setNewIssue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addIssue()}
          className="flex-1"
        />
        <Button size="sm" onClick={addIssue} className="gap-1.5">
          <Plus className="h-4 w-4" /> {t("report.ids.signaler")}
        </Button>
      </div>

      <TriagePopup />
    </section>
  );
}
