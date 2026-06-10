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
import { parseRespWorkbook, type RespImportPreview } from "@/lib/respExcel";
import { useRespImport } from "@/hooks/useRespImport";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  spaId: string;
  existingIds: string[];
}

export default function ImportRespDialog({ open, onOpenChange, spaId, existingIds }: Props) {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<RespImportPreview | null>(null);
  const importMut = useRespImport();

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
      const result = await parseRespWorkbook(file, { spaId, existingIds: new Set(existingIds) });
      setPreview(result);
    } catch (e: any) {
      toast.error(e?.message ?? t("respConfig.io.unreadable"));
      reset();
    } finally {
      setParsing(false);
    }
  };

  const handleConfirm = () => {
    if (!preview || preview.errors.length > 0) return;
    importMut.mutate(preview.payload, {
      onSuccess: () => {
        toast.success(t("respConfig.io.importDone"));
        handleClose(false);
      },
      onError: (e: any) => toast.error(e?.message ?? t("respConfig.io.importFailed")),
    });
  };

  const hasErrors = (preview?.errors.length ?? 0) > 0;
  const nothingToDo =
    preview != null && preview.counts.create === 0 && preview.counts.update === 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("respConfig.io.importTitle")}</DialogTitle>
          <DialogDescription>{t("respConfig.io.importDesc")}</DialogDescription>
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
              {parsing ? t("respConfig.io.parsing") : fileName ?? t("respConfig.io.chooseFile")}
            </span>
          </button>
        )}

        {preview && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <FileSpreadsheet className="h-3.5 w-3.5" />
              {fileName}
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">
                {t("respConfig.io.toCreate", { count: preview.counts.create })}
              </Badge>
              <Badge variant="secondary">
                {t("respConfig.io.toUpdate", { count: preview.counts.update })}
              </Badge>
            </div>

            {hasErrors && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>
                  {t("respConfig.io.errorsTitle", { count: preview.errors.length })}
                </AlertTitle>
                <AlertDescription>
                  <ul className="mt-1 max-h-40 overflow-y-auto text-xs space-y-0.5 list-disc pl-4">
                    {preview.errors.slice(0, 50).map((e, i) => (
                      <li key={i}>
                        <span className="font-medium">
                          {e.sheet}
                          {e.row > 0 ? ` · ${t("respConfig.io.rowLabel", { row: e.row })}` : ""}
                        </span>{" "}
                        — {e.message}
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {!hasErrors && nothingToDo && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>{t("respConfig.io.nothingToDo")}</AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {preview && (
            <Button variant="ghost" onClick={reset} disabled={importMut.isPending}>
              {t("respConfig.io.chooseAnother")}
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
            {t("respConfig.io.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
