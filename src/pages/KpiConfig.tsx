import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Plus, Pencil, X } from "lucide-react";

// --- Types ---

type KpiCategory = "spa" | "manager";
type KpiUnit = "€" | "%" | "h" | "nb" | "autre";

interface KpiQuestion {
  green: string;
  amber: string;
  red: string;
}

interface KpiItem {
  id: string;
  name: string;
  category: KpiCategory;
  unit: KpiUnit;
  target: number;
  description: string;
  order: number;
  active: boolean;
  questions: KpiQuestion;
}

interface SliderAnchors {
  low: string;
  mid: string;
  high: string;
}

interface SpaConfig {
  name: string;
  kpis: KpiItem[];
  anchorsMeteo: SliderAnchors;
  anchorsEnergie: SliderAnchors;
}

// --- Mock Data ---

const initialSpas: Record<string, SpaConfig> = {
  "spa-le-domaine": {
    name: "Spa Le Domaine",
    kpis: [
      { id: "k1", name: "CA du mois", category: "spa", unit: "€", target: 45000, description: "Chiffre d'affaires mensuel global", order: 1, active: true, questions: { green: "", amber: "Quels facteurs expliquent l'écart ?", red: "Quelles actions correctives immédiates ?" } },
      { id: "k2", name: "Taux d'occupation", category: "spa", unit: "%", target: 80, description: "Taux de remplissage des cabines", order: 2, active: true, questions: { green: "", amber: "Quels créneaux sont sous-occupés ?", red: "Le planning est-il adapté à la demande ?" } },
      { id: "k3", name: "Panier moyen", category: "spa", unit: "€", target: 120, description: "Panier moyen par client", order: 3, active: true, questions: { green: "", amber: "", red: "" } },
      { id: "k4", name: "NPS clients", category: "spa", unit: "nb", target: 8.5, description: "Score de satisfaction clients", order: 4, active: true, questions: { green: "", amber: "Quels retours négatifs avez-vous reçus ?", red: "Quels sont les 3 principaux irritants ?" } },
      { id: "k5", name: "Ventes produits", category: "manager", unit: "€", target: 8000, description: "Ventes de produits cosmétiques", order: 5, active: true, questions: { green: "", amber: "", red: "" } },
      { id: "k6", name: "Absentéisme", category: "manager", unit: "nb", target: 2, description: "Nombre de jours d'absence dans le mois", order: 6, active: true, questions: { green: "", amber: "Y a-t-il des motifs récurrents ?", red: "Quels postes sont les plus touchés ?" } },
    ],
    anchorsMeteo: { low: "Tensions / conflits", mid: "Équipe stable", high: "Excellente cohésion" },
    anchorsEnergie: { low: "Épuisé·e", mid: "Correct", high: "Pleine énergie" },
  },
  "spa-riviera": {
    name: "Spa Riviera",
    kpis: [
      { id: "k10", name: "CA du mois", category: "spa", unit: "€", target: 55000, description: "", order: 1, active: true, questions: { green: "", amber: "", red: "" } },
      { id: "k11", name: "Taux d'occupation", category: "spa", unit: "%", target: 85, description: "", order: 2, active: true, questions: { green: "", amber: "", red: "" } },
    ],
    anchorsMeteo: { low: "Difficile", mid: "Normal", high: "Très bien" },
    anchorsEnergie: { low: "Bas", mid: "Moyen", high: "Haut" },
  },
};

// --- Helpers ---

const categoryBadge: Record<KpiCategory, { label: string; classes: string }> = {
  spa: { label: "Spa", classes: "bg-teal-100 text-teal-800" },
  manager: { label: "Manager", classes: "bg-blue-100 text-blue-800" },
};

const unitOptions: { value: KpiUnit; label: string }[] = [
  { value: "€", label: "€ (euros)" },
  { value: "%", label: "% (pourcentage)" },
  { value: "h", label: "h (heures)" },
  { value: "nb", label: "nb (nombre)" },
  { value: "autre", label: "Autre" },
];

const emptyKpi = (): KpiItem => ({
  id: `k${Date.now()}`,
  name: "",
  category: "spa",
  unit: "nb",
  target: 0,
  description: "",
  order: 0,
  active: true,
  questions: { green: "", amber: "", red: "" },
});

// --- Main ---

