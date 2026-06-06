import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { useDirectionSpaDetail } from "@/hooks/useDirectionData";
import type { SpaKpiRow } from "@/data/directionMockData";
import {
  ChevronLeft,
  ArrowRight,
  Check,
  Sparkles,
} from "lucide-react";

// --- Helpers ---

const statusBadge: Record<string, { label: string; classes: string }> = {
  validated: { label: "Validé", classes: "bg-emerald-100 text-emerald-800" },
  in_meeting: { label: "Réunion en cours", classes: "bg-violet-100 text-violet-800" },
  draft_preparation: { label: "Préparation", classes: "bg-muted text-muted-foreground" },
};

function KpiCardSimple({ kpi }: { kpi: SpaKpiRow }) {
  const dotColor =
    kpi.status === "green" ? "bg-emerald-500" :
    kpi.status === "amber" ? "bg-amber-500" : "bg-destructive";

  const ecartColor = kpi.ecart.startsWith("+")
    ? "text-emerald-600"
    : kpi.ecart === "—"
      ? "text-muted-foreground"
      : "text-destructive";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm cursor-default">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">{kpi.label}</span>
            <div className={`w-2.5 h-2.5 rounded-full ${dotColor}`} />
          </div>
          <p className="text-xl font-bold text-foreground">{kpi.value}</p>
          {kpi.target !== "—" && (
            <p className="text-xs text-muted-foreground mt-0.5">Cible : {kpi.target}</p>
          )}
          {kpi.ecart !== "—" && (
            <p className={`text-xs font-medium mt-0.5 ${ecartColor}`}>
              {kpi.ecart} vs N-1
            </p>
          )}
        </div>
      </TooltipTrigger>
    </Tooltip>
  );
}

// --- Main ---

