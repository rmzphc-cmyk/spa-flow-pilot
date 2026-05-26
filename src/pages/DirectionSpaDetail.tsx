import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronLeft, AlertTriangle, Check, RotateCw, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDirectionSpas, useDirectionSpaDetail } from "@/hooks/useDirectionData";
import { Skeleton } from "@/components/ui/skeleton";
import { AiBadge } from "@/components/AiBadge";

const statusStyles: Record<string, { labelKey: string; classes: string }> = {
  draft_preparation: { labelKey: "status.draft_preparation", classes: "bg-muted text-muted-foreground" },
  in_meeting: { labelKey: "status.in_meeting", classes: "bg-violet-100 text-violet-800" },
  validated: { labelKey: "status.validated", classes: "bg-emerald-100 text-emerald-800" },
};

const kpiStatusDot: Record<string, string> = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-destructive",
};

const ecartColor = (ecart: string) => {
  if (ecart.startsWith("+")) return "text-emerald-700";
  if (ecart === "0%") return "text-muted-foreground";
  return "text-destructive";
};

const respDot: Record<string, string> = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-destructive",
};

export default function DirectionSpaDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const detail = spaDetails[id ?? ""];
  if (!detail) {
    return (
      <div className="max-w-[900px] mx-auto px-6 py-12 text-center">
        <p className="text-foreground font-medium">{t("direction.spaNotFound")}</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/direction")}>
          {t("direction.backToAll")}
        </Button>
      </div>
    );
  }

  const ss = statusStyles[detail.currentReport.status];
  const lv = detail.lastValidated;

  return (
    <div className="max-w-[900px] mx-auto px-6 py-6 pb-20">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-muted-foreground mb-2 -ml-2"
            onClick={() => navigate("/direction")}
          >
            <ChevronLeft className="h-4 w-4" /> {t("direction.backToAll")}
          </Button>
          <h1 className="text-2xl font-bold text-foreground">{detail.name}</h1>
          <p className="text-sm text-muted-foreground">{detail.manager} · {detail.managerRole}</p>
        </div>

        {/* Spa switcher */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2">
              {detail.name} <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {spas.map((s) => (
              <DropdownMenuItem
                key={s.id}
                onClick={() => navigate(`/direction/spa/${s.id}`)}
                className={s.id === detail.id ? "bg-accent font-medium" : ""}
              >
                <span className={`inline-block h-2 w-2 rounded-full mr-2 ${
                  s.alerts.some((a) => a.level === "red") ? "bg-destructive" :
                  s.alerts.some((a) => a.level === "orange") ? "bg-amber-500" : "bg-emerald-500"
                }`} />
                {s.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Alert card */}
      {detail.alerts.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/5 mb-6">
          <div className="p-4 space-y-2">
            {detail.alerts.map((alert, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-destructive font-medium">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {alert.text}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Current report summary */}
      <Card className="mb-6">
        <div className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">{detail.currentReport.label}</span>
              <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${ss.classes}`}>
                {t(ss.labelKey)}
              </span>
            </div>
            <span className="text-sm text-muted-foreground">{detail.currentReport.progress}</span>
          </div>
          <Progress value={(detail.currentReport.progressNum / detail.currentReport.progressDen) * 100} className="h-2" />
          <p className="text-xs text-muted-foreground mt-2 italic">
            {t("direction.notSubmittedNote")}
          </p>
        </div>
      </Card>

      {/* Last validated report */}
      <div className="mb-4">
        <h2 className="text-lg font-bold text-foreground">
          {t("direction.lastValidatedTitle", { period: lv.period })}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("direction.validatedOn", { date: lv.validatedDate })}
        </p>
      </div>

      <Tabs defaultValue="kpi">
        <TabsList className="mb-4">
          <TabsTrigger value="kpi">KPI</TabsTrigger>
          <TabsTrigger value="resp">{t("sections.responsabilites")}</TabsTrigger>
          <TabsTrigger value="obj">{t("sections.objectifs")}</TabsTrigger>
          <TabsTrigger value="ids">IDS</TabsTrigger>
        </TabsList>

        {/* KPI Tab */}
        <TabsContent value="kpi">
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="px-4 py-3 font-medium text-muted-foreground">KPI</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">{t("direction.kpiValue")}</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">{t("direction.kpiTarget")}</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">{t("direction.kpiGap")}</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">{t("direction.kpiStatus")}</th>
                  </tr>
                </thead>
                <tbody>
                  {lv.kpis.map((kpi, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 font-medium text-foreground">{kpi.label}</td>
                      <td className="px-4 py-3 text-foreground">{kpi.value}</td>
                      <td className="px-4 py-3 text-muted-foreground">{kpi.target}</td>
                      <td className={`px-4 py-3 font-medium ${ecartColor(kpi.ecart)}`}>{kpi.ecart}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block h-2.5 w-2.5 rounded-full ${kpiStatusDot[kpi.status]}`} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-border">
              <p className="text-sm text-muted-foreground italic">"{lv.checkinNote}"</p>
            </div>
          </Card>
        </TabsContent>

        {/* Responsabilités Tab */}
        <TabsContent value="resp">
          <Card className="p-5">
            <div className="flex items-center gap-4 mb-4">
              <span className="text-3xl font-bold text-primary">{lv.responsabilites.global}%</span>
              <span className="text-sm text-muted-foreground">{t("direction.respGlobal")}</span>
            </div>
            <div className="space-y-2">
              {lv.responsabilites.items.map((r, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${respDot[r.status]}`} />
                  <span className="text-sm text-foreground">{r.label}</span>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* Objectifs Tab */}
        <TabsContent value="obj">
          <div className="space-y-3">
            {lv.objectifs.map((obj, i) => (
              <Card key={i} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-foreground">
                    {obj.label}: {obj.current}/{obj.target}
                  </span>
                  <Badge
                    variant="outline"
                    className={`text-xs ${
                      obj.status === "on_track"
                        ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                        : "border-amber-300 bg-amber-50 text-amber-800"
                    }`}
                  >
                    {obj.status === "on_track" ? "🟢" : "🟠"} {obj.statusLabel}
                  </Badge>
                </div>
                <div className="flex items-center gap-3">
                  <Progress value={obj.progress} className="h-2 flex-1" />
                  <span className="text-xs font-medium text-muted-foreground">{obj.progress}%</span>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* IDS Tab */}
        <TabsContent value="ids">
          <div className="space-y-3">
            {lv.ids.map((ids, i) => (
              <Card key={i} className="p-4">
                <p className="text-sm font-semibold text-foreground mb-1">{ids.problem}</p>
                <p className="text-sm text-muted-foreground mb-2">→ {ids.solution}</p>
                <Badge
                  variant="outline"
                  className={`text-xs ${
                    ids.status === "resolved"
                      ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                      : "border-blue-300 bg-blue-50 text-blue-800"
                  }`}
                >
                  {ids.status === "resolved" ? (
                    <><Check className="h-3 w-3 mr-1" /> {t("direction.resolved")}</>
                  ) : (
                    <><RotateCw className="h-3 w-3 mr-1" /> {t("direction.inProgress")}</>
                  )}
                </Badge>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
