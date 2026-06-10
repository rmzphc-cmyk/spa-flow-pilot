import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { parseKpiWorkbook, type ImportPreview } from "@/lib/kpiExcel";
import { useKpiImport } from "@/hooks/useKpiImport";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  spaId: string;
  userId: string;
  existingKpiIds: string[];
}

export default function ImportKpiDialog({
  open,
  onOpenChange,
  spaId,
  userId,
  existingKpiIds,
}: Props) {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const importMut = useKpiImport();

  const reset = () => {
    setParsing(false);
    setFileName(null);
    setPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setParsing(true);
    setPreview(null);
    try {
      const result = await parseKpiWorkbook(file, {
        spaId,
        userId,
        existingKpiIds: new Set(existingKpiIds),
      });
      setPreview(result);
    } catch (e: any) {
      toast.error(e?.message ?? t("kpiConfig.io.unreadable"));
      reset();
    } finally {
      setParsing(false);
    }
  };

  const handleConfirm = () => {
    if (!preview || preview.errors.length > 0) return;
    importMut.mutate(preview.payload, {
      onSuccess: () => {
        toast.success(t("kpiConfig.io.importDone"));
        handleClose(false);
      },
      onError: (e: any) => toast.error(e?.message ?? t("kpiConfig.io.importFailed")),
    });
  };

  const hasErrors = (preview?.errors.length ?? 0) > 0;
  const nothingToDo =
    preview != null &&
    preview.counts.create === 0 &&
    preview.counts.update === 0 &&
    preview.counts.objectives === 0 &&
    preview.counts.assignments === 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("kpiConfig.io.importTitle")}</DialogTitle>
          <DialogDescription>{t("kpiConfig.io.importDesc")}</DialogDescription>
        </DialogHeader>

        <input
          ref={fileRef}
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />

        {/* Sélecteur de fichier */}
        {!preview && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={parsing}
            className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-xl py-10 text-muted-foreground hover:border-teal-400 hover:text-teal-600 transition-colors disabled:opacity-60"
          >
            {parsing ? (
              <Loader2 className="h-7 w-7 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-7 w-7" />
            )}
            <span className="text-sm font-medium">
              {parsing
                ? t("kpiConfig.io.parsing")
                : fileName ?? t("kpiConfig.io.chooseFile")}
            </span>
          </button>
        )}

        {/* Écran de revue */}
        {preview && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <FileSpreadsheet className="h-3.5 w-3.5" />
              {fileName}
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">
                {t("kpiConfig.io.toCreate", { count: preview.counts.create })}
              </Badge>
              <Badge variant="secondary">
                {t("kpiConfig.io.toUpdate", { count: preview.counts.update })}
              </Badge>
              <Badge variant="secondary">
                {t("kpiConfig.io.objectives", { count: preview.counts.objectives })}
              </Badge>
              <Badge variant="secondary">
                {t("kpiConfig.io.responsibilities", { count: preview.counts.assignments })}
              </Badge>
            </div>

            {hasErrors && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>
                  {t("kpiConfig.io.errorsTitle", { count: preview.errors.length })}
                </AlertTitle>
                <AlertDescription>
                  <ul className="mt-1 max-h-40 overflow-y-auto text-xs space-y-0.5 list-disc pl-4">
                    {preview.errors.slice(0, 50).map((e, i) => (
                      <li key={i}>
                        <span className="font-medium">
                          {e.sheet}
                          {e.row > 0 ? ` · ${t("kpiConfig.io.rowLabel", { row: e.row })}` : ""}
                        </span>{" "}
                        — {e.message}
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {!hasErrors && preview.warnings.length > 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>
                  {t("kpiConfig.io.warningsTitle", { count: preview.warnings.length })}
                </AlertTitle>
                <AlertDescription>
                  <ul className="mt-1 max-h-32 overflow-y-auto text-xs space-y-0.5 list-disc pl-4">
                    {preview.warnings.slice(0, 30).map((w, i) => (
                      <li key={i}>{w.message}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {!hasErrors && nothingToDo && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>{t("kpiConfig.io.nothingToDo")}</AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {preview && (
            <Button variant="ghost" onClick={reset} disabled={importMut.isPending}>
              {t("kpiConfig.io.chooseAnother")}
            </Button>
          )}
          <Button
            onClick={handleConfirm}
            disabled={!preview || hasErrors || nothingToDo || importMut.isPending}
            className="gap-1.5 bg-teal-600 hover:bg-teal-700 text-white"
          >
            {importMut.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {t("kpiConfig.io.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
