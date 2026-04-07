import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Save, Send } from "lucide-react";

const reportData: Record<string, { label: string; period: string; type: string }> = {
  r1: { label: "Monthly — Mars 2026", period: "1 mars → 31 mars 2026", type: "monthly" },
  r2: { label: "Weekly — Semaine 12", period: "18 → 24 mars 2026", type: "weekly" },
  r3: { label: "Monthly — Février 2026", period: "1 fév → 28 fév 2026", type: "monthly" },
  r4: { label: "Weekly — Semaine 11", period: "11 → 17 mars 2026", type: "weekly" },
  r5: { label: "Monthly — Janvier 2026", period: "1 jan → 31 jan 2026", type: "monthly" },
};

const kpis = [
  { id: "k1", label: "CA du mois", unit: "€", target: 45000, n1: 38200 },
  { id: "k2", label: "Taux d'occupation cabines", unit: "%", target: 80, n1: 72 },
  { id: "k3", label: "Panier moyen", unit: "€", target: 120, n1: 115 },
  { id: "k4", label: "NPS clients", unit: "/10", target: 8.5, n1: 7.8 },
  { id: "k5", label: "Ventes produits", unit: "€", target: 8000, n1: 6100 },
  { id: "k6", label: "Absentéisme équipe", unit: "j", target: 2, n1: 3 },
  { id: "k7", label: "Nouveaux abonnements", unit: "", target: 15, n1: 11 },
  { id: "k8", label: "Satisfaction collaborateurs", unit: "/10", target: 8, n1: 7.2 },
];

const emojis = ["😞", "😕", "😐", "🙂", "😊"];

const steps = ["Préparation", "Réunion", "Post-réunion"];

function getKpiStatus(value: string, target: number): "none" | "green" | "orange" | "red" {
  if (!value || isNaN(Number(value))) return "none";
  const v = Number(value);
  if (v >= target) return "green";
  if (v >= target * 0.8) return "orange";
  return "red";
}

const statusDotColors: Record<string, string> = {
  none: "bg-muted-foreground/40",
  green: "bg-emerald-500",
  orange: "bg-amber-500",
  red: "bg-red-500",
};