export default function KpiConfig() {
  const [spas, setSpas] = useState(initialSpas);
  const [selectedSpa, setSelectedSpa] = useState<string>("spa-le-domaine");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingKpi, setEditingKpi] = useState<KpiItem | null>(null);

  const spaConfig = spas[selectedSpa];
  const sortedKpis = useMemo(() => {
    if (!spaConfig) return [];
    return [...spaConfig.kpis].sort((a, b) => {
      if (a.category !== b.category) return a.category === "spa" ? -1 : 1;
      return a.order - b.order;
    });
  }, [spaConfig]);

  const handleAdd = () => {
    const newKpi = emptyKpi();
    newKpi.order = (spaConfig?.kpis.length ?? 0) + 1;
    setEditingKpi(newKpi);
    setSheetOpen(true);
  };

  const handleEdit = (kpi: KpiItem) => {
    setEditingKpi({ ...kpi });
    setSheetOpen(true);
  };

  const handleSave = () => {
    if (!editingKpi || !spaConfig) return;
    const exists = spaConfig.kpis.find((k) => k.id === editingKpi.id);
    const updatedKpis = exists
      ? spaConfig.kpis.map((k) => (k.id === editingKpi.id ? editingKpi : k))
      : [...spaConfig.kpis, editingKpi];
    setSpas({ ...spas, [selectedSpa]: { ...spaConfig, kpis: updatedKpis } });
    setSheetOpen(false);
    setEditingKpi(null);
  };

  const handleToggleActive = (id: string) => {
    if (!spaConfig) return;
    const updatedKpis = spaConfig.kpis.map((k) => (k.id === id ? { ...k, active: !k.active } : k));
    setSpas({ ...spas, [selectedSpa]: { ...spaConfig, kpis: updatedKpis } });
  };

  const handleAnchorsChange = (type: "anchorsMeteo" | "anchorsEnergie", key: keyof SliderAnchors, value: string) => {
    if (!spaConfig) return;
    setSpas({
      ...spas,
      [selectedSpa]: { ...spaConfig, [type]: { ...spaConfig[type], [key]: value.slice(0, 50) } },
    });
  };

  const updateField = <K extends keyof KpiItem>(key: K, value: KpiItem[K]) => {
    if (!editingKpi) return;
    setEditingKpi({ ...editingKpi, [key]: value });
  };

  const updateQuestion = (level: keyof KpiQuestion, value: string) => {
    if (!editingKpi) return;
    setEditingKpi({ ...editingKpi, questions: { ...editingKpi.questions, [level]: value } });
  };

  if (!spaConfig) return null;

  return (
    <div className="max-w-[960px] mx-auto px-6 py-6 pb-20">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">KPI — Configuration</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Définir les KPI trackés par spa</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedSpa} onValueChange={setSelectedSpa}>
            <SelectTrigger className="w-[200px] h-9 text-sm">
              <SelectValue placeholder="Sélectionner un spa" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(spas).map(([key, s]) => (
                <SelectItem key={key} value={key}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" className="gap-1.5" onClick={handleAdd}>
            <Plus className="h-4 w-4" /> Ajouter un KPI
          </Button>
        </div>
      </header>

      {/* KPI Table */}
      <section className="mb-8">
        <div className="border border-border rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted">
                <th className="text-left py-2.5 px-4 font-semibold text-foreground">Nom</th>
                <th className="text-left py-2.5 px-4 font-semibold text-foreground">Catégorie</th>
                <th className="text-left py-2.5 px-4 font-semibold text-foreground">Unité</th>
                <th className="text-right py-2.5 px-4 font-semibold text-foreground">Cible</th>
                <th className="text-center py-2.5 px-4 font-semibold text-foreground">Actif</th>
                <th className="text-right py-2.5 px-4 font-semibold text-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedKpis.map((kpi) => {
                const cat = categoryBadge[kpi.category];
                return (
                  <tr key={kpi.id} className={`border-t border-border ${!kpi.active ? "opacity-50" : ""}`}>
                    <td className="py-2.5 px-4 font-medium text-foreground">{kpi.name}</td>
                    <td className="py-2.5 px-4">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cat.classes}`}>{cat.label}</span>
                    </td>
                    <td className="py-2.5 px-4 text-muted-foreground">{kpi.unit}</td>
                    <td className="py-2.5 px-4 text-right font-medium text-foreground">{kpi.target.toLocaleString("fr-FR")}</td>
                    <td className="py-2.5 px-4 text-center">
                      <Switch checked={kpi.active} onCheckedChange={() => handleToggleActive(kpi.id)} />
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => handleEdit(kpi)}>
                        <Pencil className="h-3 w-3" /> Modifier
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {sortedKpis.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">Aucun KPI configuré pour ce spa</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Slider Anchors */}
      <section className="mb-8">
        <h2 className="text-base font-semibold text-foreground mb-4">Ancres sémantiques des sliders check-in</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(["anchorsMeteo", "anchorsEnergie"] as const).map((type) => {
            const anchors = spaConfig[type];
            const title = type === "anchorsMeteo" ? "Ancres météo équipe" : "Ancres énergie manager";
            const positions = [
              { key: "low" as const, pos: "3" },
              { key: "mid" as const, pos: "6" },
              { key: "high" as const, pos: "9" },
            ];
            return (
              <div key={type} className="bg-card border border-border rounded-xl p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-foreground mb-3">{title}</h3>
                <div className="space-y-3">
                  {positions.map(({ key, pos }) => (
                    <div key={key} className="flex items-center gap-3">
                      <span className="text-xs font-medium text-muted-foreground w-14 shrink-0">Pos. {pos}</span>
                      <Input
                        value={anchors[key]}
                        onChange={(e) => handleAnchorsChange(type, key, e.target.value)}
                        maxLength={50}
                        className="h-8 text-sm"
                        placeholder="Texte de l'ancre…"
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Import future */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" className="text-xs text-muted-foreground" disabled>
          Import depuis Excel / SharePoint — Bientôt disponible
        </Button>
      </div>

      {/* Slideover Form */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-[440px] sm:max-w-[440px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {editingKpi && spaConfig.kpis.find((k) => k.id === editingKpi.id)
                ? "Modifier le KPI"
                : "Ajouter un KPI"}
            </SheetTitle>
          </SheetHeader>

          {editingKpi && (
            <div className="mt-6 space-y-5">
              {/* Name */}
              <div>
                <Label className="text-sm font-medium">Nom du KPI *</Label>
                <Input
                  value={editingKpi.name}
                  onChange={(e) => updateField("name", e.target.value.slice(0, 60))}
                  maxLength={60}
                  placeholder="Ex : Chiffre d'affaires mensuel"
                  className="mt-1"
                />
                <p className="text-[10px] text-muted-foreground mt-1 text-right">{editingKpi.name.length}/60</p>
              </div>

              {/* Category */}
              <div>
                <Label className="text-sm font-medium">Catégorie</Label>
                <div className="flex gap-3 mt-1.5">
                  {(["spa", "manager"] as const).map((cat) => (
                    <button
                      key={cat}
                      onClick={() => updateField("category", cat)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        editingKpi.category === cat
                          ? cat === "spa"
                            ? "bg-teal-100 text-teal-800 border-teal-300"
                            : "bg-blue-100 text-blue-800 border-blue-300"
                          : "bg-card text-muted-foreground border-border hover:bg-muted"
                      }`}
                    >
                      {cat === "spa" ? "Spa" : "Manager"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Unit */}
              <div>
                <Label className="text-sm font-medium">Unité</Label>
                <Select value={editingKpi.unit} onValueChange={(v) => updateField("unit", v as KpiUnit)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {unitOptions.map((u) => (
                      <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Target */}
              <div>
                <Label className="text-sm font-medium">Cible par défaut</Label>
                <Input
                  type="number"
                  value={editingKpi.target}
                  onChange={(e) => updateField("target", Number(e.target.value))}
                  className="mt-1"
                />
                <p className="text-[10px] text-muted-foreground mt-1">Cette cible est spécifique à ce spa</p>
              </div>

              {/* Description */}
              <div>
                <Label className="text-sm font-medium">Description / aide contextuelle</Label>
                <Textarea
                  value={editingKpi.description}
                  onChange={(e) => updateField("description", e.target.value.slice(0, 200))}
                  maxLength={200}
                  rows={2}
                  placeholder="Aide contextuelle affichée au manager…"
                  className="mt-1"
                />
                <p className="text-[10px] text-muted-foreground mt-1 text-right">{editingKpi.description.length}/200</p>
              </div>

              {/* Order */}
              <div>
                <Label className="text-sm font-medium">Ordre d'affichage</Label>
                <Input
                  type="number"
                  value={editingKpi.order}
                  onChange={(e) => updateField("order", Number(e.target.value))}
                  min={1}
                  className="mt-1 w-24"
                />
              </div>

              {/* Active */}
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Actif dès création</Label>
                <Switch checked={editingKpi.active} onCheckedChange={(v) => updateField("active", v)} />
              </div>

              {/* Guided Questions */}
              <div className="border-t border-border pt-4">
                <h3 className="text-sm font-semibold text-foreground mb-3">Questions guidées pour commentaires</h3>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs text-emerald-700 font-medium">Question si KPI vert (optionnel)</Label>
                    <Input
                      value={editingKpi.questions.green}
                      onChange={(e) => updateQuestion("green", e.target.value)}
                      placeholder="Pas de question par défaut"
                      className="mt-1 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-amber-700 font-medium">Question si KPI amber (recommandé)</Label>
                    <Input
                      value={editingKpi.questions.amber}
                      onChange={(e) => updateQuestion("amber", e.target.value)}
                      placeholder="Quels facteurs expliquent cet écart ?"
                      className="mt-1 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-red-700 font-medium">Question si KPI rouge (recommandé)</Label>
                    <Input
                      value={editingKpi.questions.red}
                      onChange={(e) => updateQuestion("red", e.target.value)}
                      placeholder="Quelles actions correctives immédiates ?"
                      className="mt-1 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Save */}
              <div className="flex gap-3 pt-4">
                <Button className="flex-1" onClick={handleSave} disabled={!editingKpi.name.trim()}>
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