export default function DirectionView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: detail, isLoading, error } = useDirectionSpaDetail(id);

  if (isLoading) {
    return (
      <div className="max-w-[860px] mx-auto px-6 py-6 pb-20 space-y-6">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="max-w-[860px] mx-auto px-6 py-12 text-center">
        <p className="text-foreground font-medium">
          {error ? "Erreur lors du chargement des données" : "Spa introuvable"}
        </p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/direction")}>
          Retour à la direction
        </Button>
      </div>
    );
  }

  const lv = detail.lastValidated;
  const isMonthly = detail.currentReport.label?.toLowerCase().includes("monthly") ?? true;
  const sb = statusBadge[detail.currentReport.status] ?? statusBadge.validated;

  const sortedKpis = [...lv.kpis].sort((a, b) => {
    const order = { red: 0, amber: 1, green: 2 };
    return order[a.status] - order[b.status];
  });

  const objOnTrack = lv.objectifs.filter((o) => o.status === "on_track").length;
  const objAtRisk = lv.objectifs.filter((o) => o.status === "at_risk").length;

  return (
    <div className="max-w-[860px] mx-auto px-6 py-6 pb-20">
      {/* BLOC 0 — Header */}
      <header className="border-b border-border pb-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-foreground">{detail.name}</h1>
            <p className="text-sm text-muted-foreground">{detail.manager}</p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${isMonthly ? "bg-blue-100 text-blue-800" : "bg-emerald-100 text-emerald-800"}`}>
                {isMonthly ? "🔵 Monthly" : "🟢 Weekly"}
              </span>
              <span className="text-sm text-foreground">{lv.period}</span>
            </div>
            <div className="flex items-center gap-2">
              {lv.validatedDate !== "—" && (
                <span className="text-xs text-muted-foreground">Validé le {lv.validatedDate}</span>
              )}
              <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${sb.classes}`}>
                <Check className="h-3 w-3" /> {sb.label}
              </span>
            </div>
          </div>
        </div>
        <div className="mt-3">
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground gap-1" onClick={() => navigate("/direction")}>
            Retour à la direction <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
      </header>

      {/* BLOC 1 — Situation globale */}
      <section className="mb-8">
        <div className="mb-4">
          {lv.checkinNote ? (
            <p className="text-lg text-primary italic leading-relaxed">"{lv.checkinNote}"</p>
          ) : (
            <p className="text-lg text-muted-foreground/50 italic">[Non renseigné]</p>
          )}
        </div>
      </section>

      {/* BLOC 2 — KPI */}
      <section className="mb-8">
        <h2 className="text-base font-semibold text-foreground mb-3">KPI clés</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {sortedKpis.map((kpi, i) => (
            <KpiCardSimple key={i} kpi={kpi} />
          ))}
        </div>
      </section>

      {/* BLOC 3 — Exécution */}
      <section className="mb-8">
        <h2 className="text-base font-semibold text-foreground mb-3">Exécution</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Responsabilités */}
          <div className="bg-card border border-border rounded-xl p-4 shadow-sm text-center">
            <p className="text-2xl font-bold text-foreground">{lv.responsabilites.global}%</p>
            <p className="text-xs text-muted-foreground mt-1">Responsabilités complétées</p>
            <div className="h-1.5 bg-border rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-primary rounded-full" style={{ width: `${lv.responsabilites.global}%` }} />
            </div>
          </div>
          {/* Objectifs */}
          <div className="bg-card border border-border rounded-xl p-4 shadow-sm text-center">
            <div className="flex justify-center gap-3 text-xs font-medium">
              {objOnTrack > 0 && <span className="text-emerald-700">{objOnTrack} ✓</span>}
              {objAtRisk > 0 && <span className="text-amber-700">{objAtRisk} ⚠</span>}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Objectifs</p>
          </div>
        </div>
      </section>

      {/* BLOC 4 — Problèmes & Décisions */}
      <section className="mb-8">
        <h2 className="text-base font-semibold text-foreground mb-3">
          {isMonthly ? "Problèmes traités en réunion" : "Signaux remontés"}
        </h2>
        {lv.ids.length > 0 ? (
          <div className="space-y-3">
            {lv.ids.map((ids, i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-4 shadow-sm">
                <p className="text-sm font-semibold text-foreground mb-1">{ids.problem}</p>
                <p className="text-sm text-muted-foreground">→ {ids.solution}</p>
                <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full mt-2 ${
                  ids.status === "resolved"
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-blue-100 text-blue-800"
                }`}>
                  {ids.status === "resolved" ? "Résolu" : "En cours"}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            {isMonthly ? "[Aucun problème traité en réunion]" : "Aucun signal remonté"}
          </p>
        )}
      </section>

      {/* BLOC 5 — Objectifs */}
      {lv.objectifs.length > 0 && (
        <section className="mb-8">
          <h2 className="text-base font-semibold text-foreground mb-3">Objectifs en cours</h2>
          <div className="space-y-3">
            {lv.objectifs.map((obj, i) => {
              const isOnTrack = obj.status === "on_track";
              return (
                <div key={i} className={`border rounded-xl p-4 shadow-sm ${isOnTrack ? "bg-card border-border" : "bg-amber-50 border-amber-200"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-foreground">{obj.label}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${isOnTrack ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
                      {obj.statusLabel}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-border rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${isOnTrack ? "bg-emerald-500" : "bg-amber-500"}`}
                        style={{ width: `${obj.progress}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-muted-foreground">{obj.progress}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* BLOC 6 — Synthèse IA */}
      <section className="mb-8">
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-foreground">
              {isMonthly ? "Synthèse IA" : "Résumé"}
            </h2>
            {isMonthly && detail.executiveSummary && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                <Sparkles className="h-3 w-3" />
                Validée par {detail.manager.split(" ")[0]}
              </span>
            )}
          </div>
          {detail.executiveSummary ? (
            <p className="text-sm text-foreground leading-relaxed">{detail.executiveSummary}</p>
          ) : (
            <p className="text-sm text-muted-foreground italic">[Aucune synthèse disponible]</p>
          )}
        </div>
      </section>

      {/* Bottom nav */}
      <div className="flex items-center justify-between pt-4 border-t border-border">
        <Button variant="ghost" className="gap-1.5 text-muted-foreground" onClick={() => navigate(-1)}>
          <ChevronLeft className="h-4 w-4" /> Précédent
        </Button>
        <Button variant="ghost" className="gap-1.5 text-muted-foreground" onClick={() => navigate("/direction")}>
          Tous les spas <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
