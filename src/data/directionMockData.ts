export interface SpaAlert {
  level: "red" | "orange";
  text: string;
}

export interface SpaOverview {
  id: string;
  name: string;
  manager: string;
  report: string;
  status: "draft_preparation" | "in_meeting" | "validated";
  progress: string;
  alerts: SpaAlert[];
  kpis: { ca: string; nps: string; responsabilites: string };
  lastReport: string;
}

export interface SpaKpiRow {
  label: string;
  value: string;
  target: string;
  ecart: string;
  status: "green" | "amber" | "red";
}

export interface SpaResp {
  label: string;
  status: "green" | "amber" | "red";
}

export interface SpaObjectif {
  label: string;
  current: string;
  target: string;
  progress: number;
  status: "on_track" | "at_risk";
  statusLabel: string;
}

export interface SpaIds {
  problem: string;
  solution: string;
  status: "resolved" | "in_progress";
}

export interface SpaDetail {
  id: string;
  name: string;
  manager: string;
  managerRole: string;
  currentReport: {
    label: string;
    status: "draft_preparation" | "in_meeting" | "validated";
    progress: string;
    progressNum: number;
    progressDen: number;
  };
  alerts: SpaAlert[];
  lastValidated: {
    period: string;
    validatedDate: string;
    checkinNote: string;
    kpis: SpaKpiRow[];
    responsabilites: { global: number; items: SpaResp[] };
    objectifs: SpaObjectif[];
    ids: SpaIds[];
  };
}

export const spas: SpaOverview[] = [
  {
    id: "spa1",
    name: "Par Gran Canaria",
    manager: "Marie Dupont",
    report: "Monthly — Mars 2026",
    status: "draft_preparation",
    progress: "2/7 sections",
    alerts: [{ level: "red", text: "CA du mois -55% vs objectif" }],
    kpis: { ca: "—", nps: "—", responsabilites: "—" },
    lastReport: "Février 2026 — Validé le 3 mars",
  },
  {
    id: "spa2",
    name: "Par Lanzarote",
    manager: "Thomas Martin",
    report: "Monthly — Mars 2026",
    status: "in_meeting",
    progress: "Réunion en cours",
    alerts: [
      { level: "orange", text: "NPS en baisse 2 cycles consécutifs" },
      { level: "orange", text: "2 IDS non résolus depuis Janvier" },
    ],
    kpis: { ca: "38 200€", nps: "7.1/10", responsabilites: "71%" },
    lastReport: "Février 2026 — Validé le 5 mars",
  },
  {
    id: "spa3",
    name: "Par Fuerte",
    manager: "Sophie Bernard",
    report: "Monthly — Mars 2026",
    status: "validated",
    progress: "Validé",
    alerts: [],
    kpis: { ca: "52 100€", nps: "9.1/10", responsabilites: "94%" },
    lastReport: "Février 2026 — Validé le 1 mars",
  },
];

