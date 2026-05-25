import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, ArrowRight, Eye, Plus, Calendar, Edit3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getReports,
  setReports,
  stateConfig,
  isPreparationState,
  isMeetingState,
  type ReportRecord,
  type ReportType,
} from "@/lib/reportsStore";

const FR_MONTH_FMT = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function getIsoWeek(d: Date): number {
  const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const diff = (target.getTime() - firstThursday.getTime()) / 86400000;
  return 1 + Math.round((diff - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
}

function monthPeriod(d: Date): string {
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return `${FR_MONTH_FMT.format(start)} → ${FR_MONTH_FMT.format(end)}`;
}

function weekPeriod(d: Date): string {
  // ISO week: Monday → Sunday containing d
  const day = (d.getDay() + 6) % 7;
  const monday = new Date(d);
  monday.setDate(d.getDate() - day);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return `${FR_MONTH_FMT.format(monday)} → ${FR_MONTH_FMT.format(sunday)}`;
}

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
  const navigate = useNavigate();
  const [tab, setTab] = useState<"prep" | "consult">("prep");
  const [reports, setReportsState] = useState<ReportRecord[]>(() => getReports());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newType, setNewType] = useState<ReportType>("monthly");
  const [newMeetingDate, setNewMeetingDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });

  useEffect(() => {
    const reload = () => setReportsState(getReports());
    window.addEventListener("reports-data-changed", reload);
    return () => window.removeEventListener("reports-data-changed", reload);
  }, []);

  const prepReports = useMemo(
    () => reports.filter((r) => isPreparationState(r.state)),
    [reports],
  );
  const consultReports = useMemo(
    () => reports.filter((r) => isMeetingState(r.state)),
    [reports],
  );

  const handleCreate = () => {
    const d = new Date(newMeetingDate);
    const fmtDate = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(d);
    const monthLabel = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(d);
    const weekNum = getIsoWeek(d);
    const label = newType === "monthly"
      ? `Monthly — ${capitalize(monthLabel)}`
      : `Weekly — Semaine ${weekNum}`;
    const period = newType === "monthly"
      ? monthPeriod(d)
      : weekPeriod(d);
    const id = `r${Date.now()}`;
    const newReport: ReportRecord = {
      id,
      type: newType,
      label,
      period,
      state: "draft_preparation",
      updatedAt: new Date().toISOString(),
      meetingDate: fmtDate,
      completion: 0,
    };
    setReports([newReport, ...getReports()]);
    setDialogOpen(false);
    navigate(`/rapport/${id}`);
  };

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Rapports — Par Gran Canaria</h1>
        <Button className="gap-1.5" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" /> Nouveau rapport
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouveau rapport</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-sm mb-1.5 block">Type de rapport</Label>
              <Select value={newType} onValueChange={(v) => setNewType(v as ReportType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">🟢 Weekly</SelectItem>
                  <SelectItem value="monthly">🔵 Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm mb-1.5 block">Date de réunion</Label>
              <Input
                type="date"
                value={newMeetingDate}
                onChange={(e) => setNewMeetingDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleCreate}>Créer et ouvrir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
