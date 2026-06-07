import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FileText, ArrowRight, Eye, Plus, Calendar, Edit3, Loader2 } from "lucide-react";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  stateConfig,
  isPreparationState,
  isMeetingState,
  type ReportRecord,
  type ReportType,
} from "@/lib/reportsStore";
import { useReports, useCreateReport, mapReportRowToRecord } from "@/hooks/useReports";
import { toast } from "@/hooks/use-toast";
import { useMeetingSchedule, getAvailableWeeklyPeriods, type WeeklyPeriodOption } from "@/lib/meetingSchedule";

function ReportCard({ report, mode }: { report: ReportRecord; mode: "prep" | "consult" }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
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
              {report.type === "weekly" ? `🟢 ${t("reportType.weekly")}` : `🔵 ${t("reportType.monthly")}`}
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
              {t("report.meetingLabel")} : {report.meetingDate}
            </p>
          )}
        </div>

        {mode === "prep" && (
          <div className="w-[140px] shrink-0">
            <p className="text-xs text-muted-foreground mb-1">{t("report.completion")}</p>
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
              {t("report.resumePrep")}
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => navigate(target)}>
              <Eye className="h-4 w-4" />
              {t("report.open")}
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function toISO(d: Date): string {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString().slice(0, 10);
}

function computePeriod(type: ReportType, ref: Date = new Date()): { start: string; end: string } {
  if (type === "monthly") {
    const start = new Date(ref.getFullYear(), ref.getMonth(), 1);
    const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
    return { start: toISO(start), end: toISO(end) };
  }
  // Weekly — lundi → dimanche de la semaine contenant ref
  const day = (ref.getDay() + 6) % 7; // 0 = lundi
  const start = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - day);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
  return { start: toISO(start), end: toISO(end) };
}

function computeEndFromStart(type: ReportType, startISO: string): string {
  const d = new Date(startISO + "T12:00:00");
  if (type === "monthly") {
    return toISO(new Date(d.getFullYear(), d.getMonth() + 1, 0));
  }
  return toISO(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 6));
}

