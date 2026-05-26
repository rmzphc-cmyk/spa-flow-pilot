import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lightbulb, Plus, Lock, CheckSquare, Target, Check } from "lucide-react";
import {
  useIdsItems,
  useAddIdsItem,
  useConvertIdsToTodo,
  useConvertIdsToObjective,
  type DbIdsItem,
} from "@/hooks/useIdsItems";

interface Props {
  reportId: string;
  reportType: "monthly" | "weekly";
}

const previousIssues = [
  "Fuite d'eau cabine 3 — en attente réparation",
  "Retards fréquents livraisons fournisseur huiles",
];

export function SectionIds({ reportId, reportType }: Props) {
  const { data: issues = [] } = useIdsItems(reportId);
  const addItem = useAddIdsItem(reportId, reportType);
  const convertToTodo = useConvertIdsToTodo(reportId);
  const convertToObjective = useConvertIdsToObjective(reportId);
  const [newIssue, setNewIssue] = useState("");

  const addIssue = () => {
    const text = newIssue.trim();
    if (!text) return;
    addItem.mutate(text);
    setNewIssue("");
  };

  const renderIssueRow = (item: DbIdsItem) => {
    const hasTodo = item.converted_to_todo_id !== null;
    const hasObj = item.converted_to_objective_id !== null;
    return (
      <div key={item.id} className="bg-card border border-border rounded-xl p-3 shadow-sm">
        <div className="flex items-center gap-3">
          <Lightbulb className="h-4 w-4 text-amber-500 shrink-0" />
          <span className="text-sm text-foreground flex-1">{item.capture_text}</span>
        </div>
        <div className="flex gap-2 mt-2.5 flex-wrap">
          {hasTodo ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-1 rounded-full">
              <Check className="h-3 w-3" /> To-do créé
            </span>
          ) : (
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5"
              onClick={() => convertToTodo.mutate(item)}>
              <CheckSquare className="h-3.5 w-3.5" /> → To-do
            </Button>
          )}
          {hasObj ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-1 rounded-full">
              <Check className="h-3 w-3" /> Objectif créé
            </span>
          ) : (
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5"
              onClick={() => convertToObjective.mutate(item)}>
              <Target className="h-3.5 w-3.5" /> → Objectif
            </Button>
          )}
        </div>
      </div>
    );
  };

  const renderIssueRowWeekly = (item: DbIdsItem) => (
    <div key={item.id} className="bg-card border border-border rounded-xl p-3 shadow-sm">
      <div className="flex items-center gap-3">
        <Lightbulb className="h-4 w-4 text-amber-500 shrink-0" />
        <span className="text-sm text-foreground flex-1">{item.capture_text}</span>
      </div>
    </div>
  );

  if (reportType === "monthly") {
    return (
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-foreground">IDS — Identifier, Discuter, Solutionner</h2>
        <p className="text-sm text-muted-foreground mb-4">Traitement des problèmes en réunion</p>

        {issues.length === 0 ? (
          <div className="bg-muted/50 border border-border rounded-xl p-8 text-center">
            <Lock className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-foreground font-medium">L'IDS se remplit pendant et après la réunion</p>
            <p className="text-sm text-muted-foreground mt-1">Revenez ici lors de la réunion.</p>
          </div>
        ) : (
          <div className="space-y-2">{issues.map(renderIssueRow)}</div>
        )}

        {previousIssues.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Problèmes du cycle précédent (non résolus)</h3>
            <ul className="space-y-1.5">
              {previousIssues.map((issue, i) => (
                <li key={i} className="text-sm text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
                  {issue}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    );
  }

  // Weekly fallback
  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold text-foreground">IDS — Problèmes à remonter</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Capture seule — traitement lors de la prochaine réunion Monthly
      </p>

      <div className="space-y-2 mb-4">{issues.map(renderIssueRowWeekly)}</div>

      <div className="flex gap-2">
        <Input
          placeholder="Signaler un problème (max 150 car.)"
          maxLength={150}
          value={newIssue}
          onChange={(e) => setNewIssue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addIssue()}
          className="flex-1"
        />
        <Button size="sm" onClick={addIssue} className="gap-1.5">
          <Plus className="h-4 w-4" /> Signaler
        </Button>
      </div>
    </section>
  );
}
