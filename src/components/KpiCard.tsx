import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { ChevronDown, ChevronUp } from "lucide-react";

// --- Types ---

export type KpiStatus = "none" | "green" | "amber" | "red" | "excellent";

export interface KpiData {
  id: string;
  label: string;
  unit: string;
  target: number;
  n1: number;
  category: "spa" | "manager";
  /** History values for sparkline (most recent last) */
  history?: number[];
}

export interface KpiCardValue {
  value: string;
  comment: string;
  isNa: boolean;
  naReason: string;
}

export function getKpiStatus(value: string, target: number): KpiStatus {
  if (!value || isNaN(Number(value))) return "none";
  const v = Number(value);
  if (v >= target) return "green";
  if (v >= target * 0.85) return "amber";
  return "red";
}

const statusDotColors: Record<KpiStatus, string> = {
  none: "bg-muted-foreground/40",
  excellent: "bg-emerald-600",
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
};

const statusLabel: Partial<Record<KpiStatus, string>> = {
  excellent: "Excellent",
  green: "Bien",
  amber: "Correct",
  red: "Insuffisant",
};

const statusTextColors: Partial<Record<KpiStatus, string>> = {
  excellent: "text-emerald-600",
  green: "text-emerald-500",
  amber: "text-amber-600",
  red: "text-red-500",
};

// --- Sparkline ---

function Sparkline({ data, className = "" }: { data: number[]; className?: string }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const h = 32;
  const w = 80;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  });
  return (
    <svg width={w} height={h} className={className} viewBox={`0 0 ${w} ${h}`}>
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {data.map((v, i) => {
        const x = (i / (data.length - 1)) * w;
        const y = h - ((v - min) / range) * (h - 4) - 2;
        return <circle key={i} cx={x} cy={y} r="2" fill="hsl(var(--primary))" />;
      })}
    </svg>
  );
}

// ============================================
// MODE SAISIE (rapport manager)
// ============================================

interface SaisieProps {
  kpi: KpiData;
  cardValue: KpiCardValue;
  onChange: (value: KpiCardValue) => void;
}

