import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Lock, Sparkles, Send } from "lucide-react";

interface Props {
  reportType: "monthly" | "weekly";
}

const weeklyAiSummary = "Cette semaine, l'équipe a maintenu un bon rythme avec un taux d'occupation cabines de 78%. Deux actions sont en retard : le planning cabines et la commande de stocks. Le panier moyen reste stable à 118€. Point d'attention : le NPS a légèrement baissé, à surveiller la semaine prochaine.";

export function SectionCloture({ reportType }: Props) {
  const [summary, setSummary] = useState(weeklyAiSummary);

  if (reportType === "monthly") {
    return (
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-foreground">Clôture</h2>
        <p className="text-sm text-muted-foreground mb-4">Synthèse et validation du rapport</p>

        <div className="bg-muted/50 border border-border rounded-xl p-8 text-center">
          <Lock className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-foreground font-medium">La clôture et la synthèse se génèrent après la réunion</p>
          <p className="text-sm text-muted-foreground mt-1">Complétez d'abord les sections précédentes.</p>
        </div>
      </section>
    );
  }

  // Weekly
  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold text-foreground">Clôture — Résumé de la semaine</h2>
      <p className="text-sm text-muted-foreground mb-4">Résumé pré-rempli par l'IA, modifiable</p>

      <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <label className="font-medium text-foreground text-sm">Résumé hebdomadaire</label>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
            <Sparkles className="h-3 w-3" />
            Suggestion IA
          </span>
        </div>
        <Textarea
          className="text-sm min-h-[120px]"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
        />
        <div className="text-xs text-muted-foreground text-right mt-1">
          {summary.split(/\s+/).filter(Boolean).length}/200 mots
        </div>

        <Button className="mt-4 gap-1.5">
          <Send className="h-4 w-4" />
          Valider et envoyer à la Direction
        </Button>
      </div>
    </section>
  );
}
