// Meeting schedule helpers.
// Convention used in storage: 0 = Monday, 6 = Sunday.

export type MonthlyMode = "weekday" | "date";

export interface MeetingSchedule {
  weekly_day: number; // 0=Mon..6=Sun
  monthly_mode: MonthlyMode; // "weekday" = nth weekday, "date" = exact day of month
  monthly_week: number; // 1..4 or 5 (=Last) — used when monthly_mode === "weekday"
  monthly_day: number; // 0=Mon..6=Sun — used when monthly_mode === "weekday"
  monthly_date: number; // 1..31 (32 = last day of month) — used when monthly_mode === "date"
}

export const DEFAULT_SCHEDULE: MeetingSchedule = {
  weekly_day: 3, // Thursday
  monthly_mode: "weekday",
  monthly_week: 1, // 1st
  monthly_day: 0, // Monday
  monthly_date: 1,
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
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("meeting-schedule-changed"));
  }
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

function dateInMonth(year: number, month: number, dom: number): Date {
  const lastDay = new Date(year, month + 1, 0).getDate();
  // 32 (or any value > lastDay) = last day of month
  const day = dom >= 32 ? lastDay : Math.min(dom, lastDay);
  return new Date(year, month, day);
}

export function nextMonthlyMeeting(schedule: MeetingSchedule, from: Date = new Date()): Date {
  const base = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const resolve = (year: number, month: number): Date | null => {
    if (schedule.monthly_mode === "date") {
      return dateInMonth(year, month, schedule.monthly_date);
    }
    return occurrenceInMonth(year, month, schedule.monthly_week, schedule.monthly_day);
  };
  let d = resolve(base.getFullYear(), base.getMonth());
  if (!d || d <= base) {
    d = resolve(base.getFullYear(), base.getMonth() + 1)!;
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

export function describeSchedule(s: MeetingSchedule): { weekly: string; monthly: string } {
  const weekly = `Tous les ${DAY_LABELS_FR[s.weekly_day].toLowerCase()}s`;
  let monthly: string;
  if (s.monthly_mode === "date") {
    monthly =
      s.monthly_date >= 32
        ? "Le dernier jour du mois"
        : `Le ${s.monthly_date}${s.monthly_date === 1 ? "er" : ""} de chaque mois`;
  } else {
    monthly = `${WEEK_LABELS_FR[s.monthly_week - 1]} ${DAY_LABELS_FR[s.monthly_day].toLowerCase()} du mois`;
  }
  return { weekly, monthly };
}
