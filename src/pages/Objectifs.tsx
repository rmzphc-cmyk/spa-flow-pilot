import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useObjectives, parseObjectiveDescription, type DbObjective } from "@/hooks/useObjectives";
import { useReports } from "@/hooks/useReports";
import { Loader2, Target, Info, Calendar, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type StatusUI = "on_track" | "at_risk" | "behind";

const statusConfig: Record<
  StatusUI,
  { label: string; badgeClass: string; barClass: string }
> = {
  on_track: {
    label: "En bonne voie",
    badgeClass: "bg-success text-success-foreground hover:bg-success",
    barClass: "bg-success",
  },
  at_risk: {
    label: "À risque",
    badgeClass: "bg-warning text-warning-foreground hover:bg-warning",
    barClass: "bg-warning",
  },
  behind: {
    label: "En retard",
    badgeClass: "bg-destructive text-destructive-foreground hover:bg-destructive",
    barClass: "bg-destructive",
  },
};

function formatDateFR(dateStr: string | null): string | null {
  if (!dateStr) return null;
  try {
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return null;
  }
}

function ObjectiveCard({
  objective,
  reportLabel,
}: {
  objective: DbObjective;
  reportLabel: string | null;
}) {
  const parsed = parseObjectiveDescription(objective.description);
  const progress =
    parsed.target > 0
      ? Math.min(100, Math.round((parsed.current / parsed.target) * 100))
      : 0;
  const config = statusConfig[parsed.status_ui] ?? statusConfig.on_track;
  const dueDate = formatDateFR(objective.target_date);

  return (
    <div className="bg-card rounded-card shadow-sm p-6 border border-border">
      <div className="flex items-start justify-between gap-4 mb-4">
        <h3 className="font-semibold text-foreground text-lg leading-tight">
          {objective.title}
        </h3>
        <Badge className={config.badgeClass}>{config.label}</Badge>
      </div>

      <div className="space-y-4">
        {/* Progress bar */}
        <div>
          <div className="flex justify-between text-sm mb-1.5">
            <span className="text-muted-foreground">
              {parsed.current}
              {parsed.unit} / {parsed.target}
              {parsed.unit}
            </span>
            <span className="font-medium text-foreground">{progress}%</span>
          </div>
          <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full ${config.barClass} rounded-full transition-all duration-500`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Due date */}
        {dueDate && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="w-4 h-4 shrink-0" />
            <span>Échéance : {dueDate}</span>
          </div>
        )}

        {/* Source report */}
        {reportLabel && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileText className="w-4 h-4 shrink-0" />
            <span>Créé lors de {reportLabel}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Objectifs() {
  const { spaId } = useAuth();
  const { data: objectives, isLoading } = useObjectives(spaId);
  const { data: reports } = useReports();

  const reportLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    reports?.forEach((r) => map.set(r.id, r.cycle_label));
    return map;
  }, [reports]);

  const activeCount = objectives?.length ?? 0;
  const atLimit = activeCount >= 3;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!objectives || objectives.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground">Objectifs</h1>
          <Badge variant="outline">0/3 actifs</Badge>
        </div>

        <div className="bg-accent/50 rounded-card p-4 flex items-start gap-3">
          <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <p className="text-sm text-accent-foreground">
            Les objectifs sont créés uniquement lors des post-réunions
            mensuelles.
          </p>
        </div>

        <div className="bg-card rounded-card shadow-sm border border-dashed border-border p-12 text-center">
          <Target className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            Aucun objectif actif — ils seront créés lors de votre prochaine
            réunion mensuelle
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-foreground">Objectifs</h1>
        <Badge variant="outline">{activeCount}/3 actifs</Badge>
      </div>

      <div className="bg-accent/50 rounded-card p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <p className="text-sm text-accent-foreground">
          {atLimit
            ? "Limite atteinte — créer uniquement via post-réunion"
            : "Les objectifs sont créés uniquement lors des post-réunions mensuelles."}
        </p>
      </div>

      <div className="grid gap-4">
        {objectives.map((obj) => (
          <ObjectiveCard
            key={obj.id}
            objective={obj}
            reportLabel={reportLabelMap.get(obj.report_id_created) ?? null}
          />
        ))}
      </div>
    </div>
  );
}
