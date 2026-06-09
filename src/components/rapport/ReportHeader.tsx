import { useTranslation } from "react-i18next";
import { ChevronRight, FileDown, Loader2 } from "lucide-react";
import { PDFDownloadLink } from "@react-pdf/renderer";
import type { SectionId } from "@/pages/RapportDetail";
import { Button } from "@/components/ui/button";
import { WeeklyReportPdf } from "@/components/pdf/WeeklyReportPdf";
import { useWeeklyPdfData } from "@/hooks/useWeeklyPdfData";

interface Props {
  label: string;
  period: string;
  type: "monthly" | "weekly";
  completedSections: number;
  totalSections: number;
  activeSection: SectionId;
  reportId?: string;
  reportState?: string;
  periodStart?: string;
  periodEnd?: string;
}

const segmentColors = (completed: number, total: number) =>
  Array.from({ length: total }, (_, i) => (i < completed ? "bg-primary" : "bg-border"));

export function ReportHeader({
  label,
  period,
  type,
  completedSections,
  totalSections,
  activeSection,
  reportId,
  periodStart = "",
  periodEnd = "",
}: Props) {
  const { t } = useTranslation();
  const isWeekly = type === "weekly";
  const { data: pdfData, isLoading: pdfLoading } = useWeeklyPdfData(
    isWeekly && reportId ? reportId : "",
    label,
    period,
    periodStart,
    periodEnd,
  );

  const sectionLabels: Record<SectionId, string> = {
    kpi: t("report.header.sectionLabels.kpi"),
    checkin: t("report.header.sectionLabels.checkin"),
    responsabilites: t("report.header.sectionLabels.responsabilites"),
    todo: t("report.header.sectionLabels.todo"),
    objectifs: t("report.header.sectionLabels.objectifs"),
    ids: t("report.header.sectionLabels.ids"),
    notes: t("report.header.sectionLabels.notes"),
  };

  return (
    <div className="mb-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
        <span>{t("report.header.breadcrumb.org")}</span>
        <ChevronRight className="h-3 w-3" />
        <span>{t("report.header.breadcrumb.reports")}</span>
        <ChevronRight className="h-3 w-3" />
        <span>{period}</span>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground font-medium">{sectionLabels[activeSection]}</span>
      </nav>

      {/* Title row */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{label}</h1>
          <p className="text-sm text-muted-foreground mt-1">{period}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
              isWeekly ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-blue-800"
            }`}
          >
            {isWeekly ? "🟢 Weekly" : "🔵 Monthly"}
          </span>
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
            {t("report.header.badge.enPreparation")}
          </span>
          {isWeekly && reportId && (
            pdfLoading || !pdfData ? (
              <Button size="sm" variant="outline" disabled>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              </Button>
            ) : (
              <PDFDownloadLink
                document={<WeeklyReportPdf data={pdfData} />}
                fileName={`rapport-weekly-${label.replace(/\s/g, "-").toLowerCase()}.pdf`}
              >
                {({ loading }) => (
                  <Button size="sm" variant="outline" className="gap-1.5" disabled={loading}>
                    {loading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <FileDown className="h-3.5 w-3.5" />
                    )}
                    PDF
                  </Button>
                )}
              </PDFDownloadLink>
            )
          )}
        </div>
      </div>

      {/* Segmented progress bar */}
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs text-muted-foreground font-medium">
          {t("report.header.sections", { completed: completedSections, total: totalSections })}
        </span>
      </div>
      <div className="flex gap-1 h-2">
        {segmentColors(completedSections, totalSections).map((color, i) => (
          <div key={i} className={`flex-1 rounded-full ${color} transition-colors`} />
        ))}
      </div>
    </div>
  );
}
