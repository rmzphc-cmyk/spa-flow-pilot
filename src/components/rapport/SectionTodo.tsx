import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, Plus, Check, Clock, ArrowRight } from "lucide-react";
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
  status: "pending" | "done";
  overdueDays?: number;
  source?: "ids" | "ia";
}

const mockTodos: Todo[] = [
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

  const overdue = todos.filter((t) => t.overdueDays && t.overdueDays > 0 && t.status !== "done");
  const active = todos
    .filter((t) => !t.overdueDays && t.status !== "done")
    .sort((a, b) => {
      const prio = { critical: 0, high: 1, normal: 2 };
      return prio[a.priority] - prio[b.priority];
    });

  const markDone = (id: string) => setTodos((p) => p.map((t) => (t.id === id ? { ...t, status: "done" as const, overdueDays: undefined } : t)));

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

      {/* Overdue block */}
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
                {t.source && (
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
      {todos.filter((t) => t.status === "done").length > 0 && (
        <p className="text-xs text-muted-foreground mt-3">
          {todos.filter((t) => t.status === "done").length} action{todos.filter((t) => t.status === "done").length > 1 ? "s" : ""} terminée{todos.filter((t) => t.status === "done").length > 1 ? "s" : ""}
        </p>
      )}
    </section>
  );
}
