// Meeting schedule helpers.
// Convention used in storage: 0 = Monday, 6 = Sunday.

export interface MeetingSchedule {
  weekly_day: number; // 0=Mon..6=Sun
  monthly_week: number; // 1..4 or 5 (=Last)
  monthly_day: number; // 0=Mon..6=Sun
}

export const DEFAULT_SCHEDULE: MeetingSchedule = {
  weekly_day: 3, // Thursday
  monthly_week: 1, // 1st
  monthly_day: 0, // Monday
};

const STORAGE_KEY = "meeting_schedule";

export function loadSchedule(): MeetingSchedule {
  if (typeof window === "undefined") return DEFAULT_SCHEDULE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SCHEDULE;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SCHEDULE, ...parsed };
  } catch {
    return DEFAULT_SCHEDULE;
  }
}

export function saveSchedule(s: MeetingSchedule) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

// Convert "0=Mon..6=Sun" to JS Date.getDay() "0=Sun..6=Sat"
function toJsDay(d: number) {
  return (d + 1) % 7;
}

export function nextWeeklyMeeting(weeklyDay: number, from: Date = new Date()): Date {
  const target = toJsDay(weeklyDay);
  const base = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  let diff = (target - base.getDay() + 7) % 7;
  if (diff === 0) diff = 7; // next occurrence, not today
  const d = new Date(base);
  d.setDate(base.getDate() + diff);
  return d;
}

// nth occurrence of a given weekday in month (week 5 = last)
function occurrenceInMonth(year: number, month: number, week: number, day: number): Date | null {
  const target = toJsDay(day);
  if (week === 5) {
    const last = new Date(year, month + 1, 0);
    const offset = (last.getDay() - target + 7) % 7;
    return new Date(year, month, last.getDate() - offset);
  }
  const first = new Date(year, month, 1);
  const firstOffset = (target - first.getDay() + 7) % 7;
  const dayNum = 1 + firstOffset + (week - 1) * 7;
  const last = new Date(year, month + 1, 0).getDate();
  if (dayNum > last) return null;
  return new Date(year, month, dayNum);
}

export function nextMonthlyMeeting(
  monthlyWeek: number,
  monthlyDay: number,
  from: Date = new Date(),
): Date {
  const base = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  let d = occurrenceInMonth(base.getFullYear(), base.getMonth(), monthlyWeek, monthlyDay);
  if (!d || d <= base) {
    d = occurrenceInMonth(base.getFullYear(), base.getMonth() + 1, monthlyWeek, monthlyDay)!;
  }
  return d;
}

export function daysUntil(date: Date, from: Date = new Date()): number {
  const a = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const b = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  return Math.round((a - b) / 86400000);
}

export function badgeColorForDays(days: number): { bg: string; text: string } {
  if (days <= 1) return { bg: "bg-red-100", text: "text-red-800" };
  if (days <= 3) return { bg: "bg-orange-100", text: "text-orange-800" };
  if (days <= 7) return { bg: "bg-yellow-100", text: "text-yellow-800" };
  return { bg: "bg-emerald-100", text: "text-emerald-800" };
}

export const DAY_LABELS_FR = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
export const WEEK_LABELS_FR = ["1er", "2ème", "3ème", "4ème", "Dernier"];
