// Meeting schedule helpers.
// Convention used in storage: 0 = Monday, 6 = Sunday.

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type MonthlyMode = "weekday" | "date";

export interface MeetingSchedule {
  weekly_day: number; // 0=Mon..6=Sun
  monthly_mode: MonthlyMode;
  monthly_week: number; // 1..4 or 5 (=Last)
  monthly_day: number; // 0=Mon..6=Sun
  monthly_date: number; // 1..31 (32 = last day of month)
}

export const DEFAULT_SCHEDULE: MeetingSchedule = {
  weekly_day: 3,
  monthly_mode: "weekday",
  monthly_week: 1,
  monthly_day: 0,
  monthly_date: 1,
};

const STORAGE_KEY = "meeting_schedule";

function toISO(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

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

export async function saveScheduleToDb(schedule: MeetingSchedule): Promise<void> {
  const { error } = await supabase.functions.invoke("update-meeting-schedule", {
    body: { meeting_schedule: schedule },
  });
  if (error) throw new Error(error.message ?? "Erreur de sauvegarde du calendrier");
  saveSchedule(schedule);
}

// Convert "0=Mon..6=Sun" to JS Date.getDay() "0=Sun..6=Sat"
function toJsDay(d: number) {
  return (d + 1) % 7;
}

export function nextWeeklyMeeting(weeklyDay: number, from: Date = new Date()): Date {
  const target = toJsDay(weeklyDay);
  const base = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  let diff = (target - base.getDay() + 7) % 7;
  if (diff === 0) diff = 7;
  const d = new Date(base);
  d.setDate(base.getDate() + diff);
  return d;
}

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

export function computeWeeklyPeriodForNextMeeting(
  weeklyDay: number,
  from: Date = new Date()
): { meetingDate: Date; periodStart: string; periodEnd: string } {
  const todayJsDay = from.getDay();
  const meetingJsDay = (weeklyDay + 1) % 7;
  let meetingDate: Date;
  if (todayJsDay === meetingJsDay) {
    meetingDate = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  } else {
    meetingDate = nextWeeklyMeeting(weeklyDay, from);
  }
  const periodEnd = new Date(meetingDate.getFullYear(), meetingDate.getMonth(), meetingDate.getDate() - 1);
  const periodStart = new Date(periodEnd.getFullYear(), periodEnd.getMonth(), periodEnd.getDate() - 6);
  return { meetingDate, periodStart: toISO(periodStart), periodEnd: toISO(periodEnd) };
}

export function computePreviousWeeklyPeriod(
  weeklyDay: number,
  from: Date = new Date()
): { periodStart: string; periodEnd: string; meetingDate: Date } {
  const current = computeWeeklyPeriodForNextMeeting(weeklyDay, from);
  const currentStart = new Date(current.periodStart + "T12:00:00");
  const prevEnd = new Date(currentStart.getFullYear(), currentStart.getMonth(), currentStart.getDate() - 1);
  const prevStart = new Date(prevEnd.getFullYear(), prevEnd.getMonth(), prevEnd.getDate() - 6);
  const prevMeeting = new Date(prevEnd.getFullYear(), prevEnd.getMonth(), prevEnd.getDate() + 1);
  return { periodStart: toISO(prevStart), periodEnd: toISO(prevEnd), meetingDate: prevMeeting };
}

export function computeWeeklyLabel(periodStart: string): string {
  const d = new Date(periodStart + "T12:00:00");
  const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const diff = (target.getTime() - firstThursday.getTime()) / 86400000;
  const weekNum = 1 + Math.round((diff - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `Semaine ${weekNum} — ${d.getFullYear()}`;
}

export interface WeeklyPeriodOption {
  periodStart: string;
  periodEnd: string;
  label: string;
  display: string;
}

export function getAvailableWeeklyPeriods(
  weeklyDay: number,
  existingPeriodStarts: string[],
  count: number = 10
): WeeklyPeriodOption[] {
  const FR = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" });
  const toLocalISO = (d: Date): string =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const result: WeeklyPeriodOption[] = [];
  let current = computeWeeklyPeriodForNextMeeting(weeklyDay);

  for (let i = 0; i < count + existingPeriodStarts.length; i++) {
    const { periodStart, periodEnd } = current;
    if (!existingPeriodStarts.includes(periodStart)) {
      const label = computeWeeklyLabel(periodStart);
      const startDate = new Date(periodStart + "T12:00:00");
      const endDate = new Date(periodEnd + "T12:00:00");
      result.push({
        periodStart,
        periodEnd,
        label,
        display: `${label} — ${FR.format(startDate)} → ${FR.format(endDate)} ${endDate.getFullYear()}`,
      });
      if (result.length >= count) break;
    }
    const prevEnd = new Date(periodStart + "T12:00:00");
    prevEnd.setDate(prevEnd.getDate() - 1);
    const prevStart = new Date(prevEnd.getFullYear(), prevEnd.getMonth(), prevEnd.getDate() - 6);
    current = {
      meetingDate: new Date(prevEnd.getFullYear(), prevEnd.getMonth(), prevEnd.getDate() + 1),
      periodStart: toLocalISO(prevStart),
      periodEnd: toLocalISO(prevEnd),
    };
  }
  return result;
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

export function useMeetingSchedule(): MeetingSchedule & { isScheduleConfigured: boolean } {
  const { spaId } = useAuth();
  const [localSchedule, setLocalSchedule] = useState<MeetingSchedule>(() => loadSchedule());

  useEffect(() => {
    const refresh = () => setLocalSchedule(loadSchedule());
    window.addEventListener("storage", refresh);
    window.addEventListener("meeting-schedule-changed", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("meeting-schedule-changed", refresh);
    };
  }, []);

  const { data: spa } = useQuery({
    queryKey: ["spa-schedule", spaId],
    queryFn: async () => {
      if (!spaId) return null;
      const { data } = await supabase
        .from("spas")
        .select("meeting_schedule")
        .eq("id", spaId)
        .maybeSingle();
      return data;
    },
    enabled: !!spaId,
    staleTime: 5_000,
  });

  const dbSchedule = spa?.meeting_schedule as Partial<MeetingSchedule> | null | undefined;
  const isScheduleConfigured = !!dbSchedule;
  const schedule = dbSchedule
    ? { ...DEFAULT_SCHEDULE, ...dbSchedule }
    : localSchedule;

  return { ...schedule, isScheduleConfigured };
}
