import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { spas, type SpaOverview } from "@/data/directionMockData";

const statusStyles: Record<string, { labelKey: string; classes: string }> = {
  draft_preparation: { labelKey: "status.draft_preparation", classes: "bg-muted text-muted-foreground" },
  in_meeting: { labelKey: "status.in_meeting", classes: "bg-violet-100 text-violet-800" },
  validated: { labelKey: "status.validated", classes: "bg-emerald-100 text-emerald-800" },
};

const borderColor = (spa: SpaOverview) => {
  if (spa.alerts.some((a) => a.level === "red")) return "border-l-destructive";
  if (spa.alerts.some((a) => a.level === "orange")) return "border-l-amber-500";
  return "border-l-emerald-500";
};

const kpiColor = (val: string) => {
  if (val === "—") return "text-muted-foreground";
  return "text-foreground";
};

function AlertBanner() {
  const { t } = useTranslation();
  const totalAlerts = spas.reduce((sum, s) => sum + s.alerts.length, 0);
  const spasWithAlerts = spas.filter((s) => s.alerts.length > 0).length;
  if (totalAlerts === 0) return null;

  return (
    <div className="border border-destructive/30 bg-destructive/5 rounded-xl p-4 mb-6 flex items-center gap-3">
      <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
      <span className="text-sm font-medium text-destructive">
        {t("direction.alertBanner", { count: totalAlerts, spas: spasWithAlerts })}
      </span>
    </div>
  );
}

function SpaCard({ spa }: { spa: SpaOverview }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const ss = statusStyles[spa.status];

  return (
    <Card className={`border-l-4 ${borderColor(spa)} shadow-sm`}>
      <div className="p-5">
        {/* Top row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-foreground">{spa.name}</h3>
            <p className="text-sm text-muted-foreground">{t("direction.manager")}: {spa.manager}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full ${ss.classes}`}>
              {t(ss.labelKey)}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="gap-1 text-primary border-primary/30 hover:bg-primary/5"
              onClick={() => navigate(`/direction/spa/${spa.id}`)}
            >
              {t("direction.viewDetail")} <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Alerts */}
        {spa.alerts.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {spa.alerts.slice(0, 2).map((alert, i) => (
              <Badge
                key={i}
                variant="outline"
                className={`text-xs font-medium ${
                  alert.level === "red"
                    ? "border-destructive/40 bg-destructive/5 text-destructive"
                    : "border-amber-400/40 bg-amber-50 text-amber-800"
                }`}
              >
                {alert.level === "red" ? "🔴" : "🟠"} {alert.text}
              </Badge>
            ))}
            {spa.alerts.length > 2 && (
              <span className="text-xs text-muted-foreground self-center">
                +{spa.alerts.length - 2} {t("direction.otherAlerts")}
              </span>
            )}
          </div>
        )}

        {/* KPI summary */}
        <div className="grid grid-cols-3 gap-3 mb-3">
          {[
            { label: "CA", value: spa.kpis.ca },
            { label: "NPS", value: spa.kpis.nps },
            { label: t("direction.kpiResp"), value: spa.kpis.responsabilites },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-muted/50 rounded-lg p-2.5 text-center">
              <p className={`text-sm font-semibold ${kpiColor(kpi.value)}`}>{kpi.value}</p>
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
            </div>
          ))}
        </div>

        {/* Bottom row */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{t("direction.lastReport")}: {spa.lastReport}</span>
          <span>{spa.progress}</span>
        </div>
      </div>
    </Card>
  );
}

export default function DirectionOverview() {
  const { t } = useTranslation();

  const sorted = [...spas].sort((a, b) => {
    const severity = (s: SpaOverview) => {
      if (s.alerts.some((al) => al.level === "red")) return 0;
      if (s.alerts.some((al) => al.level === "orange")) return 1;
      return 2;
    };
    return severity(a) - severity(b);
  });

  return (
    <div className="max-w-[900px] mx-auto px-6 py-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("direction.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("direction.subtitle", { count: spas.length })}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          🔵 Monthly — {t("period.march2026")}
        </span>
      </div>

      <AlertBanner />

      {/* Spa cards */}
      <div className="space-y-4">
        {sorted.map((spa) => (
          <SpaCard key={spa.id} spa={spa} />
        ))}
      </div>
    </div>
  );
}
