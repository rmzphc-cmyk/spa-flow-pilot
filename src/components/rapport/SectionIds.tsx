import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lightbulb, Plus, Lock } from "lucide-react";
import { usePersistedSection } from "@/lib/usePersistedSection";

interface Props {
  reportId: string;
  reportType: "monthly" | "weekly";
}

const previousIssues = [
  "Fuite d'eau cabine 3 — en attente réparation",
  "Retards fréquents livraisons fournisseur huiles",
];

export function SectionIds({ reportId, reportType }: Props) {
  const [issues, setIssues] = usePersistedSection<string[]>(reportId, "ids", []);
  const [newIssue, setNewIssue] = useState("");

  const addIssue = () => {
    if (!newIssue.trim()) return;
    setIssues((p) => [...p, newIssue.trim()]);
    setNewIssue("");
  };

  if (reportType === "monthly") {
    return (
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-foreground">IDS — Identifier, Discuter, Solutionner</h2>
        <p className="text-sm text-muted-foreground mb-4">Traitement des problèmes en réunion</p>

        <div className="bg-muted/50 border border-border rounded-xl p-8 text-center">
          <Lock className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-foreground font-medium">L'IDS se remplit pendant et après la réunion</p>
          <p className="text-sm text-muted-foreground mt-1">Revenez ici lors de la réunion.</p>
        </div>

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

  // Weekly mode — capture only
  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold text-foreground">IDS — Problèmes à remonter</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Problèmes identifiés — ils seront traités en réunion Monthly
      </p>

      <div className="space-y-2 mb-4">
        {issues.map((issue, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-3 shadow-sm flex items-center gap-3">
            <Lightbulb className="h-4 w-4 text-amber-500 shrink-0" />
            <span className="text-sm text-foreground">{issue}</span>
          </div>
        ))}
      </div>

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
