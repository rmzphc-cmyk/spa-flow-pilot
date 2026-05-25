import { useNavigate } from "react-router-dom";
import { X, Target, BarChart3, MessageSquare, Lightbulb, Users, CheckSquare, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ReportRecord } from "@/lib/reportsStore";

interface KpiRow {
  label: string;
  target: string;
  real: string;
  delta: string;
  positive: boolean | null; // null = neutral
}

const kpiRowsMock: KpiRow[] = [
  { label: "CA du mois", target: "45 000 €", real: "42 800 €", delta: "−4,9 %", positive: false },
  { label: "Taux d'occupation cabines", target: "80 %", real: "78 %", delta: "−2 pts", positive: false },
  { label: "Panier moyen", target: "120 €", real: "124 €", delta: "+3,3 %", positive: true },
  { label: "NPS clients", target: "8,5", real: "8,1", delta: "−0,4", positive: false },
  { label: "Ventes produits", target: "8 000 €", real: "8 350 €", delta: "+4,4 %", positive: true },
  { label: "Nouveaux abonnements", target: "15", real: "13", delta: "−2", positive: false },
];

const checkinSummary = {
  mood: "Énergie globale plutôt bonne. L'équipe ressort positive de la fin de mois malgré l'absence de Sophie M.",
  highlights: [
    "Bonne dynamique sur les ventes produits (+4,4 % vs objectif).",
    "Excellents retours clients sur le nouveau soin signature.",
  ],
  concerns: [
    "Occupation cabines en repli sur les créneaux du matin.",
    "Tensions ponctuelles sur le planning du week-end.",
  ],
};

const idsActions = [
  {
    title: "Relancer la fréquentation matinale (9h–12h)",
    discussion:
      "Créneaux matinaux à 60 % d'occupation contre 85 % l'après-midi. Identifier offre dédiée (forfait early-bird ou duo).",
    solve: "Lancer une promo « Matin Évasion » sur avril, communiquée par newsletter et Instagram.",
    owner: "Marie D.",
    due: "5 avril 2026",
  },
  {
    title: "Renforcer la stabilité du planning équipe",
    discussion:
      "3 modifications de planning en dernière minute ce mois — usure perçue par l'équipe. Revoir la procédure de validation.",
    solve: "Mettre en place validation J-7 + binôme de secours pour chaque créneau critique.",
    owner: "Camille L.",
    due: "15 avril 2026",
  },
  {
    title: "Préparer la montée en compétence sur les soins visage",
    discussion:
      "Demande client en hausse, mais une seule praticienne formée. Risque de saturation au prochain pic d'activité.",
    solve: "Programmer la formation interne 2 jours en avril pour deux praticiennes supplémentaires.",
    owner: "Sophie M.",
    due: "30 avril 2026",
  },
];

interface SectionCardProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}

function SectionCard({ icon: Icon, title, children }: SectionCardProps) {
  return (
    <section className="bg-card rounded-2xl border border-border shadow-sm p-8 md:p-10">
      <header className="flex items-center gap-3 mb-6 pb-4 border-b border-border">
        <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
          <Icon className="h-5 w-5" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">{title}</h2>
      </header>
      {children}
    </section>
  );
}

