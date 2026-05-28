import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  ArrowUpNarrowWide,
  ArrowDownNarrowWide,
  ChevronLeft,
  ChevronRight,
  Settings2,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  useAllKpiDefinitions,
  useAddKpiDefinition,
  useUpdateKpiDefinition,
  useSoftDeleteKpiDefinition,
  type KpiCategoryDb,
  type ComparisonDirection,
  type KpiDefinitionFull,
} from "@/hooks/useKpiConfig";
import {
  useKpiMonthlyTargets,
  useUpsertKpiMonthlyTarget,
  getWeeklyTarget,
  getPrevYearMonth,
  type KpiMonthlyTarget,
  type WeeklyMode,
} from "@/hooks/useKpiMonthlyTargets";

const UNIT_OPTIONS = ["€", "%", "nb", "/10", "j", "pts"] as const;
const CATEGORY_LABELS: Record<KpiCategoryDb, string> = {
  financial: "Financier",
  operational: "Opérationnel",
  customer: "Client",
  hr: "RH",
  custom: "Autre",
};

type KpiGroup = "spa" | "manager";

export default function KpiConfig() {
  const { user, userRole, spaId: authSpaId } = useAuth();
  const [adminSpaId, setAdminSpaId] = useState<string | null>(null);
  const [yearMonth, setYearMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const spaId = userRole === "admin" ? adminSpaId : authSpaId;

  const { data: spas } = useQuery({
    queryKey: ["spas_list_admin"],
    enabled: userRole === "admin",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("spas")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: items = [], isLoading } = useAllKpiDefinitions(spaId);
  const addMut = useAddKpiDefinition();
  const updateMut = useUpdateKpiDefinition();
  const deleteMut = useSoftDeleteKpiDefinition();
  const { currentMap, previousMap, isLoading: targetsLoading } = useKpiMonthlyTargets(
    spaId,
    yearMonth,
  );
  const upsertMut = useUpsertKpiMonthlyTarget();

  const [addOpen, setAddOpen] = useState(false);
  const [settingsKpi, setSettingsKpi] = useState<KpiDefinitionFull | null>(null);

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => a.display_order - b.display_order),
    [items],
  );

  const spaKpis = sortedItems.filter((k) => (k.kpi_group ?? "spa") === "spa");
  const managerKpis = sortedItems.filter((k) => (k.kpi_group ?? "spa") === "manager");

  const handleUpdate = (id: string, fields: Partial<KpiDefinitionFull>, toastIt = true) => {
    if (!spaId) return;
    updateMut.mutate(
      { id, spaId, ...fields } as any,
      {
        onSuccess: () => toastIt && toast.success("Sauvegardé ✓"),
        onError: (e: any) => toast.error(e?.message ?? "Erreur"),
      },
    );
  };

  const handleSwap = (list: KpiDefinitionFull[], idx: number, dir: -1 | 1) => {
    const a = list[idx];
    const b = list[idx + dir];
    if (!a || !b || !spaId) return;
    updateMut.mutate({ id: a.id, spaId, display_order: b.display_order });
    updateMut.mutate({ id: b.id, spaId, display_order: a.display_order });
  };

  const handlePrevMonth = () => setYearMonth(getPrevYearMonth(yearMonth));
  const handleNextMonth = () => {
    const [y, m] = yearMonth.split("-").map(Number);
    setYearMonth(m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`);
  };

  const monthLabel = format(parseISO(`${yearMonth}-01`), "MMMM yyyy", { locale: fr });
  const monthLabelCap = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  const renderSectionRows = (label: string, list: KpiDefinitionFull[]) => (
    <>
      <tr className="bg-muted/30 border-t border-border">
        <td
          colSpan={9}
          className="py-2 px-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground"
        >
          {label}
        </td>
      </tr>
      {list.length === 0 ? (
        <tr>
          <td colSpan={9} className="py-3 px-3 text-sm text-muted-foreground italic">
            Aucun KPI dans ce groupe.
          </td>
        </tr>
      ) : (
        list.map((k, idx) => (
          <UnifiedKpiRow
            key={k.id}
            kpi={k}
            spaId={spaId!}
            yearMonth={yearMonth}
            current={currentMap.get(k.id)}
            previous={previousMap.get(k.id)}
            isFirst={idx === 0}
            isLast={idx === list.length - 1}
            onUpdate={(fields, toastIt) => handleUpdate(k.id, fields, toastIt)}
            onMoveUp={() => handleSwap(list, idx, -1)}
            onMoveDown={() => handleSwap(list, idx, 1)}
            onOpenSettings={() => setSettingsKpi(k)}
            onDelete={() =>
              deleteMut.mutate(
                { id: k.id, spaId: spaId! },
                {
                  onSuccess: () => toast.success("KPI désactivé"),
                  onError: (e: any) => toast.error(e?.message ?? "Erreur"),
                },
              )
            }
            upsertMut={upsertMut}
          />
        ))
      )}
    </>
  );

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-6 pb-20">
      <header className="flex justify-between items-start gap-4 mb-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Configuration des KPI</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Définir et planifier les KPI de votre spa
          </p>
        </div>
        <div className="flex items-center gap-2">
          {userRole === "admin" && (
            <Select value={adminSpaId ?? ""} onValueChange={(v) => setAdminSpaId(v || null)}>
              <SelectTrigger className="w-56 h-9">
                <SelectValue placeholder="Sélectionner un spa" />
              </SelectTrigger>
              <SelectContent>
                {(spas ?? []).map((s: any) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button
            size="sm"
            className="gap-1.5 bg-teal-600 hover:bg-teal-700 text-white"
            onClick={() => setAddOpen(true)}
            disabled={!spaId}
          >
            <Plus className="h-4 w-4" /> Ajouter un KPI
          </Button>
        </div>
      </header>

      <div className="bg-muted/40 border border-border rounded-lg py-2.5 px-5 flex items-center justify-between mb-4">
        <span className="text-xs text-muted-foreground">Objectifs du mois</span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={handlePrevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold min-w-[160px] text-center">{monthLabelCap}</span>
          <Button variant="ghost" size="icon" onClick={handleNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <span className="text-xs text-muted-foreground italic">Sauvegarde automatique</span>
      </div>

      {!spaId ? (
        <div className="border border-border rounded-xl p-12 text-center text-muted-foreground">
          Sélectionner un spa
        </div>
      ) : isLoading || targetsLoading ? (
        <div className="border border-border rounded-xl p-12 text-center text-muted-foreground">
          Chargement…
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-muted/60">
              <tr>
                <th className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground" style={{ width: "35%" }}>Nom</th>
                <th className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground" style={{ width: "72px" }}>Unité</th>
                <th className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground" style={{ width: "96px" }}>Groupe</th>
                <th className="text-center py-2.5 px-3 text-xs font-semibold text-muted-foreground" style={{ width: "52px" }}>Actif</th>
                <th className="p-0 bg-border" style={{ width: "1px" }} />
                <th className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground" style={{ width: "110px" }}>Mensuel</th>
                <th className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground" style={{ width: "88px" }}>Mode</th>
                <th className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground" style={{ width: "120px" }}>Hebdo</th>
                <th className="text-right py-2.5 px-3 text-xs font-semibold text-muted-foreground" style={{ width: "116px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {renderSectionRows("KPI Spa", spaKpis)}
              {renderSectionRows("KPI Manager", managerKpis)}
            </tbody>
          </table>
        </div>
      )}

      <AddKpiDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSubmit={(payload) => {
          if (!spaId || !user) return;
          addMut.mutate(
            {
              spaId,
              created_by: user.id,
              display_order: sortedItems.length,
              threshold_amber: null,
              threshold_red: null,
              ...payload,
            },
            {
              onSuccess: () => {
                toast.success("KPI ajouté ✓");
                setAddOpen(false);
              },
              onError: (e: any) => toast.error(e?.message ?? "Erreur"),
            },
          );
        }}
      />

      <SettingsDialog
        kpi={settingsKpi}
        onClose={() => setSettingsKpi(null)}
        onSave={(fields) => {
          if (!settingsKpi) return;
          handleUpdate(settingsKpi.id, fields, true);
          setSettingsKpi(null);
        }}
      />
    </div>
  );
}


// ----- Unified row -----

interface UnifiedKpiRowProps {
  kpi: KpiDefinitionFull;
  spaId: string;
  yearMonth: string;
  current: KpiMonthlyTarget | undefined;
  previous: KpiMonthlyTarget | undefined;
  isFirst: boolean;
  isLast: boolean;
  onUpdate: (fields: Partial<KpiDefinitionFull>, toastIt?: boolean) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onOpenSettings: () => void;
  onDelete: () => void;
  upsertMut: ReturnType<typeof useUpsertKpiMonthlyTarget>;
}

function UnifiedKpiRow({
  kpi,
  spaId,
  yearMonth,
  current,
  previous,
  isFirst,
  isLast,
  onUpdate,
  onMoveUp,
  onMoveDown,
  onOpenSettings,
  onDelete,
  upsertMut,
}: UnifiedKpiRowProps) {
  const [name, setName] = useState(kpi.name);
  const [monthlyLocal, setMonthlyLocal] = useState<string>(
    current?.monthly_value != null ? String(current.monthly_value) : "",
  );
  const [overrideLocal, setOverrideLocal] = useState<string>(
    current?.weekly_override != null ? String(current.weekly_override) : "",
  );

  useEffect(() => setName(kpi.name), [kpi.name]);

  useEffect(() => {
    setMonthlyLocal(current?.monthly_value != null ? String(current.monthly_value) : "");
    setOverrideLocal(current?.weekly_override != null ? String(current.weekly_override) : "");
  }, [yearMonth, current?.monthly_value, current?.weekly_override]);

  const disabled = current?.monthly_value == null;
  const computed = getWeeklyTarget(current);
  const onError = (e: any) => toast.error(e?.message ?? "Erreur de sauvegarde");

  const handleMonthlyBlur = () => {
    const newVal = monthlyLocal === "" ? null : Number(monthlyLocal);
    if (newVal === (current?.monthly_value ?? null)) return;
    upsertMut.mutate(
      {
        spa_id: spaId,
        kpi_definition_id: kpi.id,
        year_month: yearMonth,
        monthly_value: newVal,
        weekly_mode: current?.weekly_mode ?? "divide",
        weekly_override: current?.weekly_override ?? null,
      },
      { onError },
    );
  };

  const handleModeChange = (newMode: WeeklyMode) => {
    upsertMut.mutate(
      {
        spa_id: spaId,
        kpi_definition_id: kpi.id,
        year_month: yearMonth,
        monthly_value: current?.monthly_value ?? null,
        weekly_mode: newMode,
        weekly_override: null,
      },
      { onError },
    );
  };

  const handleOverrideBlur = () => {
    const val = Number(overrideLocal);
    const isDefault = overrideLocal === "" || (computed !== null && val === computed);
    const newOverride = isDefault ? null : val;
    if (newOverride === (current?.weekly_override ?? null)) return;
    upsertMut.mutate(
      {
        spa_id: spaId,
        kpi_definition_id: kpi.id,
        year_month: yearMonth,
        monthly_value: current?.monthly_value ?? null,
        weekly_mode: current?.weekly_mode ?? "divide",
        weekly_override: newOverride,
      },
      { onError },
    );
  };

  const showPrevHint = !current && previous?.monthly_value != null;

  return (
    <tr
      className={`border-b border-border last:border-0 transition-colors hover:bg-muted/20 ${
        kpi.is_active ? "" : "opacity-40"
      }`}
    >
      <td className="py-2 px-3">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            if (name !== kpi.name) onUpdate({ name });
          }}
          className="h-8 text-sm w-full"
        />
      </td>

      <td className="py-2 px-3">
        <Select value={kpi.unit ?? ""} onValueChange={(v) => onUpdate({ unit: v })}>
          <SelectTrigger className="h-8 text-sm w-full">
            <SelectValue placeholder="—" />
          </SelectTrigger>
          <SelectContent>
            {UNIT_OPTIONS.map((u) => (
              <SelectItem key={u} value={u}>
                {u}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>

      <td className="py-2 px-3">
        <Select
          value={(kpi.kpi_group ?? "spa") as KpiGroup}
          onValueChange={(v) => onUpdate({ kpi_group: v as KpiGroup })}
        >
          <SelectTrigger className="h-8 text-sm w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="spa">Spa</SelectItem>
            <SelectItem value="manager">Manager</SelectItem>
          </SelectContent>
        </Select>
      </td>

      <td className="py-2 px-3 text-center">
        <Switch checked={kpi.is_active} onCheckedChange={(v) => onUpdate({ is_active: v })} />
      </td>

      <td className="p-0 bg-border" />

      <td className="py-2 px-3">
        <div>
          <Input
            type="number"
            className={`h-8 text-sm w-full ${
              !current && !showPrevHint ? "border-dashed border-border/60 bg-muted/20" : ""
            }`}
            value={monthlyLocal}
            placeholder={showPrevHint ? String(previous!.monthly_value) : "—"}
            onChange={(e) => setMonthlyLocal(e.target.value)}
            onBlur={handleMonthlyBlur}
          />
          {showPrevHint && (
            <p className="text-[10px] text-muted-foreground italic mt-0.5">
              M-1 : {previous!.monthly_value}
            </p>
          )}
        </div>
      </td>

      <td className="py-2 px-3">
        <Select
          value={current?.weekly_mode ?? "divide"}
          onValueChange={(v) => handleModeChange(v as WeeklyMode)}
          disabled={disabled}
        >
          <SelectTrigger className="h-8 text-sm w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="divide">÷ 4</SelectItem>
            <SelectItem value="fixed">Fixe</SelectItem>
          </SelectContent>
        </Select>
      </td>

      <td className="py-2 px-3">
        <div className="relative">
          <Input
            type="number"
            className="h-8 text-sm w-full pr-12"
            value={overrideLocal}
            placeholder={computed != null ? String(Math.round(computed * 100) / 100) : "—"}
            disabled={disabled}
            onChange={(e) => setOverrideLocal(e.target.value)}
            onBlur={handleOverrideBlur}
          />
          {current?.weekly_override != null && (
            <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] font-medium text-teal-700 bg-teal-50 rounded px-1 py-0.5 pointer-events-none">
              Manuel
            </span>
          )}
        </div>
      </td>

      <td className="py-2 px-3">
        <div className="flex items-center justify-end gap-0.5">
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={onOpenSettings}>
            <Settings2 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onMoveUp} disabled={isFirst}>
            <ArrowUp className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onMoveDown} disabled={isLast}>
            <ArrowDown className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  );
}



// ----- Settings dialog -----

function SettingsDialog({
  kpi,
  onClose,
  onSave,
}: {
  kpi: KpiDefinitionFull | null;
  onClose: () => void;
  onSave: (fields: Partial<KpiDefinitionFull>) => void;
}) {
  const [category, setCategory] = useState<KpiCategoryDb>("operational");
  const [direction, setDirection] = useState<ComparisonDirection>("higher_is_better");
  const [amber, setAmber] = useState("");
  const [red, setRed] = useState("");

  useEffect(() => {
    if (kpi) {
      setCategory(kpi.category);
      setDirection(kpi.comparison_direction);
      setAmber(kpi.threshold_amber != null ? String(kpi.threshold_amber) : "");
      setRed(kpi.threshold_red != null ? String(kpi.threshold_red) : "");
    }
  }, [kpi]);

  return (
    <Dialog open={!!kpi} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Paramètres — {kpi?.name}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Catégorie</label>
            <Select value={category} onValueChange={(v) => setCategory(v as KpiCategoryDb)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(CATEGORY_LABELS) as KpiCategoryDb[]).map((c) => (
                  <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Direction</label>
            <button
              onClick={() =>
                setDirection(direction === "higher_is_better" ? "lower_is_better" : "higher_is_better")
              }
              className="text-xs font-medium px-3 py-1.5 rounded-md bg-muted hover:bg-muted/70 inline-flex items-center gap-1.5"
            >
              {direction === "higher_is_better" ? (
                <><ArrowUpNarrowWide className="h-3.5 w-3.5" /> Plus = mieux</>
              ) : (
                <><ArrowDownNarrowWide className="h-3.5 w-3.5" /> Moins = mieux</>
              )}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Seuil vert</label>
              <Input type="number" value={amber} onChange={(e) => setAmber(e.target.value)} placeholder="—" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Seuil rouge</label>
              <Input type="number" value={red} onChange={(e) => setRed(e.target.value)} placeholder="—" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button
            className="bg-teal-600 hover:bg-teal-700 text-white"
            onClick={() =>
              onSave({
                category,
                comparison_direction: direction,
                threshold_amber: amber === "" ? null : Number(amber),
                threshold_red: red === "" ? null : Number(red),
              })
            }
          >
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ----- Add dialog -----

interface AddKpiPayload {
  name: string;
  unit: string | null;
  category: KpiCategoryDb;
  kpi_group: KpiGroup;
  comparison_direction: ComparisonDirection;
}

function AddKpiDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (payload: AddKpiPayload) => void;
}) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState<string>("");
  const [category, setCategory] = useState<KpiCategoryDb>("operational");
  const [group, setGroup] = useState<KpiGroup>("spa");
  const [direction, setDirection] = useState<ComparisonDirection>("higher_is_better");

  const reset = () => {
    setName("");
    setUnit("");
    setCategory("operational");
    setGroup("spa");
    setDirection("higher_is_better");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter un KPI</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Nom *</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="CA Global" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Unité</label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {UNIT_OPTIONS.map((u) => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Groupe</label>
              <Select value={group} onValueChange={(v) => setGroup(v as KpiGroup)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="spa">KPI Spa</SelectItem>
                  <SelectItem value="manager">KPI Manager</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Catégorie</label>
            <Select value={category} onValueChange={(v) => setCategory(v as KpiCategoryDb)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(CATEGORY_LABELS) as KpiCategoryDb[]).map((c) => (
                  <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Direction</label>
            <button
              onClick={() =>
                setDirection(direction === "higher_is_better" ? "lower_is_better" : "higher_is_better")
              }
              className="text-xs font-medium px-3 py-1.5 rounded-md bg-muted hover:bg-muted/70 inline-flex items-center gap-1.5"
            >
              {direction === "higher_is_better" ? (
                <><ArrowUpNarrowWide className="h-3.5 w-3.5" /> Plus = mieux</>
              ) : (
                <><ArrowDownNarrowWide className="h-3.5 w-3.5" /> Moins = mieux</>
              )}
            </button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button
            className="bg-teal-600 hover:bg-teal-700 text-white"
            disabled={!name.trim()}
            onClick={() =>
              onSubmit({
                name: name.trim(),
                unit: unit || null,
                category,
                kpi_group: group,
                comparison_direction: direction,
              })
            }
          >
            Ajouter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
