import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, ArrowRight, Eye, Plus, Calendar, Edit3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  reportsData,
  stateConfig,
  isPreparationState,
  isMeetingState,
  type ReportRecord,
} from "@/lib/reportsStore";

function ReportCard({ report, mode }: { report: ReportRecord; mode: "prep" | "consult" }) {
  const navigate = useNavigate();
  const sc = stateConfig[report.state];
  const target = `/rapport/${report.id}`;

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-4 flex-wrap">
        <div className="flex-1 min-w-[220px]">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span
              className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                report.type === "weekly"
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-blue-100 text-blue-800"
              }`}
            >
              {report.type === "weekly" ? "🟢 Weekly" : "🔵 Monthly"}
            </span>
            <span
              className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${sc.bg} ${sc.text}`}
            >
              {sc.label}
            </span>
          </div>
          <h3 className="font-semibold text-foreground">{report.label}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{report.period}</p>
          {report.meetingDate && (
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Réunion : {report.meetingDate}
            </p>
          )}
        </div>

        {mode === "prep" && (
          <div className="w-[140px] shrink-0">
            <p className="text-xs text-muted-foreground mb-1">Complétion</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${report.completion}%` }}
                />
              </div>
              <span className="text-xs font-medium text-foreground">{report.completion}%</span>
            </div>
          </div>
        )}

        <div className="shrink-0">
          {mode === "prep" ? (
            <Button size="sm" className="gap-1.5" onClick={() => navigate(target)}>
              <Edit3 className="h-4 w-4" />
              Reprendre la préparation
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => navigate(target)}>
              <Eye className="h-4 w-4" />
              Ouvrir
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Rapports() {
  const [tab, setTab] = useState<"prep" | "consult">("prep");

  const prepReports = useMemo(
    () => reportsData.filter((r) => isPreparationState(r.state)),
    [],
  );
  const consultReports = useMemo(
    () => reportsData.filter((r) => isMeetingState(r.state)),
    [],
  );

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Rapports — Par Gran Canaria</h1>
        <Button className="gap-1.5">
          <Plus className="h-4 w-4" /> Nouveau rapport
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "prep" | "consult")} className="w-full">
        <TabsList className="mb-5">
          <TabsTrigger value="prep" className="gap-2">
            À compléter
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold">
              {prepReports.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="consult" className="gap-2">
            À consulter / En réunion
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-muted text-muted-foreground text-xs font-semibold">
              {consultReports.length}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="prep">
          {prepReports.length === 0 ? (
            <EmptyState
              title="Aucun rapport en préparation"
              subtitle="Tous vos rapports sont finalisés. Créez le prochain rapport pour démarrer."
            />
          ) : (
            <div className="flex flex-col gap-3">
              {prepReports.map((r) => (
                <ReportCard key={r.id} report={r} mode="prep" />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="consult">
          {consultReports.length === 0 ? (
            <EmptyState
              title="Aucun rapport à consulter"
              subtitle="Les rapports finalisés et validés apparaîtront ici."
            />
          ) : (
            <div className="flex flex-col gap-3">
              {consultReports.map((r) => (
                <ReportCard key={r.id} report={r} mode="consult" />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}

function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <FileText className="h-12 w-12 text-muted-foreground/40 mb-4" />
      <p className="text-foreground font-medium">{title}</p>
      <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
    </div>
  );
}