export function MeetingView({ report }: { report: ReportRecord }) {
  const navigate = useNavigate();

  return (
    <div className="fixed inset-0 bg-background z-40 overflow-y-auto">
      {/* Fixed top bar */}
      <header className="sticky top-0 z-10 bg-card border-b border-border shadow-sm">
        <div className="max-w-[1200px] mx-auto px-8 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium shrink-0 ${
                report.type === "weekly"
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-blue-100 text-blue-800"
              }`}
            >
              {report.type === "weekly" ? "🟢 Weekly" : "🔵 Monthly"}
            </span>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-foreground truncate">{report.label}</h1>
              <p className="text-xs text-muted-foreground">
                Réunion · {report.meetingDate ?? report.period}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={() => navigate("/rapports")}>
            <X className="h-4 w-4" />
            Quitter la présentation
          </Button>
        </div>
      </header>

      {/* Body */}
      <main className="max-w-[1200px] mx-auto px-6 md:px-10 py-10 space-y-8">
        {/* KPI */}
        <SectionCard icon={BarChart3} title="KPI — Performance du cycle">
          <div className="overflow-x-auto">
            <table className="w-full text-base">
              <thead>
                <tr className="text-left text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  <th className="pb-3 pr-4">Indicateur</th>
                  <th className="pb-3 px-4 text-right">Objectif</th>
                  <th className="pb-3 px-4 text-right">Réel</th>
                  <th className="pb-3 pl-4 text-right">Écart</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {kpiRowsMock.map((r) => (
                  <tr key={r.label}>
                    <td className="py-4 pr-4 font-medium text-foreground">{r.label}</td>
                    <td className="py-4 px-4 text-right text-foreground tabular-nums">{r.target}</td>
                    <td className="py-4 px-4 text-right font-semibold text-foreground tabular-nums text-lg">
                      {r.real}
                    </td>
                    <td
                      className={`py-4 pl-4 text-right font-semibold tabular-nums ${
                        r.positive === true
                          ? "text-emerald-700"
                          : r.positive === false
                          ? "text-destructive"
                          : "text-muted-foreground"
                      }`}
                    >
                      {r.delta}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        {/* Check-in */}
        <SectionCard icon={MessageSquare} title="Check-in équipe">
          <p className="text-lg text-foreground leading-relaxed mb-6">{checkinSummary.mood}</p>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-emerald-700 mb-2">Points forts</h3>
              <ul className="space-y-2">
                {checkinSummary.highlights.map((h, i) => (
                  <li key={i} className="flex gap-2 text-foreground">
                    <span className="text-emerald-600">●</span>
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-amber-700 mb-2">Points d'attention</h3>
              <ul className="space-y-2">
                {checkinSummary.concerns.map((c, i) => (
                  <li key={i} className="flex gap-2 text-foreground">
                    <span className="text-amber-600">●</span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </SectionCard>

        {/* Responsabilités (monthly only) */}
        {report.type === "monthly" && (
          <SectionCard icon={Users} title="Responsabilités manager">
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { label: "Réalisées", value: "12 / 14", tone: "emerald" },
                { label: "Partielles", value: "1", tone: "amber" },
                { label: "Non réalisées", value: "1", tone: "rose" },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border border-border p-5 bg-muted/30">
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                  <p className="text-3xl font-bold text-foreground mt-1">{s.value}</p>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {/* To-do (monthly) */}
        {report.type === "monthly" && (
          <SectionCard icon={CheckSquare} title="To-do du cycle">
            <p className="text-foreground mb-4">
              <span className="text-2xl font-bold">5 / 8</span>{" "}
              <span className="text-muted-foreground">tâches complétées</span>
            </p>
            <ul className="space-y-2 text-foreground">
              <li>✓ Planning cabines semaine 12</li>
              <li>✓ Commande stocks produits</li>
              <li>✗ Entretien annuel — Sophie M. (en retard +3j)</li>
            </ul>
          </SectionCard>
        )}

        {/* Objectifs (monthly) */}
        {report.type === "monthly" && (
          <SectionCard icon={Target} title="Objectifs actifs">
            <div className="space-y-4">
              {[
                { name: "NPS > 8,5", progress: 95, status: "À risque" },
                { name: "CA mensuel +10%", progress: 88, status: "En bonne voie" },
              ].map((o) => (
                <div key={o.name}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-medium text-foreground">{o.name}</span>
                    <span className="text-sm text-muted-foreground">{o.status} · {o.progress}%</span>
                  </div>
                  <div className="h-2 bg-border rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${o.progress}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {/* IDS / Actions */}
        <SectionCard icon={Lightbulb} title="IDS — Actions décidées">
          <div className="space-y-5">
            {idsActions.map((a, i) => (
              <div
                key={i}
                className="rounded-xl border border-border bg-muted/20 p-6 flex gap-5"
              >
                <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-foreground mb-2">{a.title}</h3>
                  <p className="text-sm text-muted-foreground mb-1">
                    <span className="font-semibold text-foreground">Discussion :</span> {a.discussion}
                  </p>
                  <p className="text-sm text-foreground mt-2">
                    <span className="font-semibold">Solution :</span> {a.solve}
                  </p>
                  <div className="flex flex-wrap gap-4 mt-3 text-xs text-muted-foreground">
                    <span>👤 {a.owner}</span>
                    <span>📅 Échéance : {a.due}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Clôture (monthly only) */}
        {report.type === "monthly" && (
          <SectionCard icon={Lock} title="Clôture">
            <p className="text-foreground leading-relaxed">
              Rapport validé et diffusé à la Direction. Synthèse archivée pour consultation future.
            </p>
          </SectionCard>
        )}
      </main>
    </div>
  );
}
