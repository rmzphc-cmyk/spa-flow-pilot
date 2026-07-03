import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { CalendarClock } from "lucide-react";
import {
  objectiveStatusMeta,
  type ObjectiveStatusUi,
} from "@/lib/objectiveDisplay";

/**
 * Briques PARTAGÉES des cartes objectif (Phase 3) — badges et ligne de
 * progression communes aux 3 rendus (SectionObjectifs, /objectifs,
 * MeetingView). Chaque carte garde sa mise en page, mais le sens (couleurs,
 * libellés, calculs) vient d'ici.
 */

interface ObjectiveBadgesProps {
  isProject: boolean;
  /** Tag manuel du bilan mensuel — omis pour les cartes clôturées. */
  statusUi?: ObjectiveStatusUi | string;
  overdue?: boolean;
  /** Badge d'historique (remplace le badge de statut). */
  closedStatus?: "achieved" | "abandoned";
}

export function ObjectiveBadges({ isProject, statusUi, overdue = false, closedStatus }: ObjectiveBadgesProps) {
  const { t } = useTranslation();
  const meta = statusUi && !closedStatus ? objectiveStatusMeta(statusUi) : null;
  return (
    <span className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
      {isProject && <Badge variant="secondary">{t("objectifs.form.typeSteps")}</Badge>}
      {overdue && (
        <Badge variant="outline" className="border-destructive text-destructive gap-1">
          <CalendarClock className="h-3 w-3" />
          {t("objectifs.overdue")}
        </Badge>
      )}
      {closedStatus === "achieved" && (
        <Badge className="bg-success text-success-foreground hover:bg-success">
          {t("objectifs.history.achievedBadge")}
        </Badge>
      )}
      {closedStatus === "abandoned" && (
        <Badge variant="secondary" className="text-muted-foreground">
          {t("objectifs.history.abandonedBadge")}
        </Badge>
      )}
      {meta && <Badge className={meta.badgeClass}>{t(meta.labelKey)}</Badge>}
    </span>
  );
}

interface ObjectiveProgressRowProps {
  current: number;
  target: number;
  unit: string;
  isProject: boolean;
  progress: number;
  barClass: string;
  /** Remplace la valeur affichée à gauche (ex. Input du bilan mensuel). */
  valueSlot?: ReactNode;
}

export function ObjectiveProgressRow({
  current,
  target,
  unit,
  isProject,
  progress,
  barClass,
  valueSlot,
}: ObjectiveProgressRowProps) {
  return (
    <div className="flex items-center gap-3">
      {valueSlot ?? (
        <span className="text-sm font-semibold text-foreground tabular-nums shrink-0">
          {isProject ? `${current}/${target}` : `${current}${unit}`}
        </span>
      )}
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barClass}`}
          style={{ width: `${progress}%` }}
        />
      </div>
      {!isProject && (
        <span className="text-sm text-muted-foreground tabular-nums shrink-0">
          {target}
          {unit}
        </span>
      )}
      <span className="text-sm font-medium text-foreground w-12 text-right tabular-nums">
        {progress}%
      </span>
    </div>
  );
}
