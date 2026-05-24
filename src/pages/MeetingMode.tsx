import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  BarChart3,
  Users,
  CheckSquare,
  Target,
  Plus,
  X,
  Clock,
  Play,
  Pause,
  AlertTriangle,
  Check,
} from "lucide-react";

// --- Mock data ---

const reportData: Record<string, { label: string; period: string; spa: string }> = {
  r1: { label: "Monthly — Mars 2026", period: "1 mars → 31 mars 2026", spa: "Par Gran Canaria" },
  r3: { label: "Monthly — Février 2026", period: "1 fév → 28 fév 2026", spa: "Par Gran Canaria" },
};

const kpis = [
  { id: "k1", label: "CA du mois", unit: "€", value: 42000, target: 45000, status: "amber" as const, comment: "Légère baisse due aux vacances scolaires" },
  { id: "k2", label: "Taux d'occupation cabines", unit: "%", value: 78, target: 80, status: "amber" as const, comment: "" },
  { id: "k3", label: "Panier moyen", unit: "€", value: 125, target: 120, status: "green" as const, comment: "" },
  { id: "k4", label: "NPS clients", unit: "/10", value: 8.2, target: 8.5, status: "amber" as const, comment: "Quelques retours négatifs sur l'accueil" },
  { id: "k5", label: "Ventes produits", unit: "€", value: 9200, target: 8000, status: "green" as const, comment: "" },
  { id: "k6", label: "Absentéisme équipe", unit: "j", value: 4, target: 2, status: "red" as const, comment: "2 arrêts maladie non prévus" },
  { id: "k7", label: "Nouveaux abonnements", unit: "", value: 18, target: 15, status: "green" as const, comment: "" },
  { id: "k8", label: "Satisfaction collaborateurs", unit: "/10", value: 7.5, target: 8, status: "amber" as const, comment: "" },
];

const responsabilites = [
  { label: "Briefing équipe matin", realized: 20, expected: 22 },
  { label: "Vérification propreté cabines", realized: 22, expected: 22 },
  { label: "Suivi planning RDV", realized: 3, expected: 4 },
  { label: "Inventaire produits", status: "done" },
  { label: "Réunion d'équipe mensuelle", status: "done" },
];

const todos = [
  { title: "Finaliser planning cabines semaine 13", responsible: "Sophie M.", overdue: 3 },
  { title: "Commander stocks produits soins visage", responsible: "Marie D.", overdue: 2 },
  { title: "Mettre à jour tarifs site web", responsible: "Marie D.", deadline: "28 mars" },
  { title: "Former Julie sur protocole soin signature", responsible: "Sophie M.", deadline: "30 mars" },
];

const objectifs = [
  { title: "Augmenter le NPS clients", current: 8.2, target: 8.5, unit: "/10", status: "at_risk" },
  { title: "Réduire l'absentéisme", current: 4, target: 2, unit: "j", status: "behind" },
];

const previousIssues = [
  { text: "Fuite d'eau cabine 3 — en attente réparation", from: "Février 2026" },
  { text: "Retards fréquents livraisons fournisseur huiles", from: "Février 2026" },
];

// --- Status colors ---

const statusDot: Record<string, string> = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
};

const objStatusStyles: Record<string, { label: string; classes: string }> = {
  on_track: { label: "En bonne voie", classes: "bg-emerald-100 text-emerald-800" },
  at_risk: { label: "À risque", classes: "bg-amber-100 text-amber-800" },
  behind: { label: "En retard", classes: "bg-red-100 text-red-800" },
};

// --- Timer hook ---

