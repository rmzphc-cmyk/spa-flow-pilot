import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { VoiceRecordButton } from "@/components/VoiceRecordButton";
import {
  useResponsabilityTemplates,
  useResponsabilityLogs,
  useUpsertResponsabilityLog,
  useWeeklyPrefillBatch,
  calcMonthlyExpected,
  getLocalizedRespTitle,
} from "@/hooks/useResponsabilites";
import type { SectionStatus } from "@/pages/RapportDetail";

interface Props {
  reportId: string;
  periodStart: string;
  spaReportingCycleType?: string;
  isLocked?: boolean;
  onStatusChange: (status: SectionStatus) => void;
}

type LocalEntry = {
  completion_rate: number | null;
  actual_count: string;
  comment: string;
  prefillApplied: boolean;
};
type LocalState = Record<string, LocalEntry>;

function scoreColor(score: number | null): string {
  if (score === null) return "text-muted-foreground";
  if (score >= 80) return "text-emerald-600";
  if (score >= 50) return "text-amber-600";
  return "text-red-600";
}

export function SectionResponsabilites({
  reportId,
  periodStart,
  spaReportingCycleType,
  isLocked = false,
  onStatusChange,
}: Props) {
  const { t, i18n } = useTranslation();
  const speechLang =
    i18n.language === "es" ? "es-ES" : i18n.language === "en" ? "en-US" : "fr-FR";
  const { spaId } = useAuth();
  const { data: templates = [] } = useResponsabilityTemplates(spaId);
  const { data: logs } = useResponsabilityLogs(reportId);
  const upsertMutation = useUpsertResponsabilityLog();
  const { debouncedUpsert, mutate: upsertNow } = upsertMutation;

  const BUTTON_STATES: { value: 100 | 50 | 0; label: string; cls: string }[] = [
    { value: 100, label: t("report.responsabilites.button.done"), cls: "bg-emerald-100 text-emerald-800 border-emerald-300" },
    { value: 50, label: t("report.responsabilites.button.partial"), cls: "bg-amber-100 text-amber-800 border-amber-300" },
    { value: 0, label: t("report.responsabilites.button.notDone"), cls: "bg-red-100 text-red-800 border-red-300" },
  ];

  const FREQ_BADGE: Record<string, { label: string; cls: string }> = {
    daily: { label: t("report.responsabilites.freq.daily"), cls: "bg-purple-100 text-purple-700" },
    weekly: { label: t("report.responsabilites.freq.weekly"), cls: "bg-blue-100 text-blue-700" },
    biweekly: { label: t("report.responsabilites.freq.biweekly"), cls: "bg-cyan-100 text-cyan-700" },
    monthly: { label: t("report.responsabilites.freq.monthly"), cls: "bg-slate-100 text-slate-600" },
  };

  function numericPlaceholder(score: number | null): string {
    if (score === null || score < 50) return t("report.responsabilites.placeholder.blocked");
    if (score >= 100) return t("report.responsabilites.placeholder.optional");
    return t("report.responsabilites.placeholder.missing");
  }

  function buttonPlaceholder(score: number | null): string {
    if (score === null || score === 0) return t("report.responsabilites.placeholder.blocked");
    if (score === 50) return t("report.responsabilites.placeholder.whatDone");
    return t("report.responsabilites.placeholder.optional");
  }

  const dailyWeeklyTemplateIds = useMemo(
    () =>
      templates
        .filter((t) => t.frequency === "daily" || t.frequency === "weekly")
        .map((t) => t.id),
    [templates],
  );

  const prefillEnabled = spaReportingCycleType !== "monthly";
  const prefillData = useWeeklyPrefillBatch(
    prefillEnabled ? spaId : null,
    prefillEnabled ? dailyWeeklyTemplateIds : [],
    prefillEnabled ? periodStart : null,
  );

  const [local, setLocal] = useState<LocalState>({});
  const [hydratedFor, setHydratedFor] = useState<string | null>(null);

  useEffect(() => {
    if (!logs || hydratedFor === reportId) return;
    const next: LocalState = {};
    for (const tmpl of templates) {
      const log = logs[tmpl.id];
      next[tmpl.id] = {
        completion_rate: log?.completion_rate ?? null,
        actual_count:
          log?.actual_count !== null && log?.actual_count !== undefined
            ? String(log.actual_count)
            : "",
        comment: log?.comment ?? "",
        prefillApplied: false,
      };
    }
    setLocal(next);
    setHydratedFor(reportId);
  }, [logs, reportId, hydratedFor, templates]);

  useEffect(() => {
    if (!logs || !prefillEnabled || templates.length === 0) return;
    for (const tmpl of templates) {
      if (tmpl.frequency !== "daily" && tmpl.frequency !== "weekly") continue;
      const entry = local[tmpl.id];
      const pf = prefillData[tmpl.id];
      if (!pf || pf.prefillValue <= 0) continue;
      if (entry?.prefillApplied) continue;
      const dbActual = logs[tmpl.id]?.actual_count;
      const localEmpty = !entry || entry.actual_count === "";
      if (!(localEmpty || dbActual == null)) continue;

      const monthlyExpected = calcMonthlyExpected(tmpl.frequency, tmpl.expected_count);
      const cr =
        monthlyExpected > 0
          ? Math.min(100, Math.round((pf.prefillValue / monthlyExpected) * 100))
          : 0;
      upsertNow({
        report_id: reportId,
        responsibility_template_id: tmpl.id,
        completion_rate: cr,
        actual_count: pf.prefillValue,
        comment: entry?.comment || null,
      });
      setLocal((prev) => ({
        ...prev,
        [tmpl.id]: {
          completion_rate: cr,
          actual_count: String(pf.prefillValue),
          comment: prev[tmpl.id]?.comment ?? "",
          prefillApplied: true,
        },
      }));
    }
  }, [prefillData, templates, local, logs, prefillEnabled, reportId, upsertNow]);

  useEffect(() => {
    const buttonCards = templates.filter(
      (tmpl) => tmpl.frequency === "monthly" && tmpl.expected_count === 1,
    );
    if (buttonCards.length === 0) {
      onStatusChange("complete");
      return;
    }
    const allSet = buttonCards.every((tmpl) => {
      const e = local[tmpl.id];
      return e && e.completion_rate !== null && e.completion_rate !== undefined;
    });
    onStatusChange(allSet ? "complete" : "incomplete");
  }, [templates, local, onStatusChange]);

  const updateButtonState = (templateId: string, completion_rate: number) => {
    setLocal((p) => {
      const prev = p[templateId] ?? {
        completion_rate: null,
        actual_count: "",
        comment: "",
        prefillApplied: false,
      };
      const next = { ...p, [templateId]: { ...prev, completion_rate } };
      debouncedUpsert({
        report_id: reportId,
        responsibility_template_id: templateId,
        completion_rate,
        actual_count: null,
        comment: next[templateId].comment || null,
      });
      return next;
    });
  };

  const updateNumericActual = (templateId: string, value: string, monthlyExpected: number) => {
    setLocal((p) => {
      const prev = p[templateId] ?? {
        completion_rate: null,
        actual_count: "",
        comment: "",
        prefillApplied: false,
      };
      const next = { ...p, [templateId]: { ...prev, actual_count: value } };
      const parsed = parseInt(value, 10);
      if (!isNaN(parsed)) {
        const cr =
          monthlyExpected > 0
            ? Math.min(100, Math.round((parsed / monthlyExpected) * 100))
            : 0;
        next[templateId].completion_rate = cr;
        debouncedUpsert({
          report_id: reportId,
          responsibility_template_id: templateId,
          completion_rate: cr,
          actual_count: parsed,
          comment: next[templateId].comment || null,
        });
      }
      return next;
    });
  };

  const updateComment = (
    templateId: string,
    comment: string,
    mode: "buttons" | "numeric",
    monthlyExpected: number,
  ) => {
    setLocal((p) => {
      const prev = p[templateId] ?? {
        completion_rate: null,
        actual_count: "",
        comment: "",
        prefillApplied: false,
      };
      const next = { ...p, [templateId]: { ...prev, comment } };
      if (mode === "buttons") {
        if (prev.completion_rate !== null && prev.completion_rate !== undefined) {
          debouncedUpsert({
            report_id: reportId,
            responsibility_template_id: templateId,
            completion_rate: prev.completion_rate,
            actual_count: null,
            comment: comment || null,
          });
        }
      } else {
        const parsed = parseInt(prev.actual_count, 10);
        if (!isNaN(parsed)) {
          const cr =
            monthlyExpected > 0
              ? Math.min(100, Math.round((parsed / monthlyExpected) * 100))
              : 0;
          debouncedUpsert({
            report_id: reportId,
            responsibility_template_id: templateId,
            completion_rate: cr,
            actual_count: parsed,
            comment: comment || null,
          });
        }
      }
      return next;
    });
  };

  const { avg, evaluated, total } = useMemo(() => {
    const rates: number[] = [];
    for (const tmpl of templates) {
      const entry = local[tmpl.id];
      if (!entry) continue;
      if (tmpl.frequency === "monthly" && tmpl.expected_count === 1) {
        if (entry.completion_rate !== null && entry.completion_rate !== undefined) {
          rates.push(entry.completion_rate);
        }
      } else {
        const parsed = parseInt(entry.actual_count, 10);
        if (!isNaN(parsed)) {
          const m = calcMonthlyExpected(tmpl.frequency, tmpl.expected_count);
          rates.push(m > 0 ? Math.min(100, Math.round((parsed / m) * 100)) : 0);
        }
      }
    }
    return {
      avg: rates.length > 0 ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : null,
      evaluated: rates.length,
      total: templates.length,
    };
  }, [templates, local]);

  const avgBarCls =
    avg === null
      ? "bg-border"
      : avg >= 80
        ? "bg-emerald-500"
        : avg >= 50
          ? "bg-amber-500"
          : "bg-red-500";

  return (
    <section className="mb-8 px-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-semibold text-foreground">{t("report.responsabilites.title")}</h2>
        {isLocked && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
            <Lock className="h-3 w-3" /> {t("report.responsabilites.lockedBadge")}
          </span>
        )}
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        {t("report.responsabilites.subtitleMonthly")}
      </p>

      <div className="bg-card border border-border rounded-xl p-4 shadow-sm mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className={`text-2xl font-bold ${scoreColor(avg)}`}>
            {avg === null ? "—%" : `${avg}%`}
          </span>
          <span className="text-xs text-muted-foreground">
            {t("report.responsabilites.scoreCounter", {
              evaluated,
              total,
              s: total > 1 ? "s" : "",
              es: evaluated > 1 ? "s" : "",
            })}
          </span>
        </div>
        <div className="h-2 bg-border rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${avgBarCls}`}
            style={{ width: `${avg ?? 0}%` }}
          />
        </div>
      </div>

      <div className="space-y-3">
        {templates.length === 0 && (
          <div className="bg-card border border-border rounded-xl p-4 shadow-sm text-sm text-muted-foreground">
            {t("report.responsabilites.empty")}
          </div>
        )}
        {templates.map((tmpl) => {
          const entry =
            local[tmpl.id] ?? {
              completion_rate: null,
              actual_count: "",
              comment: "",
              prefillApplied: false,
            };
          const isButtonMode = tmpl.frequency === "monthly" && tmpl.expected_count === 1;
          const monthlyExpected = calcMonthlyExpected(tmpl.frequency, tmpl.expected_count);
          const badge = FREQ_BADGE[tmpl.frequency] ?? FREQ_BADGE.monthly;

          const parsed = parseInt(entry.actual_count, 10);
          const liveScore = isButtonMode
            ? entry.completion_rate
            : isNaN(parsed)
              ? null
              : monthlyExpected > 0
                ? Math.min(100, Math.round((parsed / monthlyExpected) * 100))
                : 0;

          const pf = prefillData[tmpl.id];
          const showPrefillIndicator =
            !isLocked &&
            prefillEnabled &&
            (tmpl.frequency === "daily" || tmpl.frequency === "weekly");
          const userModifiedPrefill =
            entry.prefillApplied && pf && String(pf.prefillValue) !== entry.actual_count;

          return (
            <div key={tmpl.id} className="bg-card border border-border rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-foreground text-sm">{getLocalizedRespTitle(tmpl, i18n.language)}</span>
                <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${badge.cls}`}>
                  {badge.label}
                </span>
                {!isButtonMode && (
                  <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-teal-50 text-teal-700">
                    {t("report.responsabilites.perMonth", { n: monthlyExpected })}
                  </span>
                )}
                {tmpl.category && (
                  <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    {tmpl.category}
                  </span>
                )}
              </div>
              {tmpl.description && (
                <p className="text-xs text-muted-foreground mt-1">{tmpl.description}</p>
              )}

              {isButtonMode ? (
                <div className="mt-3 flex gap-1 flex-wrap">
                  {BUTTON_STATES.map((s) => (
                    <button
                      key={s.value}
                      disabled={isLocked}
                      onClick={() => updateButtonState(tmpl.id, s.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        entry.completion_rate === s.value
                          ? s.cls
                          : "bg-card text-muted-foreground border-border hover:bg-muted"
                      } ${isLocked ? "opacity-60 cursor-not-allowed" : ""}`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              ) : (
                <>
                  <div className="mt-3 flex items-center gap-3 flex-wrap">
                    <span className="text-sm text-foreground">{t("report.responsabilites.realized")}</span>
                    <Input
                      type="number"
                      min={0}
                      value={entry.actual_count}
                      disabled={isLocked}
                      onChange={(e) => updateNumericActual(tmpl.id, e.target.value, monthlyExpected)}
                      className="w-20 text-center"
                    />
                    <span className="text-sm text-muted-foreground">
                      {t("report.responsabilites.expectedMonth", { count: monthlyExpected })}
                    </span>
                    <span className={`text-sm font-semibold ml-auto ${scoreColor(liveScore)}`}>
                      {liveScore === null ? "—%" : `${liveScore}%`}
                    </span>
                  </div>

                  {showPrefillIndicator && (() => {
                    if (!pf || !pf.hasWeeklyReports) {
                      if (entry.actual_count !== "") return null;
                      return (
                        <p className="mt-2 text-xs text-muted-foreground">
                          {t("report.responsabilites.noPrefill")}
                        </p>
                      );
                    }
                    const isFull = pf.weeklyReportsWithData === pf.totalWeeklyReports;
                    const cls = isFull ? "text-emerald-600" : "text-amber-600";
                    const key = isFull ? "report.responsabilites.prefillOk" : "report.responsabilites.prefillWarn";
                    return (
                      <p className={`mt-2 text-xs ${cls}`}>
                        {t(key, { with: pf.weeklyReportsWithData, total: pf.totalWeeklyReports })}
                        {userModifiedPrefill && (
                          <span className="text-muted-foreground"> · {t("report.responsabilites.prefillModified")}</span>
                        )}
                      </p>
                    );
                  })()}
                </>
              )}

              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-2">
                  <VoiceRecordButton
                    context="responsibility_comment"
                    lang={speechLang}
                    disabled={isLocked}
                    onTranscript={(transcript) =>
                      updateComment(
                        tmpl.id,
                        (entry.comment ? entry.comment + " " + transcript : transcript).slice(0, 500),
                        isButtonMode ? "buttons" : "numeric",
                        monthlyExpected,
                      )
                    }
                  />
                </div>
                <Textarea
                  className="text-sm min-h-[40px]"
                  placeholder={
                    isButtonMode
                      ? buttonPlaceholder(entry.completion_rate)
                      : numericPlaceholder(liveScore)
                  }
                  value={entry.comment}
                  readOnly={isLocked}
                  onChange={(e) =>
                    updateComment(
                      tmpl.id,
                      e.target.value,
                      isButtonMode ? "buttons" : "numeric",
                      monthlyExpected,
                    )
                  }
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
