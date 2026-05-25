import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, X, Info, CheckSquare, Target, Check } from "lucide-react";
import type { SectionStatus } from "@/pages/RapportDetail";
import { usePersistedSection } from "@/lib/usePersistedSection";
import {
  convertIdsToTodo,
  convertIdsToObjectif,
  getConversions,
  type IdsConversionMap,
} from "@/lib/idsConversions";


interface CapturedIssue {
  text: string;
  date: string;
}

interface Props {
  reportId: string;
  onStatusChange: (status: SectionStatus) => void;
}

export function SectionIdsWeekly({ reportId, onStatusChange }: Props) {
  const [issues, setIssues] = usePersistedSection<CapturedIssue[]>(reportId, "ids", []);
  const [showInput, setShowInput] = useState(false);
  const [newIssue, setNewIssue] = useState("");
  const [convs, setConvs] = useState<IdsConversionMap>(() => getConversions(reportId));

  useEffect(() => {
    const refresh = () => setConvs(getConversions(reportId));
    window.addEventListener("report-section-saved", refresh);
    return () => window.removeEventListener("report-section-saved", refresh);
  }, [reportId]);

  const addIssue = () => {
    if (!newIssue.trim()) return;
    setIssues((prev) => [
      ...prev,
      { text: newIssue.trim(), date: new Date().toLocaleDateString("fr-FR") },
    ]);
    setNewIssue("");
    setShowInput(false);
  };

  const cancel = () => {
    setNewIssue("");
    setShowInput(false);
  };

  const handleConvert = (kind: "todo" | "objectif", issue: CapturedIssue, key: string) => {
    if (kind === "todo") convertIdsToTodo(reportId, issue.text, key);
    else convertIdsToObjectif(reportId, issue.text, key);
    setConvs(getConversions(reportId));
  };

  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold text-foreground">Problèmes identifiés</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Capture rapide — convertissez en to-do ou objectif si besoin
      </p>

      {/* Existing issues */}
      {issues.length > 0 && (
        <div className="space-y-2 mb-4">
          {issues.map((issue, i) => {
            const key = `${issue.date}_${i}_${issue.text.slice(0, 20)}`;
            const conv = convs[key] ?? {};
            return (
              <div key={i} className="bg-card border border-border rounded-xl p-3 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">{issue.text}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                        Identifié
                      </span>
                      <span className="text-xs text-muted-foreground">{issue.date}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 mt-2.5 flex-wrap">
                  {conv.todo ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-1 rounded-full">
                      <Check className="h-3 w-3" /> To-do créé
                    </span>
                  ) : (
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5"
                      onClick={() => handleConvert("todo", issue, key)}>
                      <CheckSquare className="h-3.5 w-3.5" /> → To-do
                    </Button>
                  )}
                  {conv.objectif ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-1 rounded-full">
                      <Check className="h-3 w-3" /> Objectif créé
                    </span>
                  ) : (
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5"
                      onClick={() => handleConvert("objectif", issue, key)}>
                      <Target className="h-3.5 w-3.5" /> → Objectif
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}


      {/* Add button / input */}
      {showInput ? (
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm space-y-3">
          <Input
            placeholder="Décrivez le problème en une phrase..."
            maxLength={150}
            value={newIssue}
            onChange={(e) => setNewIssue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addIssue()}
            autoFocus
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={addIssue} disabled={!newIssue.trim()} className="gap-1.5">
              Confirmer
            </Button>
            <Button size="sm" variant="ghost" onClick={cancel}>
              Annuler
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" onClick={() => setShowInput(true)} className="gap-1.5 border-primary text-primary hover:bg-primary/5">
          <Plus className="h-4 w-4" />
          Ajouter un problème
        </Button>
      )}

      {/* Info note */}
      <div className="mt-6 flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <span>Les problèmes identifiés ici seront traités lors de la prochaine réunion Monthly.</span>
      </div>
    </section>
  );
}