export function KpiCardSaisie({ kpi, cardValue, onChange }: SaisieProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const status = cardValue.isNa ? "none" : getKpiStatus(cardValue.value, kpi.target);
  const showComment = !cardValue.isNa && cardValue.value && status !== "none";
  const isRequired = status === "amber" || status === "red";

  const ecart =
    cardValue.value && !isNaN(Number(cardValue.value))
      ? (((Number(cardValue.value) - kpi.target) / kpi.target) * 100).toFixed(1)
      : null;

  const commentPlaceholder =
    status === "excellent"
      ? "Partager les facteurs de succès"
      : status === "green"
        ? t("kpi.comment.placeholder.green")
        : status === "amber"
          ? t("kpi.comment.placeholder.amber")
          : status === "red"
            ? t("kpi.comment.placeholder.red")
            : "";

  const commentBorder =
    isRequired && !cardValue.comment?.trim()
      ? status === "red"
        ? "border-destructive"
        : "border-amber-500"
      : "";

  return (
    <div className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground text-sm">{kpi.label}</span>
          <span className="text-muted-foreground text-xs">{kpi.unit}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`text-xs font-medium ${statusTextColors[status] ?? "text-muted-foreground"}`}>
            {status !== "none" && statusLabel[status]}
          </span>
          <div className={`w-3 h-3 rounded-full shrink-0 ${statusDotColors[status]}`} />
        </div>
      </div>

      {/* N-1 */}
      <p className="text-xs text-muted-foreground italic mb-3">
        {t("kpi.previousCycle")} :{" "}
        <span className="font-medium">
          {kpi.n1.toLocaleString("fr-FR")}
          {kpi.unit}
        </span>
      </p>

      {/* NA checkbox */}
      <div className="flex items-center gap-2 mb-3">
        <Checkbox
          id={`na-${kpi.id}`}
          checked={cardValue.isNa}
          onCheckedChange={(checked) => onChange({ ...cardValue, isNa: checked === true })}
        />
        <label htmlFor={`na-${kpi.id}`} className="text-xs text-muted-foreground cursor-pointer">
          {t("kpi.notAvailable")}
        </label>
      </div>

      {cardValue.isNa ? (
        <Input
          placeholder={t("kpi.naReason")}
          maxLength={80}
          value={cardValue.naReason}
          onChange={(e) => onChange({ ...cardValue, naReason: e.target.value })}
          className="text-sm"
        />
      ) : (
        <>
          {/* Input */}
          <div className="flex items-center gap-3 mb-1">
            <div className="relative flex-1">
              <Input
                type="number"
                className="text-right pr-10"
                placeholder="—"
                value={cardValue.value}
                onChange={(e) => onChange({ ...cardValue, value: e.target.value })}
              />
              {kpi.unit && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                  {kpi.unit}
                </span>
              )}
            </div>
          </div>

          {/* Target + écart */}
          <div className="flex items-center justify-between text-xs text-muted-foreground mt-1 mb-2">
            <span>
              {t("kpi.target")} : {kpi.target.toLocaleString("fr-FR")}
              {kpi.unit}
            </span>
            {ecart && (
              <span className={`font-medium ${Number(ecart) >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                {Number(ecart) >= 0 ? "+" : ""}
                {ecart}%
              </span>
            )}
          </div>

          {/* Comment */}
          {showComment && (
            <div className="mt-auto">
              {isRequired && (
                <label className="text-xs font-medium text-foreground mb-1 block">
                  {t("kpi.commentRequired")} <span className="text-destructive">*</span>
                </label>
              )}
              <Textarea
                className={`text-sm min-h-[60px] ${commentBorder}`}
                placeholder={commentPlaceholder}
                maxLength={200}
                value={cardValue.comment}
                onChange={(e) => onChange({ ...cardValue, comment: e.target.value })}
              />
              <div className="text-xs text-muted-foreground text-right mt-0.5">
                {cardValue.comment.length}/200
              </div>
            </div>
          )}

          {/* Sparkline expand */}
          {kpi.history && kpi.history.length >= 2 && (
            <div className="mt-2 border-t border-border pt-2">
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {t("kpi.sparklineLabel")}
              </button>
              {expanded && (
                <div className="mt-2 flex justify-center">
                  <Sparkline data={kpi.history} />
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ============================================
// MODE SAISIE WEEKLY (simplified)
// ============================================

function getWeeklyKpiStatus(value: number, target: number, n1: number): KpiStatus {
  const ref = target > 0 ? target : n1;
  if (ref === 0) return "green";
  const ratio = value / ref;
  if (ratio >= 1) return "green";
  if (ratio >= 0.85) return "amber";
  return "red";
}


function getTrendArrow(value: number, n1: number): { arrow: string; color: string } {
  if (n1 === 0) return { arrow: "→", color: "text-muted-foreground" };
  const change = ((value - n1) / n1) * 100;
  if (change > 2) return { arrow: "↑", color: "text-emerald-600" };
  if (change < -2) return { arrow: "↓", color: "text-destructive" };
  return { arrow: "→", color: "text-muted-foreground" };
}

interface WeeklySaisieProps {
  kpi: KpiData;
  cardValue: KpiCardValue;
  onChange: (value: KpiCardValue) => void;
}

export function KpiCardSaisieWeekly({ kpi, cardValue, onChange }: WeeklySaisieProps) {
  const { t } = useTranslation();

  const numValue = cardValue.value ? Number(cardValue.value) : null;
  const status = cardValue.isNa ? "none" : (numValue !== null && !isNaN(numValue) ? getWeeklyKpiStatus(numValue, kpi.target, kpi.n1) : "none");
  const trend = numValue !== null && !isNaN(numValue) ? getTrendArrow(numValue, kpi.n1) : null;
  const showComment = !cardValue.isNa && (status === "red" || status === "amber");


  return (
    <div className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground text-sm">{kpi.label}</span>
          <span className="text-muted-foreground text-xs">{kpi.unit}</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-xs px-1.5 py-0.5 rounded ${
              kpi.category === "spa" ? "bg-blue-50 text-blue-700" : "bg-violet-50 text-violet-700"
            }`}
          >
            {kpi.category === "spa" ? "Spa" : "Manager"}
          </span>
          <div className="flex items-center gap-1">
            <span className={`text-xs font-medium ${statusTextColors[status] ?? "text-muted-foreground"}`}>
              {status !== "none" && statusLabel[status]}
            </span>
            <div className={`w-3 h-3 rounded-full shrink-0 ${statusDotColors[status]}`} />
            {trend && (
              <span className={`text-sm font-bold ${trend.color}`}>{trend.arrow}</span>
            )}
          </div>
        </div>
      </div>

      {/* N-1 (last week) */}
      {/* Reference: weekly target (primary) + N-1 (secondary) */}
      {kpi.target > 0 ? (
        <p className="text-xs text-muted-foreground italic mb-1">
          Objectif semaine :{" "}
          <span className="font-medium">
            {kpi.target.toLocaleString("fr-FR")}{kpi.unit}
          </span>
        </p>
      ) : (
        <p className="text-xs text-muted-foreground italic mb-1">
          Semaine précédente :{" "}
          <span className="font-medium">
            {kpi.n1.toLocaleString("fr-FR")}{kpi.unit}
          </span>
        </p>
      )}
      {kpi.target > 0 && kpi.n1 !== 0 && (
        <p className="text-[11px] text-muted-foreground/70 italic mb-3">
          Semaine précédente : {kpi.n1.toLocaleString("fr-FR")}{kpi.unit}
        </p>
      )}
      {(kpi.target === 0 || kpi.n1 === 0) && <div className="mb-2" />}

      {/* NA checkbox */}
      <div className="flex items-center gap-2 mb-3">
        <Checkbox
          id={`na-w-${kpi.id}`}
          checked={cardValue.isNa}
          onCheckedChange={(checked) => onChange({ ...cardValue, isNa: checked === true })}
        />
        <label htmlFor={`na-w-${kpi.id}`} className="text-xs text-muted-foreground cursor-pointer">
          {t("kpi.notAvailable")}
        </label>
      </div>

      {cardValue.isNa ? (
        <Input
          placeholder={t("kpi.naReason")}
          maxLength={80}
          value={cardValue.naReason}
          onChange={(e) => onChange({ ...cardValue, naReason: e.target.value })}
          className="text-sm"
        />
      ) : (
        <>
          {/* Input */}
          <div className="flex items-center gap-3 mb-1">
            <div className="relative flex-1">
              <Input
                type="number"
                className="text-right pr-10"
                placeholder="—"
                value={cardValue.value}
                onChange={(e) => onChange({ ...cardValue, value: e.target.value })}
              />
              {kpi.unit && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                  {kpi.unit}
                </span>
              )}
            </div>
          </div>

          {/* Comment (only for RED) */}
          {showComment && (
            <div className="mt-3">
              <label className="text-xs font-medium text-foreground mb-1 block">
                Commentaire requis <span className="text-destructive">*</span>
              </label>
              <Textarea
                className={`text-sm min-h-[60px] ${!cardValue.comment?.trim() ? "border-destructive" : ""}`}
                placeholder={status === "amber" ? "Objectif partiellement atteint — expliquer" : "Que s'est-il passé cette semaine ?"}

                maxLength={200}
                value={cardValue.comment}
                onChange={(e) => onChange({ ...cardValue, comment: e.target.value })}
              />
              <div className="text-xs text-muted-foreground text-right mt-0.5">
                {cardValue.comment.length}/200
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ============================================
// MODE LECTURE (vue direction)
// ============================================

interface LectureProps {
  kpi: {
    label: string;
    unit: string;
    value: number;
    target: number;
    status: "green" | "amber" | "red" | "excellent";
    comment: string;
  };
}

export function KpiCardLecture({ kpi }: LectureProps) {
  const { t } = useTranslation();
  const ecart = (((kpi.value - kpi.target) / kpi.target) * 100).toFixed(1);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm cursor-default">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">{kpi.label}</span>
            <div className={`w-2.5 h-2.5 rounded-full ${statusDotColors[kpi.status]}`} />
          </div>
          <p className="text-xl font-bold text-foreground">
            {kpi.value.toLocaleString("fr-FR")}
            <span className="text-sm font-normal text-muted-foreground">{kpi.unit}</span>
          </p>
          <p className={`text-xs font-medium mt-0.5 ${statusTextColors[kpi.status] ?? ""}`}>
            {statusLabel[kpi.status] ?? ""}
          </p>
          <p
            className={`text-xs font-medium mt-0.5 ${
              Number(ecart) >= 0 ? "text-emerald-600" : "text-destructive"
            }`}
          >
            {Number(ecart) >= 0 ? "+" : ""}
            {ecart}% {t("kpi.vsTarget")}
          </p>
        </div>
      </TooltipTrigger>
      {kpi.comment && <TooltipContent className="max-w-[250px]">{kpi.comment}</TooltipContent>}
    </Tooltip>
  );
}

// ============================================
// MODE COMPACT (dashboard)
// ============================================

interface CompactProps {
  label: string;
  value: number | string;
  unit: string;
  status: KpiStatus;
}

export function KpiCardCompact({ label, value, unit, status }: CompactProps) {
  return (
    <div className="bg-card border border-border rounded-xl px-4 py-3 shadow-sm flex items-center justify-between">
      <span className="text-sm text-foreground font-medium truncate">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold text-foreground">
          {typeof value === "number" ? value.toLocaleString("fr-FR") : value}
          <span className="text-xs font-normal text-muted-foreground ml-0.5">{unit}</span>
        </span>
        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusDotColors[status]}`} />
      </div>
    </div>
  );
}
