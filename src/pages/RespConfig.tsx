import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Zap, CalendarClock, ChevronLeft, ChevronRight } from "lucide-react";
import {
  loadSchedule,
  saveSchedule,
  describeSchedule,
  DAY_LABELS_FR,
  WEEK_LABELS_FR,
  type MeetingSchedule,
} from "@/lib/meetingSchedule";
import { monthKey, shiftMonth, monthLabel } from "@/lib/kpiConfig";

// --- Types ---

type Frequency = "daily" | "weekly" | "biweekly" | "monthly" | "quarterly";
type SaisieMode = "numeric" | "qualitative";

interface RespTemplate {
  id: string;
  name: string;
  description: string;
  frequency: Frequency;
  expectedQty: number;
  category: string;
  conditional: boolean;
  conditionText: string;
  saisieMode: SaisieMode;
  active: boolean;
}

interface SpaAssignment {
  templateId: string;
  enabled: boolean;
  overrideQty: number | null;
}

interface QualitativeLabels {
  done: string;
  partial: string;
  notDone: string;
}

// --- Mock Data ---

const categories = ["RH", "Commercial", "Opérationnel", "Qualité", "Formation", "Administratif"];

const initialTemplates: RespTemplate[] = [
  { id: "t1", name: "Réunion d'équipe hebdomadaire", description: "Animer la réunion d'équipe chaque semaine", frequency: "weekly", expectedQty: 1, category: "RH", conditional: false, conditionText: "", saisieMode: "numeric", active: true },
  { id: "t2", name: "Entretien individuel mensuel", description: "Réaliser un entretien individuel avec chaque membre de l'équipe", frequency: "monthly", expectedQty: 4, category: "RH", conditional: false, conditionText: "", saisieMode: "numeric", active: true },
  { id: "t3", name: "Contrôle qualité cabines", description: "Vérifier la conformité des cabines de soin", frequency: "daily", expectedQty: 2, category: "Qualité", conditional: false, conditionText: "", saisieMode: "numeric", active: true },
  { id: "t4", name: "Suivi des ventes produits", description: "Analyser les ventes produits et ajuster la mise en avant", frequency: "weekly", expectedQty: 1, category: "Commercial", conditional: false, conditionText: "", saisieMode: "numeric", active: true },
  { id: "t5", name: "Rapport d'activité trimestriel", description: "Rédiger le rapport d'activité du trimestre", frequency: "quarterly", expectedQty: 1, category: "Administratif", conditional: false, conditionText: "", saisieMode: "qualitative", active: true },
  { id: "t6", name: "Intégration nouveau collaborateur", description: "Suivre le parcours d'intégration", frequency: "monthly", expectedQty: 1, category: "RH", conditional: true, conditionText: "Se déclenche si un collaborateur est en période d'essai", saisieMode: "qualitative", active: true },
];

const initialSpaAssignments: Record<string, SpaAssignment[]> = {
  "spa-le-domaine": [
    { templateId: "t1", enabled: true, overrideQty: null },
    { templateId: "t2", enabled: true, overrideQty: 2 },
    { templateId: "t3", enabled: true, overrideQty: null },
    { templateId: "t4", enabled: true, overrideQty: null },
    { templateId: "t5", enabled: true, overrideQty: null },
    { templateId: "t6", enabled: false, overrideQty: null },
  ],
  "spa-riviera": [
    { templateId: "t1", enabled: true, overrideQty: null },
    { templateId: "t2", enabled: true, overrideQty: null },
    { templateId: "t3", enabled: false, overrideQty: null },
    { templateId: "t4", enabled: true, overrideQty: 2 },
    { templateId: "t5", enabled: true, overrideQty: null },
    { templateId: "t6", enabled: true, overrideQty: null },
  ],
};

const spaList = [
  { key: "spa-le-domaine", name: "Spa Le Domaine" },
  { key: "spa-riviera", name: "Spa Riviera" },
];

// --- Helpers ---

const freqBadge: Record<Frequency, { label: string; classes: string }> = {
  daily: { label: "Daily", classes: "bg-violet-100 text-violet-800" },
  weekly: { label: "Weekly", classes: "bg-emerald-100 text-emerald-800" },
  biweekly: { label: "Bi-mensuel", classes: "bg-cyan-100 text-cyan-800" },
  monthly: { label: "Monthly", classes: "bg-blue-100 text-blue-800" },
  quarterly: { label: "Quarterly", classes: "bg-amber-100 text-amber-800" },
};

