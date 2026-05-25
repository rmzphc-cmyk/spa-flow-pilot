export type ReportType = "monthly" | "weekly";
export type ReportState =
  | "draft_preparation"
  | "ready_for_review"
  | "in_meeting"
  | "post_meeting_generated"
  | "validated";

export interface KpiActual {
  kpiId: string;
  name: string;
  unit: string;
  target: number;
  actual: number;
  comment: string;
}

export interface TodoItem {
  id: string;
  label: string;
  status: "todo" | "in_progress" | "done" | "postponed";
  owner?: string;
  origin?: string; // e.g. "IDS W14" if it came from a previous blocker
  note?: string; // Commentaire de suivi (Retours positifs / Repoussé pour congé...)
  dueDate?: string;
}

export interface ObjectiveItem {
  id: string;
  label: string;
  progress: number; // 0..100
  note?: string;
}

export interface CheckinData {
  mood: number; // 1..10
  note: string;
  teamWeather: string;
}

export interface ResponsibilityScore {
  axis: string;
  score: "Excellent" | "Bon" | "Insuffisant";
  justification: string;
}

export interface IdsItem {
  id: string;
  issue: string;
  discussion: string;
  solution: string;
  resolved: boolean;
}

export interface Commitment {
  id: string;
  decision: string;
  owner?: string;
}

export interface ReportDetails {
  kpis: KpiActual[];
  checkin: CheckinData;
  todos: TodoItem[];
  objectives: ObjectiveItem[];
  responsibilities: ResponsibilityScore[];
  ids: IdsItem[];
  commitments: Commitment[];
  nextMeeting?: string;
}

export interface ReportRecord {
  id: string;
  type: ReportType;
  label: string;
  period: string;
  state: ReportState;
  updatedAt: string;
  meetingDate: string | null;
  completion: number;
  spaKey?: string;
  details?: ReportDetails;
}

const REPORTS_KEY = "reports_data";

const defaultReports: ReportRecord[] = [
  { id: "r1", type: "monthly", label: "Monthly — Mars 2026", period: "1 mars → 31 mars 2026", state: "draft_preparation", updatedAt: "Aujourd'hui, 09h14", meetingDate: "28 mars 2026", completion: 29 },
  { id: "r6", type: "weekly", label: "Weekly — Semaine 13", period: "25 → 31 mars 2026", state: "draft_preparation", updatedAt: "Aujourd'hui, 08h00", meetingDate: "26 mars 2026", completion: 14 },
  { id: "r2", type: "weekly", label: "Weekly — Semaine 12", period: "18 → 24 mars 2026", state: "validated", updatedAt: "25 mars 2026", meetingDate: "19 mars 2026", completion: 100 },
  { id: "r3", type: "monthly", label: "Monthly — Février 2026", period: "1 fév → 28 fév 2026", state: "validated", updatedAt: "3 mars 2026", meetingDate: "28 fév 2026", completion: 100 },
  { id: "r4", type: "weekly", label: "Weekly — Semaine 11", period: "11 → 17 mars 2026", state: "validated", updatedAt: "18 mars 2026", meetingDate: "12 mars 2026", completion: 100 },
  { id: "r5", type: "monthly", label: "Monthly — Janvier 2026", period: "1 jan → 31 jan 2026", state: "validated", updatedAt: "2 fév 2026", meetingDate: "30 jan 2026", completion: 100 },
  { id: "r7", type: "monthly", label: "Monthly — Décembre 2025", period: "1 déc → 31 déc 2025", state: "validated", updatedAt: "3 jan 2026", meetingDate: "30 déc 2025", completion: 100 },
  { id: "r8", type: "weekly", label: "Weekly — Semaine 10", period: "4 → 10 mars 2026", state: "validated", updatedAt: "11 mars 2026", meetingDate: "5 mars 2026", completion: 100 },
];

function loadReports(): ReportRecord[] {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(REPORTS_KEY) : null;
    if (!raw) return defaultReports;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {}
  return defaultReports;
}

export const reportsData: ReportRecord[] = loadReports();

export function setReports(next: ReportRecord[]) {
  reportsData.splice(0, reportsData.length, ...next);
  try {
    localStorage.setItem(REPORTS_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("reports-data-changed"));
  } catch {}
}

export function hasStoredReports(): boolean {
  try {
    const raw = localStorage.getItem(REPORTS_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0;
  } catch {
    return false;
  }
}

export const REPORTS_STORAGE_KEY = REPORTS_KEY;

export function getReport(id: string | undefined): ReportRecord | undefined {
  return reportsData.find((r) => r.id === id);
}

export type SectionKey = "checkin" | "kpi" | "responsabilites" | "todo" | "objectifs" | "ids" | "cloture";

export const REPORT_SECTION_SAVED_EVENT = "report-section-saved";

export function getReportSection(reportId: string, sectionKey: SectionKey | string): unknown | null {
  if (!reportId) return null;
  const r = reportsData.find((x) => x.id === reportId);
  if (!r || !r.details) return null;
  const v = (r.details as unknown as Record<string, unknown>)[sectionKey];
  return v === undefined ? null : v;
}

export function updateReportSection(reportId: string, sectionKey: SectionKey | string, data: unknown): void {
  if (!reportId) return;
  const idx = reportsData.findIndex((x) => x.id === reportId);
  if (idx === -1) return;
  const current = reportsData[idx];
  const details = { ...(current.details ?? {}) } as Record<string, unknown>;
  details[sectionKey] = data;
  const next: ReportRecord = { ...current, details: details as unknown as ReportDetails, updatedAt: new Date().toISOString() };
  const list = [...reportsData];
  list[idx] = next;
  reportsData.splice(0, reportsData.length, ...list);
  try {
    localStorage.setItem(REPORTS_KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent(REPORT_SECTION_SAVED_EVENT, { detail: { reportId, sectionKey } }));
  } catch {}
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
