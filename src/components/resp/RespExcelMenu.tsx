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
  exportRespWorkbook,
  parseRespWorkbook,
  type RespImportPayload,
} from "@/lib/respExcel";
import { useRespImport } from "@/hooks/useRespImport";
import ExcelImportDialog, { type ExcelImportParsed } from "@/components/ExcelImportDialog";
import type { RespTemplateFullRow } from "@/hooks/useResponsabilites";

interface Props {
  spaId: string;
  spaName: string;
  templates: RespTemplateFullRow[];
  canImport: boolean; // admin + spa_manager (RLS borne l'écriture au spa du manager)
}

export default function RespExcelMenu({ spaId, spaName, templates, canImport }: Props) {
  const { t } = useTranslation();
  const [exporting, setExporting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const importMut = useRespImport();

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportRespWorkbook({ templates, spaName });
      toast.success(t("respConfig.io.exportDone"));
    } catch (e: any) {
      toast.error(e?.message ?? t("common.error"));
    } finally {
      setExporting(false);
    }
  };

  const parse = async (file: File): Promise<ExcelImportParsed> => {
    const r = await parseRespWorkbook(file, { spaId, existingIds: new Set(templates.map((x) => x.id)) });
    return {
      errors: r.errors,
      warnings: r.warnings,
      payload: r.payload,
      summary: [
        { label: t("respConfig.io.toCreate", { count: r.counts.create }), count: r.counts.create },
        { label: t("respConfig.io.toUpdate", { count: r.counts.update }), count: r.counts.update },
      ],
    };
  };

  const onConfirm = (payload: unknown) => {
    importMut.mutate(payload as RespImportPayload, {
      onSuccess: () => {
        toast.success(t("respConfig.io.importDone"));
        setImportOpen(false);
      },
      onError: (e: any) => toast.error(e?.message ?? t("respConfig.io.importFailed")),
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5" disabled={exporting}>
            <FileSpreadsheet className="h-4 w-4" />
            {t("respConfig.io.menu")}
            <ChevronDown className="h-3.5 w-3.5 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleExport} className="gap-2">
            <Download className="h-4 w-4" />
            {t("respConfig.io.export")}
          </DropdownMenuItem>
          {canImport && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setImportOpen(true)} className="gap-2">
                <Upload className="h-4 w-4" />
                {t("respConfig.io.import")}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {canImport && (
        <ExcelImportDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          i18nPrefix="respConfig.io"
          parse={parse}
          onConfirm={onConfirm}
          isPending={importMut.isPending}
        />
      )}
    </>
  );
}
