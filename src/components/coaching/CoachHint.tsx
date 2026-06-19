import { HelpCircle } from "lucide-react";
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
  /** Clé i18n de la surface (= surface_key dans coaching_content). */
  surfaceKey: string;
  className?: string;
  align?: "start" | "center" | "end";
  side?: "top" | "right" | "bottom" | "left";
}

/** Une section libellée de la carte (titre chrome i18n + contenu DB), masquée si vide. */
function HintSection({ label, value, tone }: { label: string; value: string | null; tone?: "benefice" | "example" }) {
  if (!value) return null;
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "text-xs leading-relaxed text-foreground",
          tone === "benefice" && "rounded-md bg-teal-50 px-2 py-1.5 text-teal-900",
          tone === "example" && "italic text-muted-foreground",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function HintBody({ hint }: { hint: CoachingHint }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-2.5">
      <p className="text-sm font-medium leading-snug text-foreground">{hint.quoi}</p>
      <HintSection label={t("coach.pourquoi")} value={hint.pourquoi} />
      <HintSection label={t("coach.benefice")} value={hint.benefice_metier} tone="benefice" />
      <HintSection label={t("coach.objection")} value={hint.objection} />
      <HintSection label={t("coach.exemple")} value={hint.exemple} tone="example" />
      <HintSection label={t("coach.piege")} value={hint.piege} />
    </div>
  );
}

/**
 * Coach contextuel opt-in : petite icône (?) qui ouvre une carte « Pourquoi /
 * En quoi ça t'aide / Exemple ». Non bloquant : si aucune unité n'est attachée
 * à la surface (ou pendant le chargement), rien ne s'affiche.
 */
export function CoachHint({ surfaceKey, className, align = "start", side = "bottom" }: CoachHintProps) {
  const { t } = useTranslation();
  const { data: hints } = useCoaching(surfaceKey);

  if (!hints || hints.length === 0) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t("coach.ariaOpen")}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted-foreground/70 transition-colors hover:bg-teal-50 hover:text-teal-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40",
            className,
          )}
        >
          <HelpCircle className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        side={side}
        className="w-80 p-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1.5 border-b px-3 py-2">
          <HelpCircle className="h-3.5 w-3.5 text-teal-600" />
          <span className="text-xs font-semibold text-teal-700">{t("coach.title")}</span>
        </div>
        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-3 p-3">
            {hints.map((hint, i) => (
              <div key={hint.id}>
                {i > 0 && <div className="mb-3 border-t" />}
                <HintBody hint={hint} />
              </div>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

export default CoachHint;
