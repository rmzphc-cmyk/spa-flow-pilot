import { Lightbulb } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useCoaching, type CoachingHint } from "@/hooks/useCoaching";

interface CoachHintProps {
  /** Clé i18n de l'en-tête de section (= surface_key dans coaching_content). */
  surfaceKey: string;
  className?: string;
  align?: "start" | "center" | "end";
  side?: "top" | "right" | "bottom" | "left";
}

/** Un bloc libellé du panneau (titre chrome i18n + contenu DB), masqué si vide. */
function PanelBlock({
  label,
  value,
  preLine,
}: {
  label: string;
  value: string | null;
  preLine?: boolean;
}) {
  if (!value) return null;
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-teal-700">
        {label}
      </p>
      <p
        className={cn(
          "text-xs leading-relaxed text-foreground",
          preLine && "whitespace-pre-line",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function PanelBody({ hint }: { hint: CoachingHint }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      <PanelBlock label={t("coach.pourquoi")} value={hint.pourquoi} />
      <PanelBlock label={t("coach.comment")} value={hint.comment} preLine />
      <PanelBlock label={t("coach.exemple")} value={hint.exemple} preLine />
      {hint.a_retenir && (
        <div className="rounded-md bg-teal-50 px-2.5 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-teal-700">
            {t("coach.aRetenir")}
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-teal-900">{hint.a_retenir}</p>
        </div>
      )}
    </div>
  );
}

/**
 * Coach contextuel opt-in : un lien discret « 💡 Pourquoi & comment ? » sous
 * l'en-tête d'une section, qui ouvre un panneau « pourquoi / comment je remplis
 * ça ». Non bloquant : si aucune unité n'est rattachée à la surface (ou pendant
 * le chargement / avant migration), rien ne s'affiche.
 */
export function CoachHint({
  surfaceKey,
  className,
  align = "start",
  side = "bottom",
}: CoachHintProps) {
  const { t } = useTranslation();
  const { data: hints } = useCoaching(surfaceKey);

  if (!hints || hints.length === 0) return null;
  const hint = hints[0];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "inline-flex items-center gap-1 rounded-full text-xs font-medium text-teal-600 transition-colors hover:text-teal-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40",
            className,
          )}
        >
          <Lightbulb className="h-3.5 w-3.5" />
          {t("coach.trigger")}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        side={side}
        className="w-[22rem] p-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1.5 border-b px-3 py-2">
          <Lightbulb className="h-3.5 w-3.5 text-teal-600" />
          <span className="text-xs font-semibold text-teal-700">{hint.titre}</span>
        </div>
        <ScrollArea className="max-h-[60vh]">
          <div className="p-3">
            <PanelBody hint={hint} />
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

export default CoachHint;
