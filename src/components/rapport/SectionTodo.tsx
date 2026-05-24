import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, Plus, Check, Clock, History, MessageSquare } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Todo {
  id: string;
  title: string;
  responsible: string;
  deadline: string;
  priority: "critical" | "high" | "normal";
  status: "pending" | "done" | "postponed";
  overdueDays?: number;
  source?: "ids" | "ia" | "previous";
  /** Cycle d'origine pour les actions héritées (ex: "Février 2026") */
  originCycle?: string;
  /** Commentaire de suivi (Retours positifs / Repoussé pour congé / ...) */
  followUp?: string;
}

const mockTodos: Todo[] = [
  // ── Héritées du cycle précédent (méthode EOS) ──
  { id: "p1", title: "Former Maria sur la gestion cabine humidité", responsible: "Sophie M.", deadline: "20 mars", priority: "high", status: "pending", overdueDays: 5, source: "previous", originCycle: "Février 2026", followUp: "Retardé : Maria en formation produit la semaine dernière" },
  { id: "p2", title: "Mettre en place protocole rebooking +30j", responsible: "Marie D.", deadline: "25 mars", priority: "normal", status: "pending", source: "previous", originCycle: "Février 2026" },
  { id: "p3", title: "Audit fournisseur Phytomer (retards livraisons)", responsible: "Marie D.", deadline: "15 mars", priority: "high", status: "done", source: "previous", originCycle: "Février 2026", followUp: "Fait — nouveau délai contractuel de 5j obtenu" },

  // ── Actions du cycle en cours ──
  { id: "t1", title: "Finaliser planning cabines semaine 13", responsible: "Sophie M.", deadline: "22 mars", priority: "critical", status: "pending", overdueDays: 3 },
  { id: "t2", title: "Commander stocks produits soins visage", responsible: "Marie D.", deadline: "23 mars", priority: "high", status: "pending", overdueDays: 2 },
  { id: "t3", title: "Entretien annuel — Sophie M.", responsible: "Marie D.", deadline: "24 mars", priority: "normal", status: "pending", overdueDays: 1 },
  { id: "t4", title: "Mettre à jour tarifs site web", responsible: "Marie D.", deadline: "28 mars", priority: "high", status: "pending", source: "ia" },
  { id: "t5", title: "Former Julie sur protocole soin signature", responsible: "Sophie M.", deadline: "30 mars", priority: "normal", status: "pending" },
  { id: "t6", title: "Vérifier contrat fournisseur huiles", responsible: "Marie D.", deadline: "31 mars", priority: "normal", status: "pending", source: "ids" },
  { id: "t7", title: "Audit qualité cabine 3", responsible: "Sophie M.", deadline: "15 mars", priority: "normal", status: "done" },
];

const priorityIcons: Record<string, string> = {
  critical: "🔴",
  high: "🟠",
  normal: "🔵",
};

const sourceStyles: Record<string, { label: string; classes: string }> = {
  ids: { label: "IDS", classes: "bg-violet-100 text-violet-800" },
  ia: { label: "IA", classes: "bg-accent text-accent-foreground" },
  previous: { label: "Cycle N-1", classes: "bg-blue-100 text-blue-800" },
};

