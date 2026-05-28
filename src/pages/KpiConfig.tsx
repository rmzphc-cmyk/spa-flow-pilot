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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

const SPA_CATEGORIES: KpiCategoryDb[] = ["financial", "operational", "customer"];
const MANAGER_CATEGORIES: KpiCategoryDb[] = ["hr", "custom"];

export default function KpiConfig() {
  const { user, userRole, spaId: authSpaId } = useAuth();
  const [adminSpaId, setAdminSpaId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"definitions" | "objectives">("definitions");
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

  const [addOpen, setAddOpen] = useState(false);

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => a.display_order - b.display_order),
    [items],
  );

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

  const handleSwap = (idx: number, dir: -1 | 1) => {
    const a = sortedItems[idx];
    const b = sortedItems[idx + dir];
    if (!a || !b || !spaId) return;
    updateMut.mutate({ id: a.id, spaId, display_order: b.display_order });
    updateMut.mutate({ id: b.id, spaId, display_order: a.display_order });
  };

  const handlePrevMonth = () => setYearMonth(getPrevYearMonth(yearMonth));
  const handleNextMonth = () => {
    const [y, m] = yearMonth.split("-").map(Number);
    setYearMonth(m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`);
  };

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-6 pb-20">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">Configuration des KPI</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Définir les KPI suivis par votre spa
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
          {activeTab === "definitions" && (
            <Button
              size="sm"
              className="gap-1.5 bg-teal-600 hover:bg-teal-700 text-white"
              onClick={() => setAddOpen(true)}
              disabled={!spaId}
            >
              <Plus className="h-4 w-4" /> Ajouter un KPI
            </Button>
          )}
        </div>
      </header>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "definitions" | "objectives")}>
        <TabsList className="mb-4">
          <TabsTrigger value="definitions">Définitions</TabsTrigger>
          <TabsTrigger value="objectives">Objectifs</TabsTrigger>
        </TabsList>

        <TabsContent value="definitions">
          {!spaId ? (
            <div className="border border-border rounded-xl p-12 text-center text-muted-foreground">
              Sélectionner un spa pour configurer ses KPI
            </div>
          ) : isLoading ? (
            <div className="border border-border rounded-xl p-12 text-center text-muted-foreground">
              Chargement…
            </div>
          ) : (
            <div className="border border-border rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted">
                    <th className="text-left py-2.5 px-3 font-semibold">Nom</th>
                    <th className="text-left py-2.5 px-3 font-semibold w-24">Unité</th>
                    <th className="text-left py-2.5 px-3 font-semibold w-36">Catégorie</th>
                    <th className="text-left py-2.5 px-3 font-semibold w-28">Objectif</th>
                    <th className="text-left py-2.5 px-3 font-semibold w-28">Seuil rouge</th>
                    <th className="text-left py-2.5 px-3 font-semibold w-40">Direction</th>
                    <th className="text-left py-2.5 px-3 font-semibold w-16">Actif</th>
                    <th className="text-left py-2.5 px-3 font-semibold w-28">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedItems.map((k, idx) => (
                    <KpiRow
                      key={k.id}
                      kpi={k}
                      isFirst={idx === 0}
                      isLast={idx === sortedItems.length - 1}
                      onUpdate={(fields, toastIt) => handleUpdate(k.id, fields, toastIt)}
                      onMoveUp={() => handleSwap(idx, -1)}
                      onMoveDown={() => handleSwap(idx, 1)}
                      onDelete={() => {
                        deleteMut.mutate(
                          { id: k.id, spaId: spaId! },
                          {
                            onSuccess: () => toast.success("KPI désactivé"),
                            onError: (e: any) => toast.error(e?.message ?? "Erreur"),
                          },
                        );
                      }}
                    />
                  ))}
                  {sortedItems.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-muted-foreground">
                        Aucun KPI configuré pour ce spa.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="objectives">
          <ObjectivesTab
            spaId={spaId}
            yearMonth={yearMonth}
            onPrev={handlePrevMonth}
            onNext={handleNextMonth}
            activeKpis={sortedItems.filter((k) => k.is_active)}
            definitionsLoading={isLoading}
          />
        </TabsContent>
      </Tabs>

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
    </div>
  );
}

// ----- Objectives Tab -----

interface ObjectivesTabProps {
  spaId: string | null;
  yearMonth: string;
  onPrev: () => void;
  onNext: () => void;
  activeKpis: KpiDefinitionFull[];
  definitionsLoading: boolean;
}

function ObjectivesTab({
  spaId,
  yearMonth,
  onPrev,
  onNext,
  activeKpis,
  definitionsLoading,
}: ObjectivesTabProps) {
  const { currentMap, previousMap, isLoading } = useKpiMonthlyTargets(spaId, yearMonth);
  const upsertMut = useUpsertKpiMonthlyTarget();

  const monthLabel = format(parseISO(`${yearMonth}-01`), "MMMM yyyy", { locale: fr });
  const monthLabelCap = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  const spaKpis = activeKpis.filter((k) => SPA_CATEGORIES.includes(k.category));
  const managerKpis = activeKpis.filter((k) => MANAGER_CATEGORIES.includes(k.category));

  const navigator = (
    <div className="flex items-center justify-center gap-3 mb-6">
      <Button variant="ghost" size="icon" onClick={onPrev}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="text-sm font-semibold min-w-[140px] text-center">{monthLabelCap}</span>
      <Button variant="ghost" size="icon" onClick={onNext}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );

  if (!spaId) {
    return (
      <div className="border border-border rounded-xl p-12 text-center text-muted-foreground">
        Sélectionner un spa pour configurer ses objectifs
      </div>
    );
  }

  if (definitionsLoading || isLoading) {
    return (
      <>
        {navigator}
        <div className="border border-border rounded-xl p-12 text-center text-muted-foreground">
          Chargement…
        </div>
      </>
    );
  }

  if (activeKpis.length === 0) {
    return (
      <>
        {navigator}
        <div className="border border-border rounded-xl p-12 text-center text-muted-foreground">
          Aucun KPI configuré. Ajouter des KPI dans l'onglet Définitions.
        </div>
      </>
    );
  }

  const renderGroup = (label: string, kpis: KpiDefinitionFull[], isFirst: boolean) => {
    if (kpis.length === 0) return null;
    return (
      <div key={label} className={isFirst ? "" : "border-t border-border pt-4 mt-2"}>
        <h3 className="text-sm font-semibold text-muted-foreground mb-2">{label}</h3>
        <div className="divide-y divide-border">
          {kpis.map((k) => (
            <ObjectiveRow
              key={k.id}
              kpi={k}
              spaId={spaId}
              yearMonth={yearMonth}
              current={currentMap.get(k.id)}
              previous={previousMap.get(k.id)}
              upsertMut={upsertMut}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="border border-border rounded-xl p-6 shadow-sm">
      {navigator}
      {renderGroup("KPI Spa", spaKpis, true)}
      {renderGroup("KPI Manager", managerKpis, spaKpis.length === 0)}
    </div>
  );
}

interface ObjectiveRowProps {
  kpi: KpiDefinitionFull;
  spaId: string;
  yearMonth: string;
  current: KpiMonthlyTarget | undefined;
  previous: KpiMonthlyTarget | undefined;
  upsertMut: ReturnType<typeof useUpsertKpiMonthlyTarget>;
}

function ObjectiveRow({ kpi, spaId, yearMonth, current, previous, upsertMut }: ObjectiveRowProps) {
  const [monthlyLocal, setMonthlyLocal] = useState<string>(
    current?.monthly_value != null ? String(current.monthly_value) : "",
  );
  const [overrideLocal, setOverrideLocal] = useState<string>(
    current?.weekly_override != null ? String(current.weekly_override) : "",
  );

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
    <div className="flex flex-row items-center gap-4 py-2.5">
      <div className="flex-1 min-w-0 text-sm">
        {kpi.name}
        {kpi.unit ? <span className="text-muted-foreground"> ({kpi.unit})</span> : null}
      </div>
      <div className="w-32">
        <Input
          type="number"
          className="h-9 text-sm w-32"
          value={monthlyLocal}
          placeholder={showPrevHint ? String(previous!.monthly_value) : "—"}
          onChange={(e) => setMonthlyLocal(e.target.value)}
          onBlur={handleMonthlyBlur}
        />
        {showPrevHint && (
          <div className="text-[10px] text-muted-foreground mt-0.5">
            M-1 : {previous!.monthly_value}
          </div>
        )}
      </div>
      <div className="w-28">
        <Select
          value={current?.weekly_mode ?? "divide"}
          onValueChange={(v) => handleModeChange(v as WeeklyMode)}
          disabled={disabled}
        >
          <SelectTrigger className="h-9 text-sm w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="divide">÷ 4</SelectItem>
            <SelectItem value="fixed">Fixe</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="w-32 flex items-center gap-1.5">
        <Input
          type="number"
          className="h-9 text-sm w-32"
          value={overrideLocal}
          placeholder={computed !== null ? String(Math.round(computed * 100) / 100) : "—"}
          disabled={disabled}
          onChange={(e) => setOverrideLocal(e.target.value)}
          onBlur={handleOverrideBlur}
        />
        {current?.weekly_override != null && (
          <span className="text-teal-600 text-xs">Manuel</span>
        )}
      </div>
    </div>
  );
}

// ----- Row -----

interface RowProps {
  kpi: KpiDefinitionFull;
  isFirst: boolean;
  isLast: boolean;
  onUpdate: (fields: Partial<KpiDefinitionFull>, toastIt?: boolean) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}

function KpiRow({ kpi, isFirst, isLast, onUpdate, onMoveUp, onMoveDown, onDelete }: RowProps) {
  const [name, setName] = useState(kpi.name);
  const [amber, setAmber] = useState(kpi.threshold_amber != null ? String(kpi.threshold_amber) : "");
  const [red, setRed] = useState(kpi.threshold_red != null ? String(kpi.threshold_red) : "");

  return (
    <tr className="border-t border-border">
      <td className="py-2 px-3">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            if (name !== kpi.name) onUpdate({ name });
          }}
          className="h-8 text-sm"
        />
      </td>
      <td className="py-2 px-3">
        <Select
          value={kpi.unit ?? ""}
          onValueChange={(v) => onUpdate({ unit: v })}
        >
          <SelectTrigger className="h-8 text-sm">
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
          value={kpi.category}
          onValueChange={(v) => onUpdate({ category: v as KpiCategoryDb })}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(CATEGORY_LABELS) as KpiCategoryDb[]).map((c) => (
              <SelectItem key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="py-2 px-3">
        <Input
          type="number"
          value={amber}
          onChange={(e) => setAmber(e.target.value)}
          onBlur={() => {
            const v = amber === "" ? null : Number(amber);
            if (v !== kpi.threshold_amber) onUpdate({ threshold_amber: v });
          }}
          placeholder="—"
          className="h-8 text-sm"
        />
      </td>
      <td className="py-2 px-3">
        <Input
          type="number"
          value={red}
          onChange={(e) => setRed(e.target.value)}
          onBlur={() => {
            const v = red === "" ? null : Number(red);
            if (v !== kpi.threshold_red) onUpdate({ threshold_red: v });
          }}
          placeholder="—"
          className="h-8 text-sm"
        />
      </td>
      <td className="py-2 px-3">
        <button
          onClick={() =>
            onUpdate({
              comparison_direction:
                kpi.comparison_direction === "higher_is_better"
                  ? "lower_is_better"
                  : "higher_is_better",
            })
          }
          className="text-xs font-medium px-2 py-1 rounded-md bg-muted hover:bg-muted/70 inline-flex items-center gap-1"
          title="Cliquer pour basculer"
        >
          {kpi.comparison_direction === "higher_is_better" ? (
            <>
              <ArrowUpNarrowWide className="h-3.5 w-3.5" /> Plus = mieux
            </>
          ) : (
            <>
              <ArrowDownNarrowWide className="h-3.5 w-3.5" /> Moins = mieux
            </>
          )}
        </button>
      </td>
      <td className="py-2 px-3">
        <Switch
          checked={kpi.is_active}
          onCheckedChange={(v) => onUpdate({ is_active: v })}
        />
      </td>
      <td className="py-2 px-3">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onMoveUp} disabled={isFirst}>
            <ArrowUp className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onMoveDown} disabled={isLast}>
            <ArrowDown className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

// ----- Add dialog -----

interface AddKpiPayload {
  name: string;
  unit: string | null;
  category: KpiCategoryDb;
  threshold_amber: number | null;
  threshold_red: number | null;
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
  const [amber, setAmber] = useState("");
  const [red, setRed] = useState("");
  const [direction, setDirection] = useState<ComparisonDirection>("higher_is_better");

  const reset = () => {
    setName("");
    setUnit("");
    setCategory("operational");
    setAmber("");
    setRed("");
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
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Objectif</label>
              <Input type="number" value={amber} onChange={(e) => setAmber(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Seuil rouge</label>
              <Input type="number" value={red} onChange={(e) => setRed(e.target.value)} placeholder="—" />
            </div>
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
                threshold_amber: amber === "" ? null : Number(amber),
                threshold_red: red === "" ? null : Number(red),
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
