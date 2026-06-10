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
import { exportRespWorkbook } from "@/lib/respExcel";
import type { RespTemplateFullRow } from "@/hooks/useResponsabilites";
import ImportRespDialog from "./ImportRespDialog";

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
        <ImportRespDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          spaId={spaId}
          existingIds={templates.map((tmpl) => tmpl.id)}
        />
      )}
    </>
  );
}