function defaultLabel(type: ReportType, start: string): string {
  const d = new Date(start + "T12:00:00");
  if (type === "monthly") {
    const month = new Intl.DateTimeFormat("fr-FR", { month: "long" }).format(d);
    const year = d.getFullYear();
    return `${month.charAt(0).toUpperCase() + month.slice(1)} ${year}`;
  }
  // Weekly — numéro de semaine ISO
  const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const diff = (target.getTime() - firstThursday.getTime()) / 86400000;
  const weekNum = 1 + Math.round((diff - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `Semaine ${weekNum} — ${d.getFullYear()}`;
}


export default function Rapports() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [tab, setTab] = useState<"prep" | "consult">("prep");
  const { data: rows = [], isLoading, error } = useReports();
  const createReport = useCreateReport();
  const schedule = useMeetingSchedule();


  const [dialogOpen, setDialogOpen] = useState(false);
  const [newType, setNewType] = useState<ReportType>("monthly");

  type MonthlyOption = { periodStart: string; periodEnd: string; yearMonth: string; display: string };
  const [selectedWeeklyPeriod, setSelectedWeeklyPeriod] = useState<WeeklyPeriodOption | null>(null);
  const [selectedMonthlyPeriod, setSelectedMonthlyPeriod] = useState<MonthlyOption | null>(null);

  useEffect(() => {
    setSelectedWeeklyPeriod(null);
    setSelectedMonthlyPeriod(null);
  }, [newType]);

  const existingWeeklyPeriodStarts = useMemo(
    () => rows.filter((r) => r.cycle_type === "weekly").map((r) => r.period_start),
    [rows]
  );
  const existingMonthlyYearMonths = useMemo(
    () => rows.filter((r) => r.cycle_type === "monthly").map((r) => r.period_start.slice(0, 7)),
    [rows]
  );

  const weeklyOptions = useMemo(
    () => getAvailableWeeklyPeriods(schedule.weekly_day, existingWeeklyPeriodStarts, 10),
    [schedule.weekly_day, existingWeeklyPeriodStarts]
  );

  const monthlyOptions = useMemo<MonthlyOption[]>(() => {
    const opts: MonthlyOption[] = [];
    const toLocalISO = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const FR_MONTH = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });
    for (let i = 0; i < 12; i++) {
      const ref = new Date();
      ref.setDate(1);
      ref.setMonth(ref.getMonth() - i);
      const ym = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, "0")}`;
      if (!existingMonthlyYearMonths.includes(ym)) {
        const first = new Date(ref.getFullYear(), ref.getMonth(), 1);
        const last = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
        opts.push({
          periodStart: toLocalISO(first),
          periodEnd: toLocalISO(last),
          yearMonth: ym,
          display: FR_MONTH.format(first).replace(/^./, (c) => c.toUpperCase()),
        });
      }
    }
    return opts;
  }, [existingMonthlyYearMonths]);

  const [blockedInfo, setBlockedInfo] = useState<{ type: ReportType; label: string; stateLabel: string; id: string } | null>(null);

  const reports = useMemo(() => rows.map(mapReportRowToRecord), [rows]);

  const prepReports = useMemo(
    () => reports.filter((r) => isPreparationState(r.state)),
    [reports],
  );
  const consultReports = useMemo(
    () => reports.filter((r) => isMeetingState(r.state)),
    [reports],
  );

  const handleCreate = async () => {
    let pStart: string, pEnd: string, finalLabel: string;
    if (newType === "weekly") {
      if (!selectedWeeklyPeriod) return;
      pStart = selectedWeeklyPeriod.periodStart;
      pEnd = selectedWeeklyPeriod.periodEnd;
      finalLabel = selectedWeeklyPeriod.label;
    } else {
      if (!selectedMonthlyPeriod) return;
      pStart = selectedMonthlyPeriod.periodStart;
      pEnd = selectedMonthlyPeriod.periodEnd;
      finalLabel = selectedMonthlyPeriod.display;
    }
    try {
      const created = await createReport.mutateAsync({
        cycle_type: newType,
        cycle_label: finalLabel,
        period_start: pStart,
        period_end: pEnd,
      });
      setDialogOpen(false);
      setSelectedWeeklyPeriod(null);
      setSelectedMonthlyPeriod(null);
      navigate(`/rapport/${created.id}`);
    } catch (e) {
      const message = e instanceof Error ? e.message : "";
      if (message === "Un rapport actif existe déjà pour ce cycle.") {
        const existing = reports.find(
          (r) => r.type === newType && isPreparationState(r.state),
        );
        if (existing) {
          setBlockedInfo({
            type: existing.type,
            label: existing.label,
            stateLabel: stateConfig[existing.state].label,
            id: existing.id,
          });
        } else {
          setBlockedInfo({ type: newType, label: "", stateLabel: "", id: "" });
        }
      } else {
        toast({
          title: "Erreur lors de la création",
          description: message || "Impossible de créer le rapport.",
          variant: "destructive",
        });
      }
    }
  };

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Rapports</h1>
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
              <Label className="text-sm mb-1.5 block">Type de cycle</Label>
              <Select value={newType} onValueChange={(v) => setNewType(v as ReportType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">🟢 Weekly</SelectItem>
                  <SelectItem value="monthly">🔵 Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {newType === "weekly" ? (
              <div>
                <Label className="text-sm mb-1.5 block">Période de la réunion</Label>
                <Select
                  value={selectedWeeklyPeriod?.periodStart ?? ""}
                  onValueChange={(v) => {
                    const opt = weeklyOptions.find((o) => o.periodStart === v) ?? null;
                    setSelectedWeeklyPeriod(opt);
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Sélectionner une période…" /></SelectTrigger>
                  <SelectContent>
                    {weeklyOptions.length === 0 ? (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">Aucune période disponible</div>
                    ) : (
                      weeklyOptions.map((opt) => (
                        <SelectItem key={opt.periodStart} value={opt.periodStart}>
                          {opt.display}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1.5">
                  Calculé automatiquement selon votre calendrier de réunions.
                </p>
              </div>
            ) : (
              <div>
                <Label className="text-sm mb-1.5 block">Mois du rapport</Label>
                <Select
                  value={selectedMonthlyPeriod?.yearMonth ?? ""}
                  onValueChange={(v) => {
                    const opt = monthlyOptions.find((o) => o.yearMonth === v) ?? null;
                    setSelectedMonthlyPeriod(opt);
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Sélectionner un mois…" /></SelectTrigger>
                  <SelectContent>
                    {monthlyOptions.length === 0 ? (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">Aucun mois disponible</div>
                    ) : (
                      monthlyOptions.map((opt) => (
                        <SelectItem key={opt.yearMonth} value={opt.yearMonth}>
                          {opt.display}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={() => setDialogOpen(false)} disabled={createReport.isPending}>Annuler</Button>
            <Button
              onClick={handleCreate}
              disabled={
                createReport.isPending ||
                (newType === "weekly" && !selectedWeeklyPeriod) ||
                (newType === "monthly" && !selectedMonthlyPeriod)
              }
            >
              {createReport.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Créer et ouvrir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      <AlertDialog open={!!blockedInfo} onOpenChange={(o) => !o && setBlockedInfo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Un rapport {blockedInfo?.type === "weekly" ? "Weekly" : "Monthly"} est déjà en cours
            </AlertDialogTitle>
            <AlertDialogDescription>
              {blockedInfo?.label ? (
                <>
                  Le rapport <strong>« {blockedInfo.label} »</strong>
                  {blockedInfo.stateLabel ? <> est actuellement <strong>{blockedInfo.stateLabel.toLowerCase()}</strong></> : " est en cours"}.
                  <br />
                  Vous devez le finaliser (ou le valider) avant d'en créer un nouveau de ce type.
                </>
              ) : (
                <>Vous avez déjà un rapport de ce type en cours. Finalisez-le avant d'en créer un nouveau.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {blockedInfo?.id && (
              <Button
                variant="outline"
                onClick={() => {
                  const id = blockedInfo.id;
                  setBlockedInfo(null);
                  setDialogOpen(false);
                  navigate(`/rapport/${id}`);
                }}
              >
                <Eye className="h-4 w-4 mr-1.5" />
                Voir le rapport
              </Button>
            )}
            <AlertDialogAction onClick={() => setBlockedInfo(null)}>
              Compris
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Chargement…
        </div>
      ) : error ? (
        <div className="py-20 text-center text-destructive">Erreur de chargement des rapports.</div>
      ) : (
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
      )}
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
