import { useState, useMemo, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronRight as ChevronRightIcon,
  Trash2,
  Plus,
  Download,
  Upload,
  Link as LinkIcon,
} from "lucide-react";
import {
  KpiConfigItem,
  loadKpiConfig,
  saveKpiConfig,
  monthKey,
  shiftMonth,
  monthLabel,
  weeksInMonth,
  lastMonthlyTarget,
  lastWeeklyTarget,
} from "@/lib/kpiConfig";

export default function KpiConfig() {
  const [items, setItems] = useState<KpiConfigItem[]>(() => loadKpiConfig());
  const [selectedMonth, setSelectedMonth] = useState<string>(() => monthKey(new Date()));
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [sourceModalOpen, setSourceModalOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const weeks = useMemo(() => weeksInMonth(selectedMonth), [selectedMonth]);

  // Persist
  useEffect(() => {
    saveKpiConfig(items);
  }, [items]);

  // ----- mutations -----

  const setMonthlyTarget = (kpiId: string, value: number | null) => {
    setItems((prev) =>
      prev.map((k) => {
        if (k.id !== kpiId) return k;
        const monthly = { ...k.monthly_targets };
        const current = monthly[selectedMonth] || { target: 0, weekly_targets: {} };
        if (value === null) {
          const { [selectedMonth]: _, ...rest } = monthly;
          return { ...k, monthly_targets: rest };
        }
        // auto-recalc weekly defaults
        const perWeek = weeks.length > 0 ? value / weeks.length : 0;
        const wt: Record<string, number> = {};
        weeks.forEach((w) => {
          wt[w] = Math.round(perWeek * 100) / 100;
        });
        monthly[selectedMonth] = {
          target: value,
          weekly_targets: { ...wt, ...current.weekly_targets, ...(/* keep user-edited weeks if monthly unchanged? overwrite */ {}) },
        };
        // Actually: spec says "auto-recalculates when monthly target changes" → overwrite
        monthly[selectedMonth] = { target: value, weekly_targets: wt };
        return { ...k, monthly_targets: monthly };
      }),
    );
  };

  const setWeeklyTarget = (kpiId: string, week: string, value: number) => {
    setItems((prev) =>
      prev.map((k) => {
        if (k.id !== kpiId) return k;
        const monthly = { ...k.monthly_targets };
        const current = monthly[selectedMonth] || { target: 0, weekly_targets: {} };
        monthly[selectedMonth] = {
          ...current,
          weekly_targets: { ...current.weekly_targets, [week]: value },
        };
        return { ...k, monthly_targets: monthly };
      }),
    );
  };

  const handleBlurToast = () => toast.success("Sauvegardé ✓");

  const handleDelete = (id: string) => {
    setItems((prev) => prev.filter((k) => k.id !== id));
    toast.success("KPI supprimé");
  };

  const handleAdd = (category: "spa" | "manager" = "spa") => {
    const id = `k${Date.now()}`;
    setItems((prev) => [...prev, { id, name: "Nouveau KPI", unit: "", category, monthly_targets: {} }]);
    setExpanded((p) => ({ ...p, [id]: false }));
  };

  const updateMeta = (id: string, field: "name" | "unit", value: string) => {
    setItems((prev) => prev.map((k) => (k.id === id ? { ...k, [field]: value } : k)));
  };

  const updateCategory = (id: string, category: "spa" | "manager") => {
    setItems((prev) => prev.map((k) => (k.id === id ? { ...k, category } : k)));
  };


  // ----- export / import -----

  const handleExport = () => {
    const rows: any[] = [];
    items.forEach((k) => {
      const months = Object.keys(k.monthly_targets).sort();
      if (months.length === 0) {
        rows.push({ KPI: k.name, Unité: k.unit, Mois: "", "Objectif Mensuel": "" });
        return;
      }
      months.forEach((m) => {
        const mt = k.monthly_targets[m];
        const wk = weeksInMonth(m);
        const row: any = { KPI: k.name, Unité: k.unit, Mois: m, "Objectif Mensuel": mt.target };
        wk.forEach((w, i) => {
          row[`S${i + 1}`] = mt.weekly_targets[w] ?? "";
        });
        rows.push(row);
      });
    });
    const ws = XLSX.utils.json_to_sheet(rows, {
      header: ["KPI", "Unité", "Mois", "Objectif Mensuel", "S1", "S2", "S3", "S4", "S5"],
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "KPI");
    XLSX.writeFile(wb, `kpi-config-${monthKey(new Date())}.xlsx`);
    toast.success("Export Excel téléchargé");
  };

  const handleImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<any>(ws);
        const byName = new Map<string, KpiConfigItem>();
        rows.forEach((r) => {
          const name = String(r.KPI || "").trim();
          if (!name) return;
          let item = byName.get(name);
          if (!item) {
            item = {
              id: `k${Date.now()}-${byName.size}`,
              name,
              unit: String(r["Unité"] || ""),
              category: (String(r["Catégorie"] || "spa").toLowerCase() === "manager" ? "manager" : "spa"),
              monthly_targets: {},
            };
            byName.set(name, item);
          }
          const m = String(r.Mois || "").trim();
          if (!m) return;
          const wk = weeksInMonth(m);
          const weekly_targets: Record<string, number> = {};
          wk.forEach((w, i) => {
            const v = r[`S${i + 1}`];
            if (v !== "" && v != null && !isNaN(Number(v))) weekly_targets[w] = Number(v);
          });
          item.monthly_targets[m] = {
            target: Number(r["Objectif Mensuel"] || 0),
            weekly_targets,
          };
        });
        const next = Array.from(byName.values());
        setItems(next);
        toast.success(`${next.length} KPI importés`);
      } catch (err) {
        toast.error("Erreur lors de l'import — vérifier le format du fichier");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="max-w-[1100px] mx-auto px-6 py-6 pb-20">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">KPI — Objectifs mensuels & hebdo</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Définir les objectifs par mois et par semaine ISO
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExport}>
            <Download className="h-4 w-4" /> Exporter
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="h-4 w-4" /> Importer
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleImport(f);
              e.target.value = "";
            }}
          />
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-muted-foreground"
            onClick={() => setSourceModalOpen(true)}
          >
            <LinkIcon className="h-4 w-4" /> Connecter une source
          </Button>
        </div>
      </header>

      {/* Month selector */}
      <div className="flex items-center justify-center gap-3 mb-5">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => setSelectedMonth((m) => shiftMonth(m, -1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-base font-semibold capitalize min-w-[180px] text-center">
          {monthLabel(selectedMonth)}
        </div>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => setSelectedMonth((m) => shiftMonth(m, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Table */}
      <div className="border border-border rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted">
              <th className="text-left py-2.5 px-4 font-semibold">KPI</th>
              <th className="text-left py-2.5 px-4 font-semibold w-40">Objectif mensuel</th>
              <th className="text-left py-2.5 px-4 font-semibold w-24">Unité</th>
              <th className="text-left py-2.5 px-4 font-semibold w-48">Objectifs hebdo</th>
              <th className="w-12"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((k) => {
              const monthly = k.monthly_targets[selectedMonth];
              const monthlyValue = monthly?.target;
              const monthlyHint =
                monthlyValue == null ? lastMonthlyTarget(k, selectedMonth) : null;
              const isOpen = !!expanded[k.id];
              return (
                <KpiRow
                  key={k.id}
                  kpi={k}
                  weeks={weeks}
                  isOpen={isOpen}
                  onToggle={() => setExpanded((p) => ({ ...p, [k.id]: !p[k.id] }))}
                  monthly={monthly}
                  monthlyHint={monthlyHint}
                  onMonthlyChange={(v) => setMonthlyTarget(k.id, v)}
                  onWeeklyChange={(w, v) => setWeeklyTarget(k.id, w, v)}
                  onDelete={() => handleDelete(k.id)}
                  onUpdateMeta={(f, v) => updateMeta(k.id, f, v)}
                  onSaved={handleBlurToast}
                />
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-muted-foreground">
                  Aucun KPI. Cliquez sur "Ajouter un KPI" pour commencer.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4">
        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleAdd}>
          <Plus className="h-4 w-4" /> Ajouter un KPI
        </Button>
      </div>

      {/* Source modal */}
      <Dialog open={sourceModalOpen} onOpenChange={setSourceModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connecter une source externe</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Connexion à une source externe (Excel Online, Google Sheets…) — disponible
            prochainement.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSourceModalOpen(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ----- Row -----

interface RowProps {
  kpi: KpiConfigItem;
  weeks: string[];
  isOpen: boolean;
  onToggle: () => void;
  monthly: { target: number; weekly_targets: Record<string, number> } | undefined;
  monthlyHint: { month: string; value: number } | null;
  onMonthlyChange: (v: number | null) => void;
  onWeeklyChange: (week: string, v: number) => void;
  onDelete: () => void;
  onUpdateMeta: (field: "name" | "unit", value: string) => void;
  onSaved: () => void;
}

function KpiRow({
  kpi,
  weeks,
  isOpen,
  onToggle,
  monthly,
  monthlyHint,
  onMonthlyChange,
  onWeeklyChange,
  onDelete,
  onUpdateMeta,
  onSaved,
}: RowProps) {
  const [monthlyDraft, setMonthlyDraft] = useState<string>(
    monthly?.target != null ? String(monthly.target) : "",
  );

  useEffect(() => {
    setMonthlyDraft(monthly?.target != null ? String(monthly.target) : "");
  }, [monthly?.target]);

  return (
    <>
      <tr className="border-t border-border">
        <td className="py-2 px-4">
          <Input
            value={kpi.name}
            onChange={(e) => onUpdateMeta("name", e.target.value)}
            onBlur={onSaved}
            className="h-8 text-sm border-transparent hover:border-input focus-visible:border-input"
          />
        </td>
        <td className="py-2 px-4">
          <Input
            type="number"
            value={monthlyDraft}
            placeholder={monthlyHint ? String(monthlyHint.value) : "—"}
            onChange={(e) => setMonthlyDraft(e.target.value)}
            onBlur={() => {
              if (monthlyDraft === "") {
                onMonthlyChange(null);
              } else {
                onMonthlyChange(Number(monthlyDraft));
              }
              onSaved();
            }}
            className="h-8 text-sm"
          />
          {monthlyValueIsInherited(monthly, monthlyHint) && (
            <p className="text-[10px] italic text-muted-foreground mt-0.5">
              Dernière valeur : {monthlyHint!.value}
            </p>
          )}
        </td>
        <td className="py-2 px-4">
          <Input
            value={kpi.unit}
            onChange={(e) => onUpdateMeta("unit", e.target.value)}
            onBlur={onSaved}
            className="h-8 text-sm w-20"
          />
        </td>
        <td className="py-2 px-4">
          <button
            onClick={onToggle}
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            {isOpen ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRightIcon className="h-3 w-3" />
            )}
            {isOpen ? "Masquer objectifs hebdo" : "Voir objectifs hebdo"}
          </button>
        </td>
        <td className="py-2 px-2 text-right">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </td>
      </tr>
      {isOpen && (
        <tr className="border-t border-border bg-muted/30">
          <td colSpan={5} className="py-3 px-4">
            <div className="flex flex-wrap gap-3">
              {weeks.map((w, i) => (
                <WeekInput
                  key={w}
                  label={`S${i + 1}`}
                  isoWeek={w}
                  kpi={kpi}
                  monthly={monthly}
                  onChange={(v) => onWeeklyChange(w, v)}
                  onSaved={onSaved}
                />
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function monthlyValueIsInherited(
  monthly: { target: number } | undefined,
  hint: { value: number } | null,
): boolean {
  return monthly == null && hint != null;
}

function WeekInput({
  label,
  isoWeek,
  kpi,
  monthly,
  onChange,
  onSaved,
}: {
  label: string;
  isoWeek: string;
  kpi: KpiConfigItem;
  monthly: { target: number; weekly_targets: Record<string, number> } | undefined;
  onChange: (v: number) => void;
  onSaved: () => void;
}) {
  const stored = monthly?.weekly_targets[isoWeek];
  const hint = stored == null ? lastWeeklyTarget(kpi, isoWeek) : null;
  const [draft, setDraft] = useState<string>(stored != null ? String(stored) : "");

  useEffect(() => {
    setDraft(stored != null ? String(stored) : "");
  }, [stored]);

  return (
    <div className="flex flex-col">
      <label className="text-[11px] text-muted-foreground mb-0.5">
        {label} <span className="text-muted-foreground/60">({isoWeek.slice(-3)})</span>
      </label>
      <Input
        type="number"
        value={draft}
        placeholder={hint ? String(hint.value) : "—"}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft !== "") {
            onChange(Number(draft));
            onSaved();
          }
        }}
        className="h-8 text-sm w-24"
      />
      {stored == null && hint && (
        <p className="text-[10px] italic text-muted-foreground mt-0.5">
          Dernière : {hint.value}
        </p>
      )}
    </div>
  );
}