export const spaDetails: Record<string, SpaDetail> = {
  spa1: {
    id: "spa1",
    name: "Par Gran Canaria",
    manager: "Marie Dupont",
    managerRole: "Spa Manager",
    currentReport: {
      label: "Monthly — Mars 2026",
      status: "draft_preparation",
      progress: "2/7 sections",
      progressNum: 2,
      progressDen: 7,
    },
    alerts: [{ level: "red", text: "CA du mois -55% vs objectif" }],
    lastValidated: {
      period: "Février 2026",
      validatedDate: "3 mars 2026",
      checkinNote: "Équipe motivée mais fatiguée en fin de mois. Bonne dynamique commerciale.",
      kpis: [
        { label: "CA du mois", value: "41 500€", target: "45 000€", ecart: "-7.8%", status: "amber" },
        { label: "Taux occupation", value: "76%", target: "80%", ecart: "-5%", status: "amber" },
        { label: "Panier moyen", value: "122€", target: "120€", ecart: "+1.7%", status: "green" },
        { label: "NPS clients", value: "7.8", target: "8.5", ecart: "-8.2%", status: "amber" },
        { label: "Ventes produits", value: "7 200€", target: "8 000€", ecart: "-10%", status: "amber" },
        { label: "Absentéisme", value: "2j", target: "2j", ecart: "0%", status: "green" },
        { label: "Nouveaux abonnements", value: "13", target: "15", ecart: "-13%", status: "amber" },
        { label: "Satisfaction collab.", value: "8.1", target: "8", ecart: "+1.3%", status: "green" },
      ],
      responsabilites: {
        global: 78,
        items: [
          { label: "Accueil clients", status: "green" },
          { label: "Gestion stocks", status: "amber" },
          { label: "Planning équipe", status: "green" },
          { label: "Hygiène cabines", status: "green" },
          { label: "Formation continue", status: "red" },
          { label: "Suivi fournisseurs", status: "amber" },
        ],
      },
      objectifs: [
        { label: "NPS clients", current: "7.8", target: "8.5", progress: 92, status: "at_risk", statusLabel: "À risque" },
        { label: "Absentéisme", current: "2j", target: "2j", progress: 100, status: "on_track", statusLabel: "En bonne voie" },
      ],
      ids: [
        { problem: "Turnover praticiens", solution: "Planning prévisionnel 3 mois", status: "resolved" },
        { problem: "Fuite cabine 3", solution: "Devis reçu, travaux semaine 14", status: "in_progress" },
      ],
    },
  },
  spa2: {
    id: "spa2",
    name: "Par Lanzarote",
    manager: "Thomas Martin",
    managerRole: "Spa Manager",
    currentReport: {
      label: "Monthly — Mars 2026",
      status: "in_meeting",
      progress: "Réunion en cours",
      progressNum: 5,
      progressDen: 7,
    },
    alerts: [
      { level: "orange", text: "NPS en baisse 2 cycles consécutifs" },
      { level: "orange", text: "2 IDS non résolus depuis Janvier" },
    ],
    lastValidated: {
      period: "Février 2026",
      validatedDate: "5 mars 2026",
      checkinNote: "Bonne ambiance générale. Besoin de renfort le week-end.",
      kpis: [
        { label: "CA du mois", value: "38 200€", target: "40 000€", ecart: "-4.5%", status: "amber" },
        { label: "Taux occupation", value: "72%", target: "78%", ecart: "-7.7%", status: "amber" },
        { label: "Panier moyen", value: "115€", target: "110€", ecart: "+4.5%", status: "green" },
        { label: "NPS clients", value: "7.1", target: "8.0", ecart: "-11.3%", status: "red" },
        { label: "Ventes produits", value: "5 800€", target: "6 000€", ecart: "-3.3%", status: "amber" },
        { label: "Absentéisme", value: "3j", target: "2j", ecart: "+50%", status: "red" },
        { label: "Nouveaux abonnements", value: "10", target: "12", ecart: "-16.7%", status: "amber" },
        { label: "Satisfaction collab.", value: "7.5", target: "8", ecart: "-6.3%", status: "amber" },
      ],
      responsabilites: {
        global: 71,
        items: [
          { label: "Accueil clients", status: "amber" },
          { label: "Gestion stocks", status: "green" },
          { label: "Planning équipe", status: "red" },
          { label: "Hygiène cabines", status: "green" },
          { label: "Formation continue", status: "amber" },
          { label: "Suivi fournisseurs", status: "green" },
        ],
      },
      objectifs: [
        { label: "NPS clients", current: "7.1", target: "8.0", progress: 89, status: "at_risk", statusLabel: "À risque" },
        { label: "Absentéisme", current: "3j", target: "2j", progress: 50, status: "at_risk", statusLabel: "À risque" },
      ],
      ids: [
        { problem: "Climatisation zone détente", solution: "Maintenance planifiée semaine 12", status: "in_progress" },
        { problem: "Rupture huiles essentielles", solution: "Changement fournisseur validé", status: "resolved" },
      ],
    },
  },
  spa3: {
    id: "spa3",
    name: "Par Fuerte",
    manager: "Sophie Bernard",
    managerRole: "Spa Manager",
    currentReport: {
      label: "Monthly — Mars 2026",
      status: "validated",
      progress: "Validé",
      progressNum: 7,
      progressDen: 7,
    },
    alerts: [],
    lastValidated: {
      period: "Février 2026",
      validatedDate: "1 mars 2026",
      checkinNote: "Excellent mois, équipe très performante. Objectifs dépassés sur tous les fronts.",
      kpis: [
        { label: "CA du mois", value: "52 100€", target: "48 000€", ecart: "+8.5%", status: "green" },
        { label: "Taux occupation", value: "88%", target: "82%", ecart: "+7.3%", status: "green" },
        { label: "Panier moyen", value: "135€", target: "125€", ecart: "+8%", status: "green" },
        { label: "NPS clients", value: "9.1", target: "8.5", ecart: "+7.1%", status: "green" },
        { label: "Ventes produits", value: "9 500€", target: "8 000€", ecart: "+18.8%", status: "green" },
        { label: "Absentéisme", value: "1j", target: "2j", ecart: "-50%", status: "green" },
        { label: "Nouveaux abonnements", value: "18", target: "15", ecart: "+20%", status: "green" },
        { label: "Satisfaction collab.", value: "8.8", target: "8", ecart: "+10%", status: "green" },
      ],
      responsabilites: {
        global: 94,
        items: [
          { label: "Accueil clients", status: "green" },
          { label: "Gestion stocks", status: "green" },
          { label: "Planning équipe", status: "green" },
          { label: "Hygiène cabines", status: "green" },
          { label: "Formation continue", status: "green" },
          { label: "Suivi fournisseurs", status: "amber" },
        ],
      },
      objectifs: [
        { label: "NPS clients", current: "9.1", target: "8.5", progress: 100, status: "on_track", statusLabel: "En bonne voie" },
        { label: "Absentéisme", current: "1j", target: "2j", progress: 100, status: "on_track", statusLabel: "En bonne voie" },
      ],
      ids: [
        { problem: "Bruit pompe piscine", solution: "Remplacement effectué", status: "resolved" },
      ],
    },
  },
};