export default function RapportDetail() {
  const { id } = useParams<{ id: string }>();
  const report = reportData[id ?? ""] ?? { label: `Rapport ${id}`, period: "", type: "monthly" };

  const [kpiValues, setKpiValues] = useState<Record<string, string>>({});
  const [kpiComments, setKpiComments] = useState<Record<string, string>>({});
  const [meteoEquipe, setMeteoEquipe] = useState<number | null>(null);
  const [meteoPerso, setMeteoPerso] = useState<number | null>(null);
  const [meteoEquipeComment, setMeteoEquipeComment] = useState("");
  const [meteoPersoComment, setMeteoPersoComment] = useState("");
  const [intention, setIntention] = useState("");

  const canSubmit = useMemo(() => {
    if (meteoEquipe === null || meteoPerso === null) return false;
    for (const kpi of kpis) {
      const v = kpiValues[kpi.id];
      if (!v || isNaN(Number(v))) return false;
      const status = getKpiStatus(v, kpi.target);
      if ((status === "orange" || status === "red") && !kpiComments[kpi.id]?.trim()) return false;
    }
    if (meteoEquipe <= 2 && !meteoEquipeComment.trim()) return false;
    if (meteoPerso <= 2 && !meteoPersoComment.trim()) return false;
    return true;
  }, [kpiValues, kpiComments, meteoEquipe, meteoPerso, meteoEquipeComment, meteoPersoComment]);

  return (
    <div className="pb-24">
      {/* HEADER */}
      <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground pl-10 lg:pl-0">{report.label}</h1>
          <p className="text-sm text-muted-foreground mt-1">{report.period}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium" style={{ background: "#F3F4F6", color: "#4B5563" }}>
            En préparation
          </span>
          <Button size="sm" disabled className="gap-1.5 opacity-50">
            <Send className="h-4 w-4" />
            Soumettre pour réunion
          </Button>
        </div>
      </header>

      {/* PROGRESS BAR */}
      <div className="flex items-center gap-0 mb-8">
        {steps.map((step, i) => (
          <div key={step} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${i === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {i + 1}
              </div>
              <span className={`text-xs mt-1 ${i === 0 ? "text-primary font-medium" : "text-muted-foreground"}`}>{step}</span>
            </div>
            {i < steps.length - 1 && <div className={`w-16 sm:w-24 h-0.5 mx-2 mt-[-12px] ${i === 0 ? "bg-primary/30" : "bg-muted"}`} />}
          </div>
        ))}
      </div>

      {/* SECTION 1 — KPI */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-foreground">KPI du mois</h2>
        <p className="text-sm text-muted-foreground mb-4">Saisissez les valeurs réelles de la période</p>
        <div className="flex flex-col gap-3">
          {kpis.map((kpi) => {
            const status = getKpiStatus(kpiValues[kpi.id] ?? "", kpi.target);
            const needsComment = status === "orange" || status === "red";
            return (
              <div key={kpi.id} className="bg-card border border-border rounded-lg p-4 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground">
                      {kpi.label} <span className="text-muted-foreground text-sm font-normal">{kpi.unit}</span>
                    </div>
                    <div className="text-xs text-muted-foreground/60 mt-0.5">N-1 : {kpi.n1}{kpi.unit}</div>
                  </div>
                  <Input
                    type="number"
                    className="w-[120px] text-right"
                    placeholder="—"
                    value={kpiValues[kpi.id] ?? ""}
                    onChange={(e) => setKpiValues((p) => ({ ...p, [kpi.id]: e.target.value }))}
                  />
                  <div className={`w-3 h-3 rounded-full shrink-0 ${statusDotColors[status]}`} />
                </div>
                {needsComment && kpiValues[kpi.id] && (
                  <div className="mt-3">
                    <label className="text-xs font-medium text-foreground">
                      Commentaire requis <span className="text-destructive">*</span>
                    </label>
                    <Textarea
                      className={`mt-1 ${!kpiComments[kpi.id]?.trim() ? "border-destructive" : ""}`}
                      placeholder={status === "orange" ? "Qu'est-ce qui explique cet écart ?" : "Analyse et plan d'action ?"}
                      value={kpiComments[kpi.id] ?? ""}
                      onChange={(e) => setKpiComments((p) => ({ ...p, [kpi.id]: e.target.value }))}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* SECTION 2 — Check-in */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-foreground">Check-in</h2>
        <p className="text-sm text-muted-foreground mb-4">État d'équipe et intention managériale</p>
        <div className="flex flex-col gap-4">
          {/* Météo équipe */}
          <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
            <label className="font-medium text-foreground text-sm">Météo de l'équipe</label>
            <div className="flex gap-2 mt-2">
              {emojis.map((e, i) => (
                <button
                  key={i}
                  onClick={() => setMeteoEquipe(i + 1)}
                  className={`w-[52px] h-12 rounded-lg border text-xl transition-colors ${meteoEquipe === i + 1 ? "border-primary bg-accent" : "border-border bg-card hover:bg-muted"}`}
                >
                  {e}
                </button>
              ))}
            </div>
            {meteoEquipe !== null && meteoEquipe <= 2 && (
              <Textarea
                className="mt-3"
                placeholder="Qu'est-ce qui pèse sur l'équipe en ce moment ?"
                value={meteoEquipeComment}
                onChange={(e) => setMeteoEquipeComment(e.target.value)}
              />
            )}
          </div>

          {/* Météo perso */}
          <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
            <label className="font-medium text-foreground text-sm">Ma météo personnelle</label>
            <div className="flex gap-2 mt-2">
              {emojis.map((e, i) => (
                <button
                  key={i}
                  onClick={() => setMeteoPerso(i + 1)}
                  className={`w-[52px] h-12 rounded-lg border text-xl transition-colors ${meteoPerso === i + 1 ? "border-primary bg-accent" : "border-border bg-card hover:bg-muted"}`}
                >
                  {e}
                </button>
              ))}
            </div>
            {meteoPerso !== null && meteoPerso <= 2 && (
              <Textarea
                className="mt-3"
                placeholder="Comment je me sens en arrivant dans cette période ?"
                value={meteoPersoComment}
                onChange={(e) => setMeteoPersoComment(e.target.value)}
              />
            )}
          </div>

          {/* Intention */}
          <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
            <label className="font-medium text-foreground text-sm">Mon intention pour ce mois</label>
            <Textarea
              className="mt-2"
              placeholder="Ce que je veux accomplir ou clarifier..."
              maxLength={500}
              value={intention}
              onChange={(e) => setIntention(e.target.value)}
            />
            <div className="text-xs text-muted-foreground text-right mt-1">{intention.length}/500</div>
          </div>
        </div>
      </section>

      {/* STICKY BOTTOM BAR */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-[0_-2px_8px_rgba(0,0,0,0.06)] px-6 py-3 flex items-center justify-between z-50">
        <Button variant="ghost" className="gap-1.5">
          <Save className="h-4 w-4" />
          Enregistrer le brouillon
        </Button>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button size="sm" disabled={!canSubmit} className="gap-1.5">
                <Send className="h-4 w-4" />
                Soumettre pour réunion
              </Button>
            </span>
          </TooltipTrigger>
          {!canSubmit && <TooltipContent>Complétez tous les champs obligatoires</TooltipContent>}
        </Tooltip>
      </div>
    </div>
  );
}