function useTimer() {
  const [running, setRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  const format = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  return { running, toggle: () => setRunning((r) => !r), format, seconds };
}

// --- Main component ---

export default function MeetingMode() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const report = reportData[id ?? ""] ?? { label: `Rapport ${id}`, period: "", spa: "Spa" };
  const timer = useTimer();

  const [issues, setIssues] = useState<string[]>([]);
  const [newIssue, setNewIssue] = useState("");
  const [closeOpen, setCloseOpen] = useState(false);

  const addIssue = () => {
    if (!newIssue.trim()) return;
    setIssues((p) => [...p, newIssue.trim()]);
    setNewIssue("");
  };

  const removeIssue = (i: number) => setIssues((p) => p.filter((_, idx) => idx !== i));

  const overdueCount = todos.filter((t) => t.overdue).length;

  const handleClose = () => {
    setCloseOpen(false);
    // In production: API call to change status to post_meeting
    navigate(`/rapport/${id}`);
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Amber meeting header */}
      <header className="bg-amber-100 border-b border-amber-300 px-4 py-3 flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-4">
          <span className="text-amber-900 font-bold text-sm uppercase tracking-wide">
            🟠 Réunion en cours
          </span>
          <span className="text-amber-800 text-sm">
            {report.spa} — {report.period}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {/* Timer */}
          <div className="flex items-center gap-2 bg-amber-200/60 rounded-lg px-3 py-1.5">
            <Clock className="h-4 w-4 text-amber-800" />
            <span className="text-sm font-mono font-medium text-amber-900">{timer.format}</span>
            <button onClick={timer.toggle} className="text-amber-800 hover:text-amber-900">
              {timer.running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
          </div>

          {/* Close meeting */}
          <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="border-destructive text-destructive hover:bg-destructive/10 gap-1.5">
                Clôturer la réunion
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Clôturer la réunion ?</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 mt-2">
                <p className="text-sm text-muted-foreground">
                  {issues.length} problème{issues.length !== 1 ? "s" : ""} capturé{issues.length !== 1 ? "s" : ""}
                  {overdueCount > 0 && ` — ${overdueCount} to-do en retard statués`}
                </p>
                <p className="text-sm text-muted-foreground">
                  La synthèse IA sera générée automatiquement (notification sous 2h max).
                </p>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setCloseOpen(false)}>Annuler</Button>
                  <Button onClick={handleClose} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                    Confirmer la clôture
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {/* Main 2-column layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Collapsed sidebar — icons only */}
        <aside className="w-20 border-r border-border flex-shrink-0 hidden lg:flex flex-col items-center py-4 gap-1" style={{ backgroundColor: "#F9FAFB" }}>
          {[
            { icon: BarChart3, label: "KPI" },
            { icon: Users, label: "Resp." },
            { icon: CheckSquare, label: "To-do" },
            { icon: Target, label: "Obj." },
          ].map((item) => (
            <div key={item.label} className="flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg text-muted-foreground hover:bg-muted cursor-pointer transition-colors">
              <item.icon className="h-5 w-5" />
              <span className="text-[10px]">{item.label}</span>
            </div>
          ))}
        </aside>

        {/* Left column — read-only */}
        <div className="w-full lg:w-[40%] border-r border-border overflow-y-auto p-5">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-foreground">Données du rapport</h2>
            <p className="text-xs text-muted-foreground">Vue réunion — lecture seule</p>
          </div>

          <Tabs defaultValue="kpi">
            <TabsList className="mb-4">
              <TabsTrigger value="kpi">KPI</TabsTrigger>
              <TabsTrigger value="resp">Responsabilités</TabsTrigger>
              <TabsTrigger value="todo">To-do</TabsTrigger>
              <TabsTrigger value="obj">Objectifs</TabsTrigger>
            </TabsList>

            <TabsContent value="kpi">
              <div className="space-y-2">
                {kpis.map((kpi) => (
                  <div key={kpi.id} className="bg-card border border-border rounded-lg p-3 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">{kpi.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-foreground">
                          {kpi.value.toLocaleString("fr-FR")}{kpi.unit}
                        </span>
                        <div className={`w-2.5 h-2.5 rounded-full ${statusDot[kpi.status]}`} />
                      </div>
                    </div>
                    {kpi.comment && (
                      <p className="text-xs text-muted-foreground mt-1 italic">{kpi.comment}</p>
                    )}
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="resp">
              <div className="bg-card border border-border rounded-lg p-4 shadow-sm mb-3">
                <span className="text-lg font-bold text-foreground">73%</span>
                <span className="text-xs text-muted-foreground ml-2">complétion globale</span>
              </div>
              <div className="space-y-1.5">
                {responsabilites.map((r, i) => (
                  <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-border last:border-0">
                    <span className="text-foreground">{r.label}</span>
                    <span className="text-muted-foreground text-xs">
                      {"realized" in r ? `${r.realized}/${r.expected}` : "✓"}
                    </span>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="todo">
              <div className="space-y-2">
                {todos.map((t, i) => (
                  <div key={i} className={`rounded-lg p-3 text-sm flex items-center justify-between ${t.overdue ? "bg-red-50 border border-red-200" : "bg-card border border-border"}`}>
                    <div>
                      <span className="text-foreground">{t.title}</span>
                      <span className="text-xs text-muted-foreground ml-2">{t.responsible}</span>
                    </div>
                    {t.overdue ? (
                      <span className="text-xs font-medium text-destructive">+{t.overdue}j</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">{t.deadline}</span>
                    )}
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="obj">
              <div className="space-y-3">
                {objectifs.map((o, i) => {
                  const s = objStatusStyles[o.status] ?? objStatusStyles.on_track;
                  const progress = Math.min(100, Math.round((o.current / o.target) * 100));
                  return (
                    <div key={i} className="bg-card border border-border rounded-lg p-4 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-foreground">{o.title}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.classes}`}>{s.label}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-foreground">{o.current}{o.unit}</span>
                        <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${progress}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground">/{o.target}{o.unit}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right column — IDS capture */}
        <div className="flex-1 overflow-y-auto p-5">
          <h2 className="text-base font-semibold text-foreground mb-1">Problèmes identifiés en réunion</h2>
          <p className="text-xs text-muted-foreground mb-4">IDS — Capture rapide uniquement</p>

          {/* Previous issues */}
          {previousIssues.length > 0 && (
            <div className="rounded-xl p-4 mb-4 bg-amber-50 border border-amber-200">
              <h3 className="text-xs font-medium text-amber-800 mb-2">Problèmes du cycle précédent encore ouverts</h3>
              {previousIssues.map((issue, i) => (
                <div key={i} className="flex items-center justify-between text-sm py-1.5">
                  <span className="text-foreground">{issue.text}</span>
                  <span className="text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full shrink-0 ml-2">
                    Reporté de {issue.from}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="flex gap-2 mb-4">
            <Input
              placeholder="Décrivez le problème en une phrase..."
              maxLength={150}
              value={newIssue}
              onChange={(e) => setNewIssue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addIssue()}
              className="flex-1"
            />
            <Button onClick={addIssue} className="gap-1.5 shrink-0">
              <Plus className="h-4 w-4" /> Ajouter
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            {newIssue.length}/150 caractères
          </p>

          {/* Captured issues */}
          {issues.length > 0 && (
            <div className="space-y-2 mb-4">
              {issues.map((issue, i) => (
                <div key={i} className="flex items-center gap-3 bg-card border border-border rounded-lg p-3 shadow-sm">
                  <span className="text-xs font-bold text-muted-foreground w-6 shrink-0">#{i + 1}</span>
                  <span className="text-sm text-foreground flex-1">{issue}</span>
                  <button onClick={() => removeIssue(i)} className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            {issues.length} problème{issues.length !== 1 ? "s" : ""} capturé{issues.length !== 1 ? "s" : ""}
            {issues.length > 0 && " — à compléter après la réunion"}
          </p>
        </div>
      </div>
    </div>
  );
}
