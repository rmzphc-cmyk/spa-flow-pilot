import { Sparkles } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { useTranslation } from "react-i18next";

interface AiBadgeProps {
  className?: string;
}

export function AiBadge({ className = "" }: AiBadgeProps) {
  const { t } = useTranslation();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium cursor-default absolute top-3 right-3 ${className}`}
          style={{ backgroundColor: "#E0F2F1", color: "#006B6B" }}
        >
          <Sparkles className="h-3 w-3" />
          {t("ai.badge")}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-[260px] text-xs">
        {t("ai.tooltip")}
      </TooltipContent>
    </Tooltip>
  );
}
