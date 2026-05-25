/**
 * Seed demo data for the SPA OMS app.
 *
 * Rules:
 * - Reads (never writes) `kpi_config` and `resp_config` (resp_templates_v1 /
 *   resp_assignments_v1).
 * - Writes mock reports into the `reports_data` localStorage key used by
 *   `src/lib/reportsStore.ts`.
 * - Generates April (W14–W17 + Monthly) as `validated` and May
 *   (W18–W20 validated, W21 + Monthly draft).
 */
import {
  setReports,
  hasStoredReports,
  REPORTS_STORAGE_KEY,
  type ReportRecord,
  type ReportDetails,
  type TodoItem,
  type IdsItem,
  type KpiActual,
  type ObjectiveItem,
  type ResponsibilityScore,
  type Commitment,
} from "@/lib/reportsStore";

// ---------- safe localStorage readers (never write) ----------

interface KpiConfigItem {
  id: string;
  name: string;
  unit: string;
  category: string;
  monthly_targets: Record<string, { target: number; weekly_targets: Record<string, number> }>;
}

interface RespTemplate {
  id: string;
  name: string;
  category: string;
  frequency: string;
  active: boolean;
}

function readKpiConfig(): KpiConfigItem[] {
  try {
    const raw = localStorage.getItem("kpi_config");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readRespTemplates(): RespTemplate[] {
  try {
    const raw = localStorage.getItem("resp_templates_v1");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ---------- KPI fallbacks if config has no values ----------

const FALLBACK_KPIS: KpiConfigItem[] = [
  { id: "k1", name: "CA du mois", unit: "€", category: "spa", monthly_targets: {} },
  { id: "k2", name: "Taux d'occupation cabines", unit: "%", category: "spa", monthly_targets: {} },
  { id: "k3", name: "Panier moyen", unit: "€", category: "spa", monthly_targets: {} },
  { id: "k4", name: "NPS clients", unit: "/10", category: "spa", monthly_targets: {} },
  { id: "k5", name: "Ventes produits", unit: "€", category: "spa", monthly_targets: {} },
];

const DEFAULT_MONTHLY_TARGETS: Record<string, number> = {
  k1: 85000,
  k2: 72,
  k3: 95,
  k4: 8.5,
  k5: 14000,
};

function getTarget(item: KpiConfigItem, monthKey: string, weekKey?: string): number {
  const m = item.monthly_targets?.[monthKey];
  if (weekKey && m?.weekly_targets?.[weekKey] != null) return m.weekly_targets[weekKey];
  if (m?.target != null) return weekKey ? m.target / 4 : m.target;
  const fb = DEFAULT_MONTHLY_TARGETS[item.id] ?? 100;
  return weekKey ? fb / 4 : fb;
}

// ---------- variation helpers ----------

function round(n: number, unit: string): number {
  if (unit === "%" || unit === "/10") return Math.round(n * 10) / 10;
  if (unit === "€") return Math.round(n);
  return Math.round(n * 10) / 10;
}

function applyVariation(target: number, pct: number, unit: string): number {
  return round(target * (1 + pct / 100), unit);
}

// pct deltas applied per weekly cycle for the storyline
// April: under target W14–W15, recovering W16–W17
// May: above target W18–W19, small dip W20, draft W21 left empty
const WEEK_DELTAS: Record<string, number[]> = {
  // [k1, k2, k3, k4, k5]
  W14: [-18, -15, -12, -10, -16],
  W15: [-14, -12, -10, -8, -13],
  W16: [-4, -3, -2, -2, -5],
  W17: [+6, +5, +4, +3, +7],
  W18: [+12, +10, +8, +6, +14],
  W19: [+15, +12, +9, +7, +17],
  W20: [-6, -5, -4, -3, -7],
};

const WEEK_COMMENTS: Record<string, string[]> = {
  W14: [
    "Démarrage de mois lent, météo défavorable",
    "Affluence en baisse en début de saison",
    "Moins d'add-on vendus en cabine",
    "Quelques retours mitigés sur le planning",
    "Baisse liée à absence de Camille",
  ],
  W15: [
    "Tension planning, moins de créneaux ouverts",
    "Toujours faible affluence midweek",
    "Panier impacté par mix soins courts",
    "NPS en léger retrait, 2 réclamations",
    "Stocks Phytomer pas réassortis",
  ],
  W16: [
    "Reprise progressive de l'activité",
    "Occupation se redresse, weekend complet",
    "Up-sell améliore le panier moyen",
    "Retours clients plus positifs",
    "Mise en avant gamme corps efficace",
  ],
  W17: [
    "Fin de mois solide, ventes au-dessus",
    "Cabines pleines, peu d'annulations",
    "Bon panier grâce aux rituels duo",
    "NPS en hausse après formation accueil",
    "Bel effet du programme fidélité",
  ],
  W18: [
    "Démarrage de mois excellent",
    "Forte affluence, weekends saturés",
    "Très bon panier grâce aux packages",
    "Retours clients très positifs post-séminaire",
    "Lancement gamme été performant",
  ],
  W19: [
    "Activité soutenue, équipe au top",
    "Occupation record, peu de créneaux libres",
    "Up-sell maximisé sur les rituels",
    "Clients enchantés, recommandations en hausse",
    "Ventes boostées par opération bien-être",
  ],
  W20: [
    "Légère baisse liée au pont du 8 mai",
    "Annulations dues aux ponts",
    "Panier stable malgré moins de flux",
    "NPS stable malgré la baisse d'affluence",
    "Stock épuisé sur best-sellers",
  ],
};

// ---------- to-do storyline (cross-report tracking) ----------

const RECURRING_TODOS = [
  "Relancer programme fidélité",
  "Former équipe gamme Phytomer",
  "Corriger bug module booking en ligne",
  "Réaliser audit qualité cabines",
];

function todosForWeek(weekIdx: number): TodoItem[] {
  // Status evolution across W14..W17:
  // weekIdx 0=W14 1=W15 2=W16 3=W17
  const status: TodoItem["status"][] = ["todo", "in_progress", "in_progress", "done"];
  const base: TodoItem[] = RECURRING_TODOS.map((label, i) => ({
    id: `td-rec-${i}`,
    label,
    status: status[weekIdx] ?? "todo",
    owner: ["Marie", "Karim", "Sophie", "Léa"][i],
  }));

  // W18+ : new follow-up after recurring ones marked done
  if (weekIdx >= 4) {
    base.forEach((t) => (t.status = "done"));
    base.push({
      id: "td-followup-1",
      label: "Lancer phase 2 programme fidélité (VIP)",
      status: weekIdx === 4 ? "in_progress" : "done",
      owner: "Marie",
      origin: "Suivi W17",
    });
  }
  return base;
}

// ---------- IDS storyline ----------

function idsForWeek(weekKey: string): IdsItem[] {
  switch (weekKey) {
    case "W14":
      return [
        {
          id: "ids-w14-1",
          issue: "Logiciel de caisse plante en fin de journée",
          discussion: "Affecte la clôture, perte de 30 min par jour",
          solution: "Contacter support éditeur",
          resolved: false,
        },
      ];
    case "W15":
      return [
        {
          id: "ids-w15-1",
          issue: "Tensions planning congés",
          discussion: "Plusieurs demandes concurrentes en mai",
          solution: "Réunion d'arbitrage prévue lundi",
          resolved: true,
        },
      ];
    case "W16":
      return [
        {
          id: "ids-w16-1",
          issue: "Manque de produits Phytomer en cabine",
          discussion: "Réassort tardif fournisseur",
          solution: "Ajuster seuils de commande",
          resolved: false,
        },
      ];
    case "W17":
      return [
        {
          id: "ids-w17-1",
          issue: "Réservations en ligne incohérentes",
          discussion: "Module booking double-book parfois",
          solution: "Ticket prio ouvert chez prestataire",
          resolved: false,
        },
      ];
    case "W18":
      return [
        {
          id: "ids-w18-1",
          issue: "Affluence séminaire dépasse capacité",
          discussion: "Bonne nouvelle mais débordement RH",
          solution: "Renfort extra pour fin de semaine",
          resolved: true,
        },
      ];
    case "W19":
      return [];
    case "W20":
      return [
        {
          id: "ids-w20-1",
          issue: "Rupture sur best-sellers boutique",
          discussion: "Ventes boostées, stock insuffisant",
          solution: "Commande express + revoir prévisions",
          resolved: false,
        },
      ];
    default:
      return [];
  }
}

// Map unresolved IDS of week N into a follow-up todo for week N+1
function carryUnresolvedIds(prevWeek: string, base: TodoItem[]): TodoItem[] {
  const prev = idsForWeek(prevWeek).filter((i) => !i.resolved);
  return [
    ...base,
    ...prev.map((i, idx) => ({
      id: `td-from-${prevWeek}-${idx}`,
      label: i.issue,
      status: "todo" as const,
      origin: `IDS ${prevWeek}`,
    })),
  ];
}

// ---------- responsibilities ----------

function responsibilitiesForReport(
  templates: RespTemplate[],
  reportIdx: number,
): ResponsibilityScore[] {
  const axes = (templates.length > 0
    ? templates.filter((t) => t.active).map((t) => t.name)
    : [
        "Superviser l'activité quotidienne du spa",
        "Gérer les équipes",
        "Contrôler la qualité de service et satisfaction client",
        "Vérifier les stocks et commander si nécessaire",
        "Suivre les réservations et le taux de remplissage",
      ]
  ).slice(0, 5);

  const justifications: Record<string, string> = {
    Excellent: "Standards tenus, équipe alignée",
    Bon: "Réalisé dans les temps, à consolider",
    Insuffisant: "Retard ou écart constaté, à corriger",
  };

  return axes.map((axis, i) => {
    // Cycle through scores; force at least one Insuffisant every 2 reports
    let score: ResponsibilityScore["score"];
    if ((reportIdx + i) % 5 === 2) score = "Insuffisant";
    else if ((reportIdx + i) % 3 === 0) score = "Excellent";
    else score = "Bon";

    return {
      axis,
      score,
      justification: justifications[score],
    };
  });
}

// ---------- objectives ----------

const APRIL_OBJECTIVES: ObjectiveItem[] = [
  { id: "obj-apr-1", label: "Réduire no-shows de 15% d'ici fin avril", progress: 0 },
  { id: "obj-apr-2", label: "Augmenter ventes produits de 10% (vs mars)", progress: 0 },
  { id: "obj-apr-3", label: "Former 100% de l'équipe sur la nouvelle gamme Phytomer", progress: 0 },
];

const MAY_OBJECTIVES: ObjectiveItem[] = [
  { id: "obj-may-1", label: "Atteindre 80% d'occupation moyenne en mai", progress: 0 },
  { id: "obj-may-2", label: "Lancer programme fidélité VIP avant le 31 mai", progress: 0 },
];

function objectivesForWeek(
  base: ObjectiveItem[],
  weekIdx: number,
  totalWeeks: number,
): ObjectiveItem[] {
  return base.map((o, i) => ({
    ...o,
    progress: Math.min(100, Math.round(((weekIdx + 1) / totalWeeks) * (75 + i * 5))),
    note: `Avancement Semaine ${weekIdx + 1} : ${Math.min(100, Math.round(((weekIdx + 1) / totalWeeks) * 100))}% du chemin`,
  }));
}

// ---------- KPI generator ----------

function kpiActualsFor(
  kpiCfg: KpiConfigItem[],
  monthKey: string,
  weekKey?: string,
): KpiActual[] {
  const wk = weekKey?.replace(/^W0?/, "W") ?? "";
  const deltas = WEEK_DELTAS[wk] ?? [0, 0, 0, 0, 0];
  const comments = WEEK_COMMENTS[wk] ?? [
    "Mois conforme aux attentes",
    "Activité stable",
    "Panier dans la moyenne",
    "Satisfaction client maintenue",
    "Ventes en ligne avec objectifs",
  ];

  return kpiCfg.slice(0, 5).map((k, i) => {
    const target = getTarget(k, monthKey, weekKey);
    const actual = applyVariation(target, deltas[i] ?? 0, k.unit);
    return {
      kpiId: k.id,
      name: k.name,
      unit: k.unit,
      target: round(target, k.unit),
      actual,
      comment: comments[i] ?? "",
    };
  });
}

// ---------- check-in ----------

function checkinFor(weekKey: string, idx: number) {
  if (weekKey === "W15") {
    return { mood: 6, note: "Tension planning congés", teamWeather: "Ciel voilé, équipe fatiguée" };
  }
  if (weekKey === "W18") {
    return { mood: 9, note: "Séminaire équipe réussi", teamWeather: "Grand soleil, énergie au top" };
  }
  const moods = [8, 7, 8, 7, 8, 7];
  const weathers = [
    "Ciel dégagé, bonne dynamique",
    "Quelques nuages, à surveiller",
    "Belle éclaircie sur l'équipe",
    "Ambiance studieuse et sereine",
    "Vent positif, équipe motivée",
    "Stable, rien à signaler",
  ];
  return { mood: moods[idx % moods.length], note: "", teamWeather: weathers[idx % weathers.length] };
}

// ---------- commitments ----------

function commitmentsFor(weekKey: string): Commitment[] {
  const map: Record<string, string[]> = {
    W14: ["Réorganiser le planning d'accueil dès lundi", "Relancer support éditeur logiciel caisse"],
    W15: ["Acter les congés mai en réunion lundi", "Brief équipe sur priorités semaine"],
    W16: ["Ajuster seuils commande Phytomer", "Mettre en avant la gamme corps en boutique"],
    W17: ["Préparer bilan mensuel pour direction", "Reconduire formation up-sell"],
    W18: ["Étendre opération bien-être 1 semaine", "Renforcer planning weekends"],
    W19: ["Lancer phase 2 programme fidélité", "Communiquer succès au siège"],
    W20: ["Réapprovisionner best-sellers en urgence", "Revoir prévisions ventes pour juin"],
  };
  return (map[weekKey] ?? ["Décision à venir"]).map((d, i) => ({ id: `cm-${weekKey}-${i}`, decision: d }));
}

function commitmentsForMonth(month: "april" | "may"): Commitment[] {
  if (month === "april") {
    return [
      { id: "cm-apr-1", decision: "Valider objectif fidélité pour mai" },
      { id: "cm-apr-2", decision: "Recruter 1 praticienne en CDD pour la saison" },
      { id: "cm-apr-3", decision: "Investir dans nouveau matériel cabine 3" },
    ];
  }
  return [
    { id: "cm-may-1", decision: "Décision à prendre en réunion" },
    { id: "cm-may-2", decision: "Plan de charge été à valider" },
  ];
}

// ---------- empty details for drafts ----------

function emptyDetails(): ReportDetails {
  return {
    kpis: [],
    checkin: { mood: 0, note: "", teamWeather: "" },
    todos: [],
    objectives: [],
    responsibilities: [],
    ids: [],
    commitments: [],
  };
}

// ---------- main builder ----------

const APRIL_WEEKS = [
  { key: "W14", iso: "2026-W14", label: "Weekly — Semaine 14", period: "1 → 7 avr 2026", meeting: "2 avr 2026" },
  { key: "W15", iso: "2026-W15", label: "Weekly — Semaine 15", period: "8 → 14 avr 2026", meeting: "9 avr 2026" },
  { key: "W16", iso: "2026-W16", label: "Weekly — Semaine 16", period: "15 → 21 avr 2026", meeting: "16 avr 2026" },
  { key: "W17", iso: "2026-W17", label: "Weekly — Semaine 17", period: "22 → 28 avr 2026", meeting: "23 avr 2026" },
];
const MAY_WEEKS = [
  { key: "W18", iso: "2026-W18", label: "Weekly — Semaine 18", period: "6 → 12 mai 2026", meeting: "7 mai 2026" },
  { key: "W19", iso: "2026-W19", label: "Weekly — Semaine 19", period: "13 → 19 mai 2026", meeting: "14 mai 2026" },
  { key: "W20", iso: "2026-W20", label: "Weekly — Semaine 20", period: "20 → 26 mai 2026", meeting: "21 mai 2026" },
];

export function buildDemoReports(): ReportRecord[] {
  const kpiRaw = readKpiConfig();
  const kpiCfg = kpiRaw.length > 0 ? kpiRaw : FALLBACK_KPIS;
  const templates = readRespTemplates();

  const reports: ReportRecord[] = [];

  // April weeklies — all validated
  APRIL_WEEKS.forEach((w, i) => {
    const prevWeek = i === 0 ? null : APRIL_WEEKS[i - 1].key;
    let todos = todosForWeek(i);
    if (prevWeek) todos = carryUnresolvedIds(prevWeek, todos);

    const details: ReportDetails = {
      kpis: kpiActualsFor(kpiCfg, "2026-04", w.iso),
      checkin: checkinFor(w.key, i),
      todos,
      objectives: objectivesForWeek(APRIL_OBJECTIVES, i, APRIL_WEEKS.length),
      responsibilities: responsibilitiesForReport(templates, i),
      ids: idsForWeek(w.key),
      commitments: commitmentsFor(w.key),
      nextMeeting: APRIL_WEEKS[i + 1]?.meeting ?? "30 avr 2026",
    };

    reports.push({
      id: `demo-w${i + 14}`,
      type: "weekly",
      label: w.label,
      period: w.period,
      state: "validated",
      updatedAt: w.meeting,
      meetingDate: w.meeting,
      completion: 100,
      details,
    });
  });

  // April monthly — validated
  reports.push({
    id: "demo-monthly-april",
    type: "monthly",
    label: "Monthly — Avril 2026",
    period: "1 avr → 30 avr 2026",
    state: "validated",
    updatedAt: "30 avr 2026",
    meetingDate: "30 avr 2026",
    completion: 100,
    details: {
      kpis: kpiActualsFor(kpiCfg, "2026-04"),
      checkin: { mood: 8, note: "Mois finalement bien rattrapé", teamWeather: "Beau temps malgré début mitigé" },
      todos: todosForWeek(3),
      objectives: APRIL_OBJECTIVES.map((o) => ({ ...o, progress: 100, note: "Objectif atteint" })),
      responsibilities: responsibilitiesForReport(templates, 4),
      ids: [],
      commitments: commitmentsForMonth("april"),
      nextMeeting: "7 mai 2026",
    },
  });

  // May weeklies W18–W20 — validated
  MAY_WEEKS.forEach((w, i) => {
    const idx = i + 4;
    const prevWeek = i === 0 ? "W17" : MAY_WEEKS[i - 1].key;
    let todos = todosForWeek(idx);
    todos = carryUnresolvedIds(prevWeek, todos);

    const details: ReportDetails = {
      kpis: kpiActualsFor(kpiCfg, "2026-05", w.iso),
      checkin: checkinFor(w.key, idx),
      todos,
      objectives: objectivesForWeek(MAY_OBJECTIVES, i, 4),
      responsibilities: responsibilitiesForReport(templates, idx),
      ids: idsForWeek(w.key),
      commitments: commitmentsFor(w.key),
      nextMeeting: MAY_WEEKS[i + 1]?.meeting ?? "28 mai 2026",
    };

    reports.push({
      id: `demo-w${i + 18}`,
      type: "weekly",
      label: w.label,
      period: w.period,
      state: "validated",
      updatedAt: w.meeting,
      meetingDate: w.meeting,
      completion: 100,
      details,
    });
  });

  // May W21 — DRAFT, empty
  reports.push({
    id: "demo-w21",
    type: "weekly",
    label: "Weekly — Semaine 21",
    period: "27 mai → 2 juin 2026",
    state: "draft_preparation",
    updatedAt: "Aujourd'hui",
    meetingDate: "28 mai 2026",
    completion: 0,
    details: emptyDetails(),
  });

  // May Monthly — DRAFT, empty
  reports.push({
    id: "demo-monthly-may",
    type: "monthly",
    label: "Monthly — Mai 2026",
    period: "1 mai → 31 mai 2026",
    state: "draft_preparation",
    updatedAt: "Aujourd'hui",
    meetingDate: "29 mai 2026",
    completion: 0,
    details: emptyDetails(),
  });

  return reports;
}

export function hasExistingReportsData(): boolean {
  return hasStoredReports();
}

export function seedDemoData(): void {
  const next = buildDemoReports();
  setReports(next);
}

export { REPORTS_STORAGE_KEY };