export function SectionTodo() {
  const [todos, setTodos] = useState(mockTodos);
  const [newOpen, setNewOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newResponsible, setNewResponsible] = useState("");
  const [newDeadline, setNewDeadline] = useState("next_meeting");
  const [newPriority, setNewPriority] = useState("normal");
  const [reportComment, setReportComment] = useState("");
  const [reportingId, setReportingId] = useState<string | null>(null);
  const [editingFollowUp, setEditingFollowUp] = useState<string | null>(null);
  const [followUpDraft, setFollowUpDraft] = useState("");

  // ── Héritées du cycle précédent ──
  const inherited = todos.filter((t) => t.source === "previous");
  const inheritedPending = inherited.filter((t) => t.status !== "done");
  const inheritedDoneCount = inherited.filter((t) => t.status === "done").length;
  const inheritedMissingFollowUp = inheritedPending.filter((t) => !t.followUp?.trim()).length;

  // ── Cycle en cours ──
  const current = todos.filter((t) => t.source !== "previous");
  const overdue = current.filter((t) => t.overdueDays && t.overdueDays > 0 && t.status !== "done");
  const active = current
    .filter((t) => !t.overdueDays && t.status !== "done")
    .sort((a, b) => {
      const prio = { critical: 0, high: 1, normal: 2 };
      return prio[a.priority] - prio[b.priority];
    });

  const markDone = (id: string) =>
    setTodos((p) => p.map((t) => (t.id === id ? { ...t, status: "done" as const, overdueDays: undefined } : t)));

  const saveFollowUp = (id: string) => {
    setTodos((p) => p.map((t) => (t.id === id ? { ...t, followUp: followUpDraft } : t)));
    setEditingFollowUp(null);
    setFollowUpDraft("");
  };

  const handleCreate = () => {
    if (!newTitle.trim()) return;
    setTodos((p) => [
      ...p,
      {
        id: `t${Date.now()}`,
        title: newTitle,
        responsible: newResponsible || "Marie D.",
        deadline: newDeadline === "next_meeting" ? "28 mars" : "À définir",
        priority: newPriority as Todo["priority"],
        status: "pending",
      },
    ]);
    setNewTitle("");
    setNewResponsible("");
    setNewOpen(false);
  };

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">To-do</h2>
          <p className="text-sm text-muted-foreground">Actions à réaliser ce cycle</p>
        </div>
        <Dialog open={newOpen} onOpenChange={setNewOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> Ajouter
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nouvelle action</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              <Input placeholder="Titre de l'action *" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
              <Input placeholder="Responsable" value={newResponsible} onChange={(e) => setNewResponsible(e.target.value)} />
              <Select value={newDeadline} onValueChange={setNewDeadline}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="next_meeting">Prochaine réunion (28 mars)</SelectItem>
                  <SelectItem value="custom">Date précise</SelectItem>
                </SelectContent>
              </Select>
              <Select value={newPriority} onValueChange={setNewPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">🔴 Critique</SelectItem>
                  <SelectItem value="high">🟠 Haute</SelectItem>
                  <SelectItem value="normal">🔵 Normale</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleCreate} className="w-full">Créer l'action</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* ═══════ HÉRITÉES DU CYCLE PRÉCÉDENT (méthode EOS) ═══════ */}
      {inherited.length > 0 && (
        <div className="rounded-xl p-4 mb-4 border border-blue-200 bg-blue-50/50">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-blue-900 flex items-center gap-2">
              <History className="h-4 w-4" />
              Héritées du cycle précédent
              <span className="font-normal text-blue-700">
                — {inherited[0].originCycle} · {inheritedPending.length} en cours, {inheritedDoneCount} terminée{inheritedDoneCount > 1 ? "s" : ""}
              </span>
            </h3>
            {inheritedMissingFollowUp > 0 && (
              <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                {inheritedMissingFollowUp} commentaire{inheritedMissingFollowUp > 1 ? "s" : ""} de suivi manquant{inheritedMissingFollowUp > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <p className="text-xs text-blue-800/80 mb-3 italic">
            Chaque action décidée doit avoir une trace. Commentez l'avancement pour la Direction.
          </p>
          <div className="space-y-2">
            {inherited.map((t) => (
              <div key={t.id} className="bg-card border border-blue-100 rounded-lg p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className={`text-sm font-medium ${t.status === "done" ? "line-through text-muted-foreground" : "text-foreground"}`}>
                      {t.title}
                    </span>
                    <span className="text-xs text-muted-foreground">{t.responsible}</span>
                    <span className="text-xs text-muted-foreground">· {t.deadline}</span>
                    {t.status === "done" && (
                      <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">Fait</span>
                    )}
                    {t.overdueDays && t.status !== "done" && (
                      <span className="text-xs font-medium text-destructive">RETARD +{t.overdueDays}j</span>
                    )}
                  </div>
                  {t.status !== "done" && (
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => markDone(t.id)}>
                      <Check className="h-3 w-3" /> Fait
                    </Button>
                  )}
                </div>

                {/* Commentaire de suivi (obligatoire pour la Direction) */}
                {editingFollowUp === t.id ? (
                  <div className="mt-2 flex gap-2">
                    <Input
                      autoFocus
                      placeholder="Ex: Retours positifs / Repoussé pour congé / Fait avec ajustement…"
                      value={followUpDraft}
                      onChange={(e) => setFollowUpDraft(e.target.value)}
                      className="text-sm h-8"
                      onKeyDown={(e) => { if (e.key === "Enter") saveFollowUp(t.id); }}
                    />
                    <Button size="sm" className="h-8" onClick={() => saveFollowUp(t.id)}>OK</Button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setEditingFollowUp(t.id); setFollowUpDraft(t.followUp || ""); }}
                    className={`mt-2 w-full text-left text-xs flex items-start gap-1.5 px-2 py-1.5 rounded transition-colors ${
                      t.followUp
                        ? "text-foreground bg-muted/50 hover:bg-muted"
                        : "text-amber-700 bg-amber-50 hover:bg-amber-100 italic"
                    }`}
                  >
                    <MessageSquare className="h-3 w-3 mt-0.5 shrink-0" />
                    <span className="flex-1">{t.followUp || "Ajouter un commentaire de suivi…"}</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Overdue block (cycle en cours) */}
      {overdue.length > 0 && (
        <div className="rounded-xl p-4 mb-4 border-l-4 border-l-destructive" style={{ backgroundColor: "#FFF5F5" }}>
          <h3 className="text-sm font-bold text-destructive flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4" />
            {overdue.length} action{overdue.length > 1 ? "s" : ""} en retard
          </h3>
          <div className="space-y-2">
            {overdue.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-foreground">{t.title}</span>
                  <span className="text-xs text-muted-foreground">{t.responsible}</span>
                </div>
                <span className="text-xs font-medium text-destructive shrink-0">RETARD +{t.overdueDays}j</span>
                <div className="flex gap-1.5 shrink-0">
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => markDone(t.id)}>
                    <Check className="h-3 w-3" /> Fait
                  </Button>
                  <Dialog open={reportingId === t.id} onOpenChange={(open) => { setReportingId(open ? t.id : null); setReportComment(""); }}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                        <Clock className="h-3 w-3" /> Reporter
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Reporter l'action</DialogTitle></DialogHeader>
                      <div className="space-y-3 mt-2">
                        <Textarea placeholder="Raison du report" value={reportComment} onChange={(e) => setReportComment(e.target.value)} />
                        <Button className="w-full" onClick={() => { markDone(t.id); setReportingId(null); }}>Confirmer le report</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active block */}
      <div className="space-y-2">
        {active.map((t) => (
          <div key={t.id} className="bg-card border border-border rounded-xl p-4 shadow-sm flex items-center gap-3">
            <button
              onClick={() => markDone(t.id)}
              className="h-5 w-5 rounded border-2 border-border shrink-0 flex items-center justify-center hover:bg-muted transition-colors"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">{t.title}</span>
                {t.source && sourceStyles[t.source] && (
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${sourceStyles[t.source].classes}`}>
                    {sourceStyles[t.source].label}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                <span>{t.responsible}</span>
                <span>{t.deadline}</span>
              </div>
            </div>
            <span className="text-sm shrink-0">{priorityIcons[t.priority]}</span>
          </div>
        ))}
      </div>

      {/* Done count */}
      {current.filter((t) => t.status === "done").length > 0 && (
        <p className="text-xs text-muted-foreground mt-3">
          {current.filter((t) => t.status === "done").length} action{current.filter((t) => t.status === "done").length > 1 ? "s" : ""} terminée{current.filter((t) => t.status === "done").length > 1 ? "s" : ""} ce cycle
        </p>
      )}
    </section>
  );
}
