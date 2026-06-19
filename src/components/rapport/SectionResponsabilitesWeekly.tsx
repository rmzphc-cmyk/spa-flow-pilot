import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CoachHint } from "@/components/coaching/CoachHint";
import { Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { VoiceRecordButton } from "@/components/VoiceRecordButton";
import {
  useResponsabilityTemplates,
  useResponsabilityLogs,
  useUpsertResponsabilityLog,
  calcWeeklyExpected,
} from "@/hooks/useResponsabilites";
import type { SectionStatus } from "@/pages/RapportDetail";

interface Props {
  reportId: string;
  isLocked?: boolean;
  onStatusChange: (status: SectionStatus) => void;
}

type LocalEntry = { actual_count: string; comment: string };
type LocalState = Record<string, LocalEntry>;

function scoreColor(score: number | null): string {
  if (score === null) return "text-muted-foreground";
  if (score >= 80) return "text-emerald-600";
  if (score >= 50) return "text-amber-600";
  return "text-red-600";
}

export function SectionResponsabilitesWeekly({ reportId, isLocked = false, onStatusChange }: Props) {
  const { t, i18n } = useTranslation();
  const speechLang =
    i18n.language === "es" ? "es-ES" : i18n.language === "en" ? "en-US" : "fr-FR";
  const { spaId } = useAuth();
  const { data: templates = [] } = useResponsabilityTemplates(spaId);
  const { data: logs } = useResponsabilityLogs(reportId);
  const { debouncedUpsert } = useUpsertResponsabilityLog();

  const FREQ_BADGE: Record<string, { label: string; cls: string; unit: string }> = {
    daily: { label: t("report.responsabilites.freq.daily"), cls: "bg-purple-100 text-purple-700", unit: t("report.responsabilites.freq.unitDay") },
    weekly: { label: t("report.responsabilites.freq.weekly"), cls: "bg-blue-100 text-blue-700", unit: t("report.responsabilites.freq.unitWeek") },
  };

  function placeholderFor(score: number | null): string {
    if (score === null || score >= 100) return t("report.responsabilites.placeholder.optional");
    if (score >= 50) return t("report.responsabilites.placeholder.missing");
    return t("report.responsabilites.placeholder.blocked");
  }

  const weeklyTemplates = useMemo(
    () => templates.filter((t) => t.frequency === "daily" || t.frequency === "weekly"),
    [templates],
  );

  const [local, setLocal] = useState<LocalState>({});
  const [hydratedFor, setHydratedFor] = useState<string | null>(null);

  useEffect(() => {
    onStatusChange("complete");
  }, [onStatusChange]);

  useEffect(() => {
    if (!logs || hydratedFor === reportId) return;
    const next: LocalState = {};
    for (const [tid, v] of Object.entries(logs)) {
      next[tid] = {
        actual_count: v.actual_count !== null && v.actual_count !== undefined ? String(v.actual_count) : "",
        comment: v.comment ?? "",
      };
    }
    setLocal(next);
    setHydratedFor(reportId);
  }, [logs, reportId, hydratedFor]);

  const computeScore = (actualStr: string, weeklyExpected: number): number | null => {
    if (actualStr === "") return null;
    const parsed = parseInt(actualStr, 10);
    if (isNaN(parsed)) return null;
    if (weeklyExpected <= 0) return 0;
    return Math.min(100, Math.round((parsed / weeklyExpected) * 100));
  };

  const saveEntry = (templateId: string, entry: LocalEntry, weeklyExpected: number) => {
    const parsed = parseInt(entry.actual_count, 10);
    if (isNaN(parsed)) return;
    const completion_rate =
      weeklyExpected > 0 ? Math.min(100, Math.round((parsed / weeklyExpected) * 100)) : 0;
    debouncedUpsert({
      report_id: reportId,
      responsibility_template_id: templateId,
      completion_rate,
      actual_count: parsed,
      comment: entry.comment || null,
    });
  };

  const updateActual = (templateId: string, value: string, weeklyExpected: number) => {
    setLocal((p) => {
      const prev = p[templateId] ?? { actual_count: "", comment: "" };
      const next = { ...p, [templateId]: { ...prev, actual_count: value } };
      saveEntry(templateId, next[templateId], weeklyExpected);
      return next;
    });
  };

  const updateComment = (templateId: string, comment: string, weeklyExpected: number) => {
    setLocal((p) => {
      const prev = p[templateId] ?? { actual_count: "", comment: "" };
      const next = { ...p, [templateId]: { ...prev, comment } };
      saveEntry(templateId, next[templateId], weeklyExpected);
      return next;
    });
  };

  const { avg, evaluated, total } = useMemo(() => {
    let sum = 0;
    let count = 0;
    for (const tmpl of weeklyTemplates) {
      const entry = local[tmpl.id];
      if (!entry) continue;
      const weeklyExpected = calcWeeklyExpected(tmpl.frequency, tmpl.expected_count);
      const score = computeScore(entry.actual_count, weeklyExpected);
      if (score !== null) {
        sum += score;
        count += 1;
      }
    }
    return {
      avg: count > 0 ? Math.round(sum / count) : null,
      evaluated: count,
      total: weeklyTemplates.length,
    };
  }, [weeklyTemplates, local]);

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
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-lg font-semibold text-foreground">{t("report.responsabilites.titleWeekly")}</h2>
          <CoachHint surfaceKey="report.responsabilites.titleWeekly" />
        </div>
        {isLocked && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
            <Lock className="h-3 w-3" /> {t("report.responsabilites.lockedBadge")}
          </span>
        )}
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        {t("report.responsabilites.subtitleWeekly")}
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

      {weeklyTemplates.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm text-sm text-muted-foreground">
          {t("report.responsabilites.emptyWeekly")}
        </div>
      ) : (
        <div className="space-y-3">
          {weeklyTemplates.map((tmpl) => {
            const entry = local[tmpl.id] ?? { actual_count: "", comment: "" };
            const weeklyExpected = calcWeeklyExpected(tmpl.frequency, tmpl.expected_count);
            const score = computeScore(entry.actual_count, weeklyExpected);
            const badge = FREQ_BADGE[tmpl.frequency] ?? FREQ_BADGE.weekly;

            return (
              <div key={tmpl.id} className="bg-card border border-border rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-foreground text-sm">{tmpl.title}</span>
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${badge.cls}`}>
                    {badge.label}
                  </span>
                  <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                    × {tmpl.expected_count}/{badge.unit}
                  </span>
                </div>
                {tmpl.description && (
                  <p className="text-xs text-muted-foreground mt-1">{tmpl.description}</p>
                )}

                <div className="mt-3 flex items-center gap-3 flex-wrap">
                  <span className="text-sm text-foreground">{t("report.responsabilites.realized")}</span>
                  <Input
                    type="number"
                    min={0}
                    value={entry.actual_count}
                    disabled={isLocked}
                    onChange={(e) => updateActual(tmpl.id, e.target.value, weeklyExpected)}
                    className="w-16 text-center"
                  />
                  <span className="text-sm text-muted-foreground">
                    {t("report.responsabilites.expectedWeek", { count: weeklyExpected })}
                  </span>
                  <span className={`text-sm font-semibold ml-auto ${scoreColor(score)}`}>
                    {score === null ? "—%" : `${score}%`}
                  </span>
                </div>

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
                          weeklyExpected,
                        )
                      }
                    />
                  </div>
                  <Textarea
                    className="text-sm min-h-[40px]"
                    placeholder={placeholderFor(score)}
                    value={entry.comment}
                    readOnly={isLocked}
                    onChange={(e) => updateComment(tmpl.id, e.target.value, weeklyExpected)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
