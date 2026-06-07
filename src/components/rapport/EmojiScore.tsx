import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

const EMOJIS = ["😫", "😕", "😐", "😊", "🌟"] as const;
const LABELS = ["Difficile", "Tendu", "Stable", "Bien", "Excellent"] as const;

interface Props {
  value: number; // 0 (unset) or 1..5
  onChange: (v: number) => void;
}

export function EmojiScore({ value, onChange }: Props) {
  const { t } = useTranslation();
  const labelKeys = [
    "report.emojiScore.label1",
    "report.emojiScore.label2",
    "report.emojiScore.label3",
    "report.emojiScore.label4",
    "report.emojiScore.label5",
  ] as const;

  return (
    <div>
      <div className="flex items-center gap-2">
        {EMOJIS.map((emoji, i) => {
          const score = i + 1;
          const selected = value === score;
          return (
            <button
              key={score}
              type="button"
              onClick={() => onChange(score)}
              aria-label={`${score} — ${t(labelKeys[i])}`}
              className={cn(
                "flex-1 h-14 rounded-xl border-2 text-2xl transition-all flex items-center justify-center",
                selected
                  ? "border-primary bg-primary/10 scale-105 shadow-sm"
                  : "border-border bg-muted/30 opacity-50 hover:opacity-100 hover:bg-muted",
              )}
            >
              <span aria-hidden>{emoji}</span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-center mt-2 text-muted-foreground min-h-[1rem]">
        {value > 0 ? t(labelKeys[value - 1]) : t("report.emojiScore.selectPrompt")}
      </p>
    </div>
  );
}

export const EMOJI_SCORE_LABELS = LABELS;
