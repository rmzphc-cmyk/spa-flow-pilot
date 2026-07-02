import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { WeeklyReportPdf } from "@/components/pdf/WeeklyReportPdf";
import { safeText, type WeeklyPdfData } from "@/hooks/useWeeklyPdfData";

// WeeklyReportPdf est un wrapper qui retourne <Document/> ; renderToBuffer est typé
// pour un <Document/> direct, d'où le cast (le rendu fonctionne à l'exécution).
const renderPdf = (data: WeeklyPdfData) =>
  renderToBuffer(
    createElement(WeeklyReportPdf, { data }) as Parameters<typeof renderToBuffer>[0],
  );

const fullData: WeeklyPdfData = {
  reportLabel: "Semaine 23",
  reportPeriod: "2 – 8 juin 2026",
  spaName: "Belhazar Spa by Sanagua",
  managerName: "Salim Ben Ali",
  generatedAt: "11 juin 2026",
  executiveSummary: "Semaine correcte malgré deux incidents techniques en cabine.",
  keyActions: ["Réparer la cabine 3", "Relancer le fournisseur de linge"],
  kpis: [],
  moodScore: 4,
  managerScore: 3,
  equipeComment: "Équipe motivée malgré la charge.",
  managerComment: "",
  situationGlobale: "Le spa tient le rythme malgré les incidents techniques.",
  responsibilities: [],
  // Objectif AVEC date cible → c'est exactement le cas qui faisait planter (formatDateFr).
  objectives: [
    {
      title: "NPS ≥ 60",
      metric: "NPS",
      target: 60,
      unit: "",
      current: 52,
      progress: 87,
      status_ui: "behind",
      comment: "Tendance à surveiller.",
      targetDate: "2026-06-01",
    },
  ],
  ids: [
    { text: "Cabine 3 HS depuis lundi", convertedToTodo: true, convertedToObjectif: false },
  ],
  todosDone: [],
  todosActive: [],
  todosDeferred: [],
  freeNote: "",
  verdict: { level: "red", blocking: 2, overdue: 2, atRisk: 1 },
  problems: [
    { text: "Cabine 3 HS depuis lundi — perte ~6 soins/j", severity: "bloquant", action: "To-do (Salim · 12 juin 2026)" },
    { text: "Rupture huile massage signature", severity: "bloquant", action: "To-do (Leïla · 10 juin 2026)" },
    { text: "Rebooking en baisse 3 semaines", severity: "priorite", action: "Objectif (cible 15 juil. 2026)" },
    { text: "Badge prestataire non reçu", severity: "deleguer", action: "To-do" },
    { text: "Client VIP demande horaire spécial", severity: "untriaged", action: null },
  ],
  commitmentsOverdue: [
    { kind: "todo", title: "Former l'équipe au nouveau protocole", responsible: "Salim", dueLabel: "5 juin 2026", lateDays: 6, detail: "", deferredCount: 2 },
    { kind: "objective", title: "NPS ≥ 60", responsible: "", dueLabel: "1 juin 2026", lateDays: 10, detail: "52/60 · 87%", deferredCount: 0 },
  ],
  commitmentsAtRisk: [
    { kind: "todo", title: "Relancer le fournisseur de linge", responsible: "Leïla", dueLabel: "13 juin 2026", lateDays: 0, detail: "", deferredCount: 0 },
  ],
};

const emptyData: WeeklyPdfData = {
  ...fullData,
  executiveSummary: null,
  keyActions: [],
  objectives: [],
  ids: [],
  verdict: { level: "green", blocking: 0, overdue: 0, atRisk: 0 },
  problems: [],
  commitmentsOverdue: [],
  commitmentsAtRisk: [],
};

describe("WeeklyReportPdf — rendu Direction", () => {
  it("rend un PDF valide avec problèmes, engagements et objectif à date cible (régression formatDateFr)", async () => {
    const buf = await renderPdf(fullData);
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.subarray(0, 4).toString("latin1")).toBe("%PDF");
  });

  it("rend un PDF valide quand tout est à jour (verdict vert, aucune exception)", async () => {
    const buf = await renderPdf(emptyData);
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.subarray(0, 4).toString("latin1")).toBe("%PDF");
  });
});

describe("safeText — glyphes hors encodage Helvetica", () => {
  it("remplace les symboles que le PDF ne sait pas afficher", () => {
    // « NPS ≥ 60 » s'affichait « NPS e 60 » dans le PDF avant le fix.
    expect(safeText("NPS ≥ 60")).toBe("NPS >= 60");
    expect(safeText("CA ≤ 20k")).toBe("CA <= 20k");
    expect(safeText("valeur ≠ cible")).toBe("valeur != cible");
    expect(safeText("avant → après")).toBe("avant -> après");
    expect(safeText(null)).toBe("");
    expect(safeText("texte normal éàç")).toBe("texte normal éàç");
  });
});
