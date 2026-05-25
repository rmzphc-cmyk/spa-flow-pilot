import { useEffect, useRef, useState } from "react";
import { getReportSection, updateReportSection, type SectionKey } from "./reportsStore";

/**
 * Persisted local state for a report section.
 * - Loads initial value from reports_data on mount (falls back to `initial` if null).
 * - Debounces writes (800ms) back into reports_data + fires "report-section-saved".
 */
export function usePersistedSection<T>(
  reportId: string,
  sectionKey: SectionKey | string,
  initial: T,
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    if (!reportId) return initial;
    const stored = getReportSection(reportId, sectionKey);
    return (stored as T) ?? initial;
  });

  const firstRun = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!reportId) return;
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      updateReportSection(reportId, sectionKey, state);
    }, 800);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [state, reportId, sectionKey]);

  return [state, setState];
}
