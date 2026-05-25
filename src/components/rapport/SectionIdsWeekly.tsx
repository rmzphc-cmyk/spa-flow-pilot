import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, X, Info } from "lucide-react";
import type { SectionStatus } from "@/pages/RapportDetail";
import { usePersistedSection } from "@/lib/usePersistedSection";

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

  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold text-foreground">Problèmes identifiés</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Capture rapide uniquement — la discussion se fait en réunion Monthly
      </p>

      {/* Existing issues */}
      {issues.length > 0 && (
        <div className="space-y-2 mb-4">
          {issues.map((issue, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-3 shadow-sm flex items-center justify-between gap-3">
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
          ))}
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