const defaultSaisie = (f: Frequency): SaisieMode =>
  f === "daily" || f === "weekly" || f === "biweekly" ? "numeric" : "qualitative";

const emptyTemplate = (): RespTemplate => ({
  id: `t${Date.now()}`,
  name: "",
  description: "",
  frequency: "weekly",
  expectedQty: 1,
  category: "RH",
  conditional: false,
  conditionText: "",
  saisieMode: "numeric",
  active: true,
});

// --- Main ---

export default function RespConfig() {
  const [tab, setTab] = useState<"templates" | "affectation" | "calendrier">("templates");
  const [templates, setTemplates] = useState(initialTemplates);
  const [spaAssignments, setSpaAssignments] = useState(initialSpaAssignments);
  const [qualLabels, setQualLabels] = useState<QualitativeLabels>({ done: "Réalisé", partial: "Partiel", notDone: "Non réalisé" });

  // Meeting schedule (recurrence for Weekly + Monthly meetings)
  const [schedule, setSchedule] = useState<MeetingSchedule>(() => loadSchedule());
  useEffect(() => { saveSchedule(schedule); }, [schedule]);
  const scheduleDesc = describeSchedule(schedule);

  // Template form
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<RespTemplate | null>(null);

  // Affectation
  const [selectedSpa, setSelectedSpa] = useState(spaList[0].key);

  const handleAdd = () => {
    setEditing(emptyTemplate());
    setSheetOpen(true);
  };

  const handleEdit = (t: RespTemplate) => {
    setEditing({ ...t });
    setSheetOpen(true);
  };

  const handleSave = () => {
    if (!editing) return;
    const exists = templates.find((t) => t.id === editing.id);
    if (exists) {
      setTemplates(templates.map((t) => (t.id === editing.id ? editing : t)));
    } else {
      setTemplates([...templates, editing]);
      // Add to all spas as disabled by default
      const updated = { ...spaAssignments };
      for (const key of Object.keys(updated)) {
        if (!updated[key].find((a) => a.templateId === editing.id)) {
          updated[key] = [...updated[key], { templateId: editing.id, enabled: false, overrideQty: null }];
        }
      }
      setSpaAssignments(updated);
    }
    setSheetOpen(false);
    setEditing(null);
  };

  const handleToggleActive = (id: string) => {
    setTemplates(templates.map((t) => (t.id === id ? { ...t, active: !t.active } : t)));
  };

  const updateField = <K extends keyof RespTemplate>(key: K, value: RespTemplate[K]) => {
    if (!editing) return;
    const updated = { ...editing, [key]: value };
    // Auto-update saisie mode when frequency changes
    if (key === "frequency") {
      updated.saisieMode = defaultSaisie(value as Frequency);
    }
    setEditing(updated);
  };

  // Affectation helpers
  const currentAssignments = spaAssignments[selectedSpa] ?? [];

  const toggleSpaAssignment = (templateId: string) => {
    const updated = currentAssignments.map((a) =>
      a.templateId === templateId ? { ...a, enabled: !a.enabled } : a
    );
    setSpaAssignments({ ...spaAssignments, [selectedSpa]: updated });
  };

  const updateOverride = (templateId: string, qty: number | null) => {
    const updated = currentAssignments.map((a) =>
      a.templateId === templateId ? { ...a, overrideQty: qty } : a
    );
    setSpaAssignments({ ...spaAssignments, [selectedSpa]: updated });
  };

  return (
    <div className="max-w-[960px] mx-auto px-6 py-6 pb-20">
      {/* Header */}
      <header className="mb-6">
        <h1 className="text-xl font-bold text-foreground">Responsabilités managériales — Configuration</h1>
        <div className="flex items-center gap-1 mt-3">
          {(["templates", "affectation", "calendrier"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {t === "templates" ? "Templates globaux" : t === "affectation" ? "Affectation par spa" : "Calendrier des réunions"}
            </button>
          ))}
        </div>
      </header>

      {/* TAB 1 — Templates */}
      {tab === "templates" && (
        <>
          <div className="flex justify-end mb-4">
            <Button size="sm" className="gap-1.5" onClick={handleAdd}>
              <Plus className="h-4 w-4" /> Ajouter un template
            </Button>
          </div>

          <div className="border border-border rounded-xl overflow-hidden shadow-sm mb-8">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted">
                  <th className="text-left py-2.5 px-4 font-semibold text-foreground">Nom</th>
                  <th className="text-left py-2.5 px-4 font-semibold text-foreground">Fréquence</th>
                  <th className="text-right py-2.5 px-4 font-semibold text-foreground">Attendu</th>
                  <th className="text-left py-2.5 px-4 font-semibold text-foreground">Catégorie</th>
                  <th className="text-center py-2.5 px-4 font-semibold text-foreground">Cond.</th>
                  <th className="text-center py-2.5 px-4 font-semibold text-foreground">Actif</th>
                  <th className="text-right py-2.5 px-4 font-semibold text-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((t) => {
                  const fb = freqBadge[t.frequency];
                  return (
                    <tr key={t.id} className={`border-t border-border ${!t.active ? "opacity-50" : ""}`}>
                      <td className="py-2.5 px-4 font-medium text-foreground">{t.name}</td>
                      <td className="py-2.5 px-4">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${fb.classes}`}>{fb.label}</span>
                      </td>
                      <td className="py-2.5 px-4 text-right text-foreground">{t.expectedQty}</td>
                      <td className="py-2.5 px-4 text-muted-foreground">{t.category}</td>
                      <td className="py-2.5 px-4 text-center">
                        {t.conditional ? (
                          <Tooltip>
                            <TooltipTrigger>
                              <Zap className="h-4 w-4 text-amber-500 mx-auto" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-[250px]">{t.conditionText}</TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <Switch checked={t.active} onCheckedChange={() => handleToggleActive(t.id)} />
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => handleEdit(t)}>
                          <Pencil className="h-3 w-3" /> Modifier
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Qualitative Labels */}
          <section className="mb-8">
            <h2 className="text-base font-semibold text-foreground mb-3">Gestion des ancres qualitatives</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Renommez les 3 états qualitatifs utilisés pour les responsabilités Monthly/Quarterly.
            </p>
            <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs font-medium text-emerald-700">État positif</Label>
                  <Input
                    value={qualLabels.done}
                    onChange={(e) => setQualLabels({ ...qualLabels, done: e.target.value.slice(0, 30) })}
                    className="mt-1 h-8 text-sm"
                    maxLength={30}
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium text-amber-700">État partiel</Label>
                  <Input
                    value={qualLabels.partial}
                    onChange={(e) => setQualLabels({ ...qualLabels, partial: e.target.value.slice(0, 30) })}
                    className="mt-1 h-8 text-sm"
                    maxLength={30}
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium text-red-700">État négatif</Label>
                  <Input
                    value={qualLabels.notDone}
                    onChange={(e) => setQualLabels({ ...qualLabels, notDone: e.target.value.slice(0, 30) })}
                    className="mt-1 h-8 text-sm"
                    maxLength={30}
                  />
                </div>
              </div>
            </div>
          </section>
        </>
      )}

      {/* TAB 2 — Affectation par spa */}
      {tab === "affectation" && (
        <>
          <div className="flex items-center gap-3 mb-6">
            <Label className="text-sm font-medium text-foreground">Spa :</Label>
            <Select value={selectedSpa} onValueChange={setSelectedSpa}>
              <SelectTrigger className="w-[200px] h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {spaList.map((s) => (
                  <SelectItem key={s.key} value={s.key}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="border border-border rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted">
                  <th className="text-center py-2.5 px-4 font-semibold text-foreground w-12">Actif</th>
                  <th className="text-left py-2.5 px-4 font-semibold text-foreground">Template</th>
                  <th className="text-left py-2.5 px-4 font-semibold text-foreground">Fréquence</th>
                  <th className="text-right py-2.5 px-4 font-semibold text-foreground">Attendu global</th>
                  <th className="text-right py-2.5 px-4 font-semibold text-foreground">Attendu spa</th>
                </tr>
              </thead>
              <tbody>
                {templates.filter((t) => t.active).map((t) => {
                  const assignment = currentAssignments.find((a) => a.templateId === t.id);
                  const enabled = assignment?.enabled ?? false;
                  const override = assignment?.overrideQty;
                  const fb = freqBadge[t.frequency];

                  return (
                    <tr key={t.id} className={`border-t border-border ${!enabled ? "opacity-50" : ""}`}>
                      <td className="py-2.5 px-4 text-center">
                        <Checkbox checked={enabled} onCheckedChange={() => toggleSpaAssignment(t.id)} />
                      </td>
                      <td className="py-2.5 px-4">
                        <p className="font-medium text-foreground">{t.name}</p>
                        {t.conditional && (
                          <span className="text-[10px] text-amber-600 flex items-center gap-1 mt-0.5">
                            <Zap className="h-3 w-3" /> Conditionnel
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${fb.classes}`}>{fb.label}</span>
                      </td>
                      <td className="py-2.5 px-4 text-right text-muted-foreground">{t.expectedQty}</td>
                      <td className="py-2.5 px-4 text-right">
                        {enabled ? (
                          <Input
                            type="number"
                            min={0}
                            value={override ?? ""}
                            onChange={(e) => {
                              const val = e.target.value === "" ? null : Number(e.target.value);
                              updateOverride(t.id, val);
                            }}
                            placeholder={`${t.expectedQty}`}
                            className="h-7 w-20 text-sm text-right ml-auto"
                          />
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* TAB 3 — Calendrier des réunions */}
      {tab === "calendrier" && (
        <section>
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-6">
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <CalendarClock className="h-4 w-4 mt-0.5 text-primary" />
              <p>
                Définissez la récurrence des réunions Weekly et Monthly. Le dashboard utilise ces réglages
                pour afficher la prochaine réunion et envoyer les rappels.
              </p>
            </div>

            {/* Weekly */}
            <div className="border-t border-border pt-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">🟢 Weekly</span>
                <span className="text-sm text-muted-foreground">{scheduleDesc.weekly}</span>
              </div>
              <Label className="text-sm font-medium">Jour de la semaine récurrent</Label>
              <p className="text-[10px] text-muted-foreground mb-1.5">Ex : tous les jeudis</p>
              <Select
                value={String(schedule.weekly_day)}
                onValueChange={(v) => setSchedule({ ...schedule, weekly_day: Number(v) })}
              >
                <SelectTrigger className="w-[260px] h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DAY_LABELS_FR.map((d, i) => (
                    <SelectItem key={i} value={String(i)}>Tous les {d.toLowerCase()}s</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Monthly */}
            <div className="border-t border-border pt-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">🔵 Monthly</span>
                <span className="text-sm text-muted-foreground">{scheduleDesc.monthly}</span>
              </div>

              <Label className="text-sm font-medium">Type de récurrence</Label>
              <div className="flex gap-2 mt-1.5 mb-4">
                {([
                  { v: "weekday", label: "X-ième jour du mois (ex : 1er lundi)" },
                  { v: "date", label: "Date exacte (ex : le 15)" },
                ] as const).map((o) => (
                  <button
                    key={o.v}
                    onClick={() => setSchedule({ ...schedule, monthly_mode: o.v })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      schedule.monthly_mode === o.v
                        ? "bg-primary/10 text-primary border-primary/30"
                        : "bg-card text-muted-foreground border-border hover:bg-muted"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>

              {schedule.monthly_mode === "weekday" ? (
                <div className="flex gap-2 items-end">
                  <div>
                    <Label className="text-xs">Occurrence</Label>
                    <Select
                      value={String(schedule.monthly_week)}
                      onValueChange={(v) => setSchedule({ ...schedule, monthly_week: Number(v) })}
                    >
                      <SelectTrigger className="w-[140px] h-9 text-sm mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {WEEK_LABELS_FR.map((w, i) => (
                          <SelectItem key={i} value={String(i + 1)}>{w}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Jour</Label>
                    <Select
                      value={String(schedule.monthly_day)}
                      onValueChange={(v) => setSchedule({ ...schedule, monthly_day: Number(v) })}
                    >
                      <SelectTrigger className="w-[160px] h-9 text-sm mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DAY_LABELS_FR.map((d, i) => (
                          <SelectItem key={i} value={String(i)}>{d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <span className="text-sm text-muted-foreground pb-2">du mois</span>
                </div>
              ) : (
                <div>
                  <Label className="text-xs">Jour du mois (1 – 31, ou « Dernier »)</Label>
                  <Select
                    value={String(schedule.monthly_date)}
                    onValueChange={(v) => setSchedule({ ...schedule, monthly_date: Number(v) })}
                  >
                    <SelectTrigger className="w-[180px] h-9 text-sm mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent className="max-h-72">
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                        <SelectItem key={d} value={String(d)}>Le {d}</SelectItem>
                      ))}
                      <SelectItem value="32">Dernier jour du mois</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Slideover Form */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-[440px] sm:max-w-[440px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {editing && templates.find((t) => t.id === editing.id)
                ? "Modifier le template"
                : "Ajouter un template"}
            </SheetTitle>
          </SheetHeader>

          {editing && (
            <div className="mt-6 space-y-5">
              {/* Name */}
              <div>
                <Label className="text-sm font-medium">Nom *</Label>
                <Input
                  value={editing.name}
                  onChange={(e) => updateField("name", e.target.value.slice(0, 80))}
                  maxLength={80}
                  placeholder="Ex : Réunion d'équipe hebdomadaire"
                  className="mt-1"
                />
                <p className="text-[10px] text-muted-foreground mt-1 text-right">{editing.name.length}/80</p>
              </div>

              {/* Description */}
              <div>
                <Label className="text-sm font-medium">Description</Label>
                <Textarea
                  value={editing.description}
                  onChange={(e) => updateField("description", e.target.value.slice(0, 200))}
                  maxLength={200}
                  rows={2}
                  placeholder="Description de la responsabilité…"
                  className="mt-1"
                />
                <p className="text-[10px] text-muted-foreground mt-1 text-right">{editing.description.length}/200</p>
              </div>

              {/* Frequency */}
              <div>
                <Label className="text-sm font-medium">Fréquence</Label>
                <div className="flex gap-2 mt-1.5 flex-wrap">
                {(["daily", "weekly", "biweekly", "monthly", "quarterly"] as const).map((f) => {
                    const fb = freqBadge[f];
                    return (
                      <button
                        key={f}
                        onClick={() => updateField("frequency", f)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          editing.frequency === f
                            ? `${fb.classes} border-current`
                            : "bg-card text-muted-foreground border-border hover:bg-muted"
                        }`}
                      >
                        {fb.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Expected Qty */}
              <div>
                <Label className="text-sm font-medium">Quantité attendue par défaut</Label>
                <Input
                  type="number"
                  min={0}
                  value={editing.expectedQty}
                  onChange={(e) => updateField("expectedQty", Number(e.target.value))}
                  className="mt-1 w-28"
                />
              </div>

              {/* Category */}
              <div>
                <Label className="text-sm font-medium">Catégorie</Label>
                <Select value={editing.category} onValueChange={(v) => updateField("category", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Conditional */}
              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Responsabilité conditionnelle</Label>
                  <Switch checked={editing.conditional} onCheckedChange={(v) => updateField("conditional", v)} />
                </div>
                {editing.conditional && (
                  <div className="mt-2">
                    <Input
                      value={editing.conditionText}
                      onChange={(e) => updateField("conditionText", e.target.value.slice(0, 150))}
                      maxLength={150}
                      placeholder="Ex : Se déclenche si un collaborateur est en période d'essai"
                      className="text-sm"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1 text-right">{editing.conditionText.length}/150</p>
                  </div>
                )}
              </div>

              {/* Saisie Mode */}
              <div>
                <Label className="text-sm font-medium">Mode de saisie</Label>
                <p className="text-[10px] text-muted-foreground mb-1.5">
                  Auto selon fréquence ({editing.frequency === "daily" || editing.frequency === "weekly" || editing.frequency === "biweekly" ? "numérique" : "qualitatif"}) — modifiable
                </p>
                <div className="flex gap-2">
                  {(["numeric", "qualitative"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => updateField("saisieMode", m)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        editing.saisieMode === m
                          ? "bg-primary/10 text-primary border-primary/30"
                          : "bg-card text-muted-foreground border-border hover:bg-muted"
                      }`}
                    >
                      {m === "numeric" ? "Numérique" : "Qualitatif (3 états)"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Active */}
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Actif</Label>
                <Switch checked={editing.active} onCheckedChange={(v) => updateField("active", v)} />
              </div>

              {/* Save */}
              <div className="flex gap-3 pt-4">
                <Button className="flex-1" onClick={handleSave} disabled={!editing.name.trim()}>
                  Enregistrer
                </Button>
                <Button variant="outline" onClick={() => setSheetOpen(false)}>Annuler</Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
