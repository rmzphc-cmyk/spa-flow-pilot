import { useState, useEffect } from "react";
import { Check, AlertTriangle } from "lucide-react";

export function AutosaveIndicator() {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const display = seconds < 5
    ? "Sauvegardé"
    : `Sauvegardé il y a ${seconds}s`;

  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Check className="h-3 w-3 text-emerald-500" />
      {display}
    </span>
  );
}
