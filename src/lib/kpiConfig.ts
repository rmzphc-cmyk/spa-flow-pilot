// KPI config storage layer with monthly + weekly targets per ISO week
export type KpiCategory = "spa" | "manager";

export interface KpiWeeklyMap {
  [isoWeek: string]: number; // e.g. "2026-W01"
}
export interface KpiMonthlyTarget {
  target: number;
  weekly_targets: KpiWeeklyMap;
}
export interface KpiMonthlyMap {
  [yyyymm: string]: KpiMonthlyTarget; // e.g. "2026-01"
}
export interface KpiConfigItem {
  id: string;
  name: string;
  unit: string;
  category: KpiCategory;
  monthly_targets: KpiMonthlyMap;
}

const STORAGE_KEY = "kpi_config";

const DEFAULTS: KpiConfigItem[] = [
  { id: "k1", name: "CA du mois", unit: "€", category: "spa", monthly_targets: {} },
  { id: "k2", name: "Taux d'occupation cabines", unit: "%", category: "spa", monthly_targets: {} },
  { id: "k3", name: "Panier moyen", unit: "€", category: "spa", monthly_targets: {} },
  { id: "k4", name: "NPS clients", unit: "/10", category: "spa", monthly_targets: {} },
  { id: "k5", name: "Ventes produits", unit: "€", category: "spa", monthly_targets: {} },
  { id: "k6", name: "Absentéisme équipe", unit: "j", category: "manager", monthly_targets: {} },
];

export function sortKpis(items: KpiConfigItem[]): KpiConfigItem[] {
  return [...items].sort((a, b) => {
    if (a.category !== b.category) return a.category === "spa" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}


export function loadKpiConfig(): KpiConfigItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    return DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

export function saveKpiConfig(items: KpiConfigItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent("kpi-config-changed"));
}

// ----- date helpers -----

export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function parseMonthKey(key: string): Date {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1);
}

// ISO week number ("YYYY-Www")
export function isoWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

// Returns ordered list of ISO week keys for the weeks intersecting the given month
export function weeksInMonth(monthKeyStr: string): string[] {
  const [y, m] = monthKeyStr.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const last = new Date(y, m, 0);
  const set = new Set<string>();
  const order: string[] = [];
  for (let d = new Date(first); d <= last; d.setDate(d.getDate() + 1)) {
    const k = isoWeekKey(d);
    if (!set.has(k)) {
      set.add(k);
      order.push(k);
    }
  }
  return order;
}

// Convention: 0=Mon..6=Sun (same as meetingSchedule). Returns the ISO weeks
// containing each occurrence of `weeklyDay` within the given month — i.e. the
// weeks that will host a weekly meeting.
export function weeksForMeetings(monthKeyStr: string, weeklyDay: number): string[] {
  const [y, m] = monthKeyStr.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  const jsTarget = (weeklyDay + 1) % 7; // map to JS getDay (0=Sun..6=Sat)
  const set = new Set<string>();
  const order: string[] = [];
  for (let day = 1; day <= last; day++) {
    const d = new Date(y, m - 1, day);
    if (d.getDay() !== jsTarget) continue;
    const k = isoWeekKey(d);
    if (!set.has(k)) {
      set.add(k);
      order.push(k);
    }
  }
  return order;
}


export function shiftMonth(monthKeyStr: string, delta: number): string {
  const d = parseMonthKey(monthKeyStr);
  d.setMonth(d.getMonth() + delta);
  return monthKey(d);
}

export function monthLabel(monthKeyStr: string): string {
  const d = parseMonthKey(monthKeyStr);
  return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

// Find the most recent saved monthly target before the given month (returns null if none)
export function lastMonthlyTarget(
  item: KpiConfigItem,
  beforeMonth: string,
): { month: string; value: number } | null {
  const months = Object.keys(item.monthly_targets)
    .filter((m) => m < beforeMonth)
    .sort();
  for (let i = months.length - 1; i >= 0; i--) {
    const v = item.monthly_targets[months[i]]?.target;
    if (typeof v === "number" && !isNaN(v)) return { month: months[i], value: v };
  }
  return null;
}

export function lastWeeklyTarget(
  item: KpiConfigItem,
  beforeWeek: string,
): { week: string; value: number } | null {
  const weeks: { week: string; value: number }[] = [];
  for (const m of Object.keys(item.monthly_targets)) {
    const wt = item.monthly_targets[m]?.weekly_targets || {};
    for (const w of Object.keys(wt)) {
      if (w < beforeWeek && typeof wt[w] === "number" && !isNaN(wt[w])) {
        weeks.push({ week: w, value: wt[w] });
      }
    }
  }
  weeks.sort((a, b) => (a.week < b.week ? -1 : 1));
  return weeks.length ? weeks[weeks.length - 1] : null;
}

export function getMonthlyTarget(item: KpiConfigItem, monthKeyStr: string): number | null {
  const v = item.monthly_targets[monthKeyStr]?.target;
  return typeof v === "number" && !isNaN(v) ? v : null;
}

export function getWeeklyTarget(item: KpiConfigItem, isoWeek: string): number | null {
  for (const m of Object.keys(item.monthly_targets)) {
    const wt = item.monthly_targets[m]?.weekly_targets || {};
    if (typeof wt[isoWeek] === "number" && !isNaN(wt[isoWeek])) return wt[isoWeek];
  }
  return null;
}
