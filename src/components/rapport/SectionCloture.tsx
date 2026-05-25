import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sparkles, Send, Calendar, ListChecks, ArrowRight } from "lucide-react";
import { usePersistedSection } from "@/lib/usePersistedSection";

interface Props {
  reportId: string;
  reportType: "monthly" | "weekly";
}

const weeklyAiSummary = "Cette semaine, l'équipe a maintenu un bon rythme avec un taux d'occupation cabines de 78%. Deux actions sont en retard : le planning cabines et la commande de stocks. Le panier moyen reste stable à 118€. Point d'attention : le NPS a légèrement baissé, à surveiller la semaine prochaine.";

const monthlyAiSummary = "Mars 2026 — CA spa en progression de +8% vs N-1, porté par les forfaits couple. NPS stable à 72. Trois objectifs sur trois en bonne voie. Deux blocages identifiés en IDS : retards Phytomer (action engagée) et planning cabines (à structurer). Énergie équipe correcte, vigilance sur la charge de Sophie M.";

// Engagements consolidés depuis les sections IDS / Objectifs / To-do du cycle
const engagements = [
  { qui: "Sophie M.", quoi: "Lancer formation Maria — protocole cabine humidité", quand: "5 avril" },
  { qui: "Marie D.", quoi: "Négocier nouveau contrat Phytomer (clause délais)", quand: "10 avril" },
  { qui: "Marie D.", quoi: "Présenter plan rebooking +30j à l'équipe", quand: "Prochaine réunion" },
  { qui: "Sophie M.", quoi: "Finaliser planning cabines semaines 14-17", quand: "3 avril" },
];

interface ClotureState { summary: string; nextMeeting: string; nextMeetingTime: string }

export function SectionCloture({ reportId, reportType }: Props) {
  const [state, setState] = usePersistedSection<ClotureState>(reportId, "cloture", {
    summary: reportType === "weekly" ? weeklyAiSummary : monthlyAiSummary,
    nextMeeting: "2026-04-15",
    nextMeetingTime: "10:00",
  });
  const { summary, nextMeeting, nextMeetingTime } = state;
  const setSummary = (v: string) => setState((p) => ({ ...p, summary: v }));
  const setNextMeeting = (v: string) => setState((p) => ({ ...p, nextMeeting: v }));
  const setNextMeetingTime = (v: string) => setState((p) => ({ ...p, nextMeetingTime: v }));

  if (reportType === "monthly") {
    return (
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-foreground">Clôture & engagements</h2>
        <p className="text-sm text-muted-foreground mb-4">Synthèse, engagements pris en réunion et prochaine échéance</p>

        {/* Synthèse */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm mb-4">
          <div className="flex items-center justify-between mb-3">
            <label className="font-medium text-foreground text-sm">Synthèse du mois</label>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
              <Sparkles className="h-3 w-3" />
              Suggestion IA
            </span>
          </div>
          <Textarea
            className="text-sm min-h-[110px]"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
          />
          <div className="text-xs text-muted-foreground text-right mt-1">
            {summary.split(/\s+/).filter(Boolean).length} mots
          </div>
        </div>

        {/* Engagements : qui fait quoi pour quand */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm mb-4">
          <div className="flex items-center gap-2 mb-3">
            <ListChecks className="h-4 w-4 text-primary" />
            <label className="font-medium text-foreground text-sm">Engagements pris — qui fait quoi pour quand</label>
          </div>
          <p className="text-xs text-muted-foreground mb-3 italic">
            Consolidé depuis les sections IDS, Objectifs et To-do de ce cycle. À relire à chaud pour éviter les malentendus.
          </p>
          <div className="space-y-2">
            {engagements.map((e, i) => (
              <div key={i} className="flex items-start gap-3 text-sm py-2 border-b border-border/50 last:border-0">
                <span className="font-medium text-foreground w-24 shrink-0">{e.qui}</span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground mt-1 shrink-0" />
                <span className="flex-1 text-foreground">{e.quoi}</span>
                <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded shrink-0">{e.quand}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Prochaine réunion */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="h-4 w-4 text-primary" />
            <label className="font-medium text-foreground text-sm">Prochaine réunion mensuelle</label>
          </div>
          <div className="flex gap-3">
            <Input
              type="date"
              value={nextMeeting}
              onChange={(e) => setNextMeeting(e.target.value)}
              className="text-sm max-w-xs"
            />
            <Input
              type="time"
              value={nextMeetingTime}
              onChange={(e) => setNextMeetingTime(e.target.value)}
              className="text-sm max-w-[120px]"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            La date est partagée à la Direction et bloque la prochaine clôture.
          </p>
        </div>

        <Button className="gap-1.5">
          <Send className="h-4 w-4" />
          Valider et envoyer à la Direction
        </Button>
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
