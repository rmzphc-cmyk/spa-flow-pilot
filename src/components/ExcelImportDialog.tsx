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
import type { ImportIssue } from "@/lib/excelHelpers";

// Résultat d'un parsing, prêt pour l'écran de revue. `summary` porte déjà les
// libellés traduits (badges de comptes) — c'est l'appelant (le menu, qui a `t`)
// qui les construit, le dialogue reste agnostique du domaine.
export interface ExcelImportParsed {
  errors: ImportIssue[];
  warnings: ImportIssue[];
  summary: { label: string; count: number }[];
  payload: unknown;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  // Préfixe i18n du domaine (kpiConfig.io | respConfig.io) : title/desc + chrome.
  i18nPrefix: string;
  parse: (file: File) => Promise<ExcelImportParsed>;
  onConfirm: (payload: unknown) => void;
  isPending: boolean;
}

export default function ExcelImportDialog({
  open,
  onOpenChange,
  i18nPrefix,
  parse,
  onConfirm,
  isPending,
}: Props) {
  const { t } = useTranslation();
  const k = (suffix: string) => t(`${i18nPrefix}.${suffix}`);
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ExcelImportParsed | null>(null);

  const reset = () => {
    setParsing(false);
    setFileName(null);
    setParsed(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setParsing(true);
    setParsed(null);
    try {
      setParsed(await parse(file));
    } catch (e: any) {
      toast.error(e?.message ?? k("unreadable"));
      reset();
    } finally {
      setParsing(false);
    }
  };

  const handleConfirm = () => {
    if (!parsed || parsed.errors.length > 0) return;
    onConfirm(parsed.payload);
  };

  const hasErrors = (parsed?.errors.length ?? 0) > 0;
  const nothingToDo = parsed != null && parsed.summary.every((s) => s.count === 0);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{k("importTitle")}</DialogTitle>
          <DialogDescription>{k("importDesc")}</DialogDescription>
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

        {!parsed && (
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
              {parsing ? k("parsing") : fileName ?? k("chooseFile")}
            </span>
          </button>
        )}

        {parsed && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <FileSpreadsheet className="h-3.5 w-3.5" />
              {fileName}
            </div>

            <div className="flex flex-wrap gap-2">
              {parsed.summary.map((s, i) => (
                <Badge key={i} variant="secondary">
                  {s.label}
                </Badge>
              ))}
            </div>

            {hasErrors && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>
                  {t(`${i18nPrefix}.errorsTitle`, { count: parsed.errors.length })}
                </AlertTitle>
                <AlertDescription>
                  <ul className="mt-1 max-h-40 overflow-y-auto text-xs space-y-0.5 list-disc pl-4">
                    {parsed.errors.slice(0, 50).map((e, i) => (
                      <li key={i}>
                        <span className="font-medium">
                          {e.sheet}
                          {e.row > 0 ? ` · ${t(`${i18nPrefix}.rowLabel`, { row: e.row })}` : ""}
                        </span>{" "}
                        — {e.message}
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {!hasErrors && parsed.warnings.length > 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>
                  {t(`${i18nPrefix}.warningsTitle`, { count: parsed.warnings.length })}
                </AlertTitle>
                <AlertDescription>
                  <ul className="mt-1 max-h-32 overflow-y-auto text-xs space-y-0.5 list-disc pl-4">
                    {parsed.warnings.slice(0, 30).map((w, i) => (
                      <li key={i}>{w.message}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {!hasErrors && nothingToDo && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>{k("nothingToDo")}</AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {parsed && (
            <Button variant="ghost" onClick={reset} disabled={isPending}>
              {k("chooseAnother")}
            </Button>
          )}
          <Button
            onClick={handleConfirm}
            disabled={!parsed || hasErrors || nothingToDo || isPending}
            className="gap-1.5 bg-teal-600 hover:bg-teal-700 text-white"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {k("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
