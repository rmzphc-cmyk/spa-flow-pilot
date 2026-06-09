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
  kpis: { ca: string; satisfaction: string; responsabilites: string };
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

// Types only — mock data moved to Supabase hooks (useDirectionData.ts)

