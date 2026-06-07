import { useState, useEffect } from "react";
import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { REPORT_SECTION_SAVED_EVENT } from "@/lib/reportsStore";

export function AutosaveIndicator() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let hideTimer: ReturnType<typeof setTimeout> | null = null;
    const onSaved = () => {
      setVisible(true);
      if (hideTimer) clearTimeout(hideTimer);
      hideTimer = setTimeout(() => setVisible(false), 2000);
    };
    window.addEventListener(REPORT_SECTION_SAVED_EVENT, onSaved);
    return () => {
      window.removeEventListener(REPORT_SECTION_SAVED_EVENT, onSaved);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <span className="flex items-center gap-1.5 text-xs text-emerald-600 transition-opacity">
      <Check className="h-3 w-3" />
      {t("report.autosave.saved")}
    </span>
  );
}
