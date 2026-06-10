import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { FileSpreadsheet, Download, Upload, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  exportKpiWorkbook,
  parseKpiWorkbook,
  type KpiImportPayload,
} from "@/lib/kpiExcel";
import { useKpiImport } from "@/hooks/useKpiImport";
import ExcelImportDialog, { type ExcelImportParsed } from "@/components/ExcelImportDialog";
import type { KpiDefinitionFull } from "@/hooks/useKpiConfig";
import type { KpiMonthlyTarget } from "@/hooks/useKpiMonthlyTargets";
import type { KpiRoleAssignment } from "@/hooks/useKpiRoleAssignments";

interface Props {
  spaId: string;
  userId: string;
  spaName: string;
  yearMonth: string;
  kpis: KpiDefinitionFull[];
  targets: KpiMonthlyTarget[];
  assignments: KpiRoleAssignment[];
  canImport: boolean; // admin + spa_manager (RLS borne l'écriture au spa du manager)
}

export default function KpiExcelMenu({
  spaId,
  userId,
  spaName,
  yearMonth,
  kpis,
  targets,
  assignments,
  canImport,
}: Props) {
  const { t } = useTranslation();
  const [exporting, setExporting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const importMut = useKpiImport();

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportKpiWorkbook({ kpis, targets, assignments, yearMonth, spaName });
      toast.success(t("kpiConfig.io.exportDone"));
    } catch (e: any) {
      toast.error(e?.message ?? t("common.error"));
    } finally {
      setExporting(false);
    }
  };

  const parse = async (file: File): Promise<ExcelImportParsed> => {
    const r = await parseKpiWorkbook(file, {
      spaId,
      userId,
      existingKpiIds: new Set(kpis.map((k) => k.id)),
    });
    return {
      errors: r.errors,
      warnings: r.warnings,
      payload: r.payload,
      summary: [
        { label: t("kpiConfig.io.toCreate", { count: r.counts.create }), count: r.counts.create },
        { label: t("kpiConfig.io.toUpdate", { count: r.counts.update }), count: r.counts.update },
        { label: t("kpiConfig.io.objectives", { count: r.counts.objectives }), count: r.counts.objectives },
        {
          label: t("kpiConfig.io.responsibilities", { count: r.counts.assignments }),
          count: r.counts.assignments,
        },
      ],
    };
  };

  const onConfirm = (payload: unknown) => {
    importMut.mutate(payload as KpiImportPayload, {
      onSuccess: () => {
        toast.success(t("kpiConfig.io.importDone"));
        setImportOpen(false);
      },
      onError: (e: any) => toast.error(e?.message ?? t("kpiConfig.io.importFailed")),
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5" disabled={exporting}>
            <FileSpreadsheet className="h-4 w-4" />
            {t("kpiConfig.io.menu")}
            <ChevronDown className="h-3.5 w-3.5 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleExport} className="gap-2">
            <Download className="h-4 w-4" />
            {t("kpiConfig.io.export")}
          </DropdownMenuItem>
          {canImport && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setImportOpen(true)} className="gap-2">
                <Upload className="h-4 w-4" />
                {t("kpiConfig.io.import")}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {canImport && (
        <ExcelImportDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          i18nPrefix="kpiConfig.io"
          parse={parse}
          onConfirm={onConfirm}
          isPending={importMut.isPending}
        />
      )}
    </>
  );
}
