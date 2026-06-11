import { useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  RotateCw,
  ChevronDown,
  FileDown,
  Loader2,
  Sparkles,
  Info,
} from "lucide-react";
import { PDFDownloadLink } from "@react-pdf/renderer";
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
import { useDirectionDigest } from "@/hooks/useDirectionDigest";
import { useWeeklyPdfData } from "@/hooks/useWeeklyPdfData";
import { WeeklyReportPdf } from "@/components/pdf/WeeklyReportPdf";
import { Skeleton } from "@/components/ui/skeleton";
import { AiBadge } from "@/components/AiBadge";
import {
  CommitmentLine,
  DiffusionPill,
  ProblemLine,
  verdictDot,
  verdictRing,
  verdictTone,
} from "@/components/direction/digestParts";

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

// Période lisible pour l'en-tête du PDF (le PDF est en Helvetica/WinAnsi : pas de
// flèche « → » ni de date ISO brute, sinon l'en-tête s'affiche cassé).
function fmtDateFr(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function DirectionSpaDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const weekOffset = Number(searchParams.get("week") ?? 0) || 0;

  // Digest de la semaine sélectionnée (cache partagé avec l'overview).
  const { data: digests = [], isLoading: digestLoading } = useDirectionDigest(weekOffset);
  const digest = useMemo(() => digests.find((d) => d.spaId === id) ?? null, [digests, id]);

  // Détail opérationnel aligné sur le rapport de la semaine.
  const { data: detail, isLoading: detailLoading } = useDirectionSpaDetail(
    id,
    digest?.reportId ?? null,
  );
  const { data: spas = [] } = useDirectionSpas();

  const isDiffused = digest?.diffusionStatus === "diffuse";
  const pdfEnabled = !!(isDiffused && digest?.reportId);

  // PDF data — réservé aux rapports diffusés.
  const { data: pdfData, isLoading: pdfLoading } = useWeeklyPdfData(
    pdfEnabled ? digest!.reportId! : "",
    digest?.reportLabel ?? "",
    digest?.periodStart && digest?.periodEnd
      ? `${fmtDateFr(digest.periodStart)} – ${fmtDateFr(digest.periodEnd)}`
      : "",
    digest?.periodStart ?? "",
    digest?.periodEnd ?? "",
    pdfEnabled ? id ?? null : null,
  );

  const isLoading = digestLoading || detailLoading;

  const setWeek = (next: number) => {
    const sp = new URLSearchParams(searchParams);
    if (next === 0) sp.delete("week");
    else sp.set("week", String(next));
    setSearchParams(sp, { replace: false });
  };

  if (isLoading) {
    return (
      <div className="max-w-[900px] mx-auto px-6 py-6 space-y-4">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

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
  const hasReport = !!digest?.reportId;

  return (
    <div className="max-w-[900px] mx-auto px-6 py-6 pb-20">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-3 flex-wrap">
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-muted-foreground mb-2 -ml-2"
            onClick={() => navigate(`/direction${weekOffset ? `?week=${weekOffset}` : ""}`)}
          >
            <ChevronLeft className="h-4 w-4" /> {t("direction.backToAll")}
          </Button>
          <h1 className="text-2xl font-bold text-foreground">{detail.name}</h1>
          <p className="text-sm text-muted-foreground">
            {detail.manager} · {detail.managerRole}
            {digest && (
              <>
                {" · "}
                <DiffusionPill status={digest.diffusionStatus} />
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Week selector */}
          <div className="flex items-center gap-1 rounded-full border border-border bg-card px-2 py-1 shadow-sm">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setWeek(weekOffset - 1)}
              aria-label={t("direction.digest.previousWeek")}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs font-medium px-1">
              {digest?.reportLabel ?? t("direction.digest.noWeeklyReport")}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setWeek(weekOffset + 1)}
              disabled={weekOffset >= 0}
              aria-label={t("direction.digest.nextWeek")}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
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
                  onClick={() =>
                    navigate(`/direction/spa/${s.id}${weekOffset ? `?week=${weekOffset}` : ""}`)
                  }
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
      </div>

      {/* ====================== PAGE 1 — Synthèse Direction ====================== */}
      {!hasReport ? (
        <Card className="p-6 mb-6 text-center text-sm text-muted-foreground">
          {t("direction.digest.noWeeklyReport")}
        </Card>
      ) : digest ? (
        <>
          {/* Bandeau verdict */}
          <Card className={`border-l-4 ${verdictRing[digest.verdict.level]} mb-4`}>
            <div className={`rounded-r-xl border ${verdictTone[digest.verdict.level]} p-4 flex items-center gap-3`}>
              <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${verdictDot[digest.verdict.level]}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">
                  {t(`direction.digest.verdictLevel.${digest.verdict.level}`)}
                </p>
                <p className="text-xs mt-0.5 opacity-90">
                  {[
                    digest.counters.bloquants > 0 &&
                      t("direction.digest.counters.blocking", { count: digest.counters.bloquants }),
                    digest.counters.autresProblemes > 0 &&
                      t("direction.digest.counters.other", { count: digest.counters.autresProblemes }),
                    digest.counters.enRetard > 0 &&
                      t("direction.digest.counters.overdue", { count: digest.counters.enRetard }),
                    digest.counters.aRisque > 0 &&
                      t("direction.digest.counters.atRisk", { count: digest.counters.aRisque }),
                  ]
                    .filter(Boolean)
                    .join(" · ") || t("direction.digest.allGreen")}
                </p>
              </div>

              {/* PDF — réservé aux rapports diffusés */}
              {pdfEnabled ? (
                pdfLoading || !pdfData ? (
                  <Button size="sm" variant="outline" disabled>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  </Button>
                ) : (
                  <PDFDownloadLink
                    document={<WeeklyReportPdf data={pdfData} />}
                    fileName={`rapport-${detail.name}-${(digest.reportLabel ?? "weekly").replace(/\s/g, "-").toLowerCase()}.pdf`}
                  >
                    {({ loading }) => (
                      <Button size="sm" variant="outline" className="gap-1.5" disabled={loading}>
                        {loading ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <FileDown className="h-3.5 w-3.5" />
                        )}
                        {t("direction.digest.actions.downloadPdf")}
                      </Button>
                    )}
                  </PDFDownloadLink>
                )
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Info className="h-3.5 w-3.5" />
                  {t("direction.digest.notDiffusedNoPdf")}
                </span>
              )}
            </div>
          </Card>

          {/* Synthèse IA */}
          {digest.executiveSummary && (
            <Card className="mb-4 relative">
              <AiBadge />
              <div className="p-4 pr-24">
                <h3 className="text-sm font-semibold text-foreground mb-2 inline-flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-primary" />
                  {t("ai.executiveSummary")}
                </h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {digest.executiveSummary}
                </p>
              </div>
            </Card>
          )}

          {/* Problèmes par gravité */}
          {digest.problems.length > 0 && (
            <Card className="mb-4 p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                {t("direction.digest.sections.problems")}
              </h3>
              <div className="space-y-1.5">
                {digest.problems.map((p, i) => (
                  <ProblemLine key={i} problem={p} />
                ))}
              </div>
            </Card>
          )}

          {/* Engagements non tenus */}
          {(digest.commitmentsOverdue.length > 0 || digest.commitmentsAtRisk.length > 0) && (
            <Card className="mb-6 p-4 space-y-4">
              {digest.commitmentsOverdue.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-destructive">
                    {t("direction.digest.sections.overdue")}
                  </h3>
                  <div className="space-y-1.5">
                    {digest.commitmentsOverdue.map((c, i) => (
                      <CommitmentLine key={`o-${i}`} commitment={c} late />
                    ))}
                  </div>
                </div>
              )}
              {digest.commitmentsAtRisk.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                    {t("direction.digest.sections.atRisk")}
                  </h3>
                  <div className="space-y-1.5">
                    {digest.commitmentsAtRisk.map((c, i) => (
                      <CommitmentLine key={`r-${i}`} commitment={c} late={false} />
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )}
        </>
      ) : null}

      {/* ====================== DÉTAIL OPÉRATIONNEL ====================== */}
      {/* Current report summary */}
      <Card className="mb-6">
        <div className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">{detail.currentReport.label}</span>
              {ss && (
                <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${ss.classes}`}>
                  {t(ss.labelKey)}
                </span>
              )}
            </div>
            <span className="text-sm text-muted-foreground">{detail.currentReport.progress}</span>
          </div>
          <Progress value={(detail.currentReport.progressNum / detail.currentReport.progressDen) * 100} className="h-2" />
        </div>
      </Card>

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
          <TabsTrigger value="kpi">{t("sections.kpi")}</TabsTrigger>
          <TabsTrigger value="resp">{t("sections.responsabilites")}</TabsTrigger>
          <TabsTrigger value="obj">{t("sections.objectifs")}</TabsTrigger>
          <TabsTrigger value="ids">{t("sections.ids")}</TabsTrigger>
        </TabsList>

        {/* KPI Tab */}
        <TabsContent value="kpi">
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="px-4 py-3 font-medium text-muted-foreground">{t("sections.kpi")}</th>
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
            {lv.checkinNote && (
              <div className="px-4 py-3 border-t border-border">
                <p className="text-sm text-muted-foreground italic">"{lv.checkinNote}"</p>
              </div>
            )}
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
