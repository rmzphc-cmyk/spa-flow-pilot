export type ReportType = "monthly" | "weekly";
export type ReportState =
  | "draft_preparation"
  | "ready_for_review"
  | "in_meeting"
  | "post_meeting_generated"
  | "validated";

export interface ReportRecord {
  id: string;
  type: ReportType;
  label: string;
  period: string;
  state: ReportState;
  updatedAt: string;
  meetingDate: string | null;
  completion: number;
}

export const reportsData: ReportRecord[] = [
  { id: "r1", type: "monthly", label: "Monthly — Mars 2026", period: "1 mars → 31 mars 2026", state: "draft_preparation", updatedAt: "Aujourd'hui, 09h14", meetingDate: "28 mars 2026", completion: 29 },
  { id: "r6", type: "weekly", label: "Weekly — Semaine 13", period: "25 → 31 mars 2026", state: "draft_preparation", updatedAt: "Aujourd'hui, 08h00", meetingDate: "26 mars 2026", completion: 14 },
  { id: "r2", type: "weekly", label: "Weekly — Semaine 12", period: "18 → 24 mars 2026", state: "validated", updatedAt: "25 mars 2026", meetingDate: "19 mars 2026", completion: 100 },
  { id: "r3", type: "monthly", label: "Monthly — Février 2026", period: "1 fév → 28 fév 2026", state: "validated", updatedAt: "3 mars 2026", meetingDate: "28 fév 2026", completion: 100 },
  { id: "r4", type: "weekly", label: "Weekly — Semaine 11", period: "11 → 17 mars 2026", state: "validated", updatedAt: "18 mars 2026", meetingDate: "12 mars 2026", completion: 100 },
  { id: "r5", type: "monthly", label: "Monthly — Janvier 2026", period: "1 jan → 31 jan 2026", state: "validated", updatedAt: "2 fév 2026", meetingDate: "30 jan 2026", completion: 100 },
  { id: "r7", type: "monthly", label: "Monthly — Décembre 2025", period: "1 déc → 31 déc 2025", state: "validated", updatedAt: "3 jan 2026", meetingDate: "30 déc 2025", completion: 100 },
  { id: "r8", type: "weekly", label: "Weekly — Semaine 10", period: "4 → 10 mars 2026", state: "validated", updatedAt: "11 mars 2026", meetingDate: "5 mars 2026", completion: 100 },
];

export function getReport(id: string | undefined): ReportRecord | undefined {
  return reportsData.find((r) => r.id === id);
}

export function isPreparationState(s: ReportState): boolean {
  return s === "draft_preparation" || s === "ready_for_review";
}

export function isMeetingState(s: ReportState): boolean {
  return s === "in_meeting" || s === "post_meeting_generated" || s === "validated";
}

export const stateConfig: Record<ReportState, { label: string; bg: string; text: string }> = {
  draft_preparation: { label: "Brouillon", bg: "bg-muted", text: "text-muted-foreground" },
  ready_for_review: { label: "En cours", bg: "bg-blue-100", text: "text-blue-800" },
  in_meeting: { label: "En réunion", bg: "bg-orange-100", text: "text-orange-800" },
  post_meeting_generated: { label: "Synthèse prête", bg: "bg-violet-100", text: "text-violet-800" },
  validated: { label: "Validé", bg: "bg-emerald-100", text: "text-emerald-800" },
};
