import { describe, it, expect } from "vitest";
import {
  resolveObjectiveDisplay,
  isObjectiveOverdue,
  objectiveStatusMeta,
  OBJECTIVE_STATUS_META,
} from "@/lib/objectiveDisplay";

const parsedBase = { metric: "Rebooking", unit: "%", start: 10, target: 25, current: 14 };

const numericObj = {
  kind: "numeric",
  metric: "Taux de rebooking",
  unit: "%",
  start_value: 10,
  target_value: 25,
  current_value: 14,
};

describe("resolveObjectiveDisplay", () => {
  it("chiffré : colonnes réelles prioritaires sur le blob", () => {
    const r = resolveObjectiveDisplay(numericObj, { ...parsedBase, current: 99 }, []);
    expect(r.isProject).toBe(false);
    expect(r.current).toBe(14);
    expect(r.metric).toBe("Taux de rebooking");
    expect(r.progress).toBe(27); // (14-10)/(25-10)
  });

  it("chiffré legacy : repli sur le blob quand les colonnes sont nulles", () => {
    const legacy = { kind: "numeric", metric: null, unit: null, start_value: null, target_value: null, current_value: null };
    const r = resolveObjectiveDisplay(legacy, parsedBase, []);
    expect(r.current).toBe(14);
    expect(r.target).toBe(25);
    expect(r.unit).toBe("%");
  });

  it("projet : étapes live prioritaires (2/3 faites)", () => {
    const steps = [{ is_done: true }, { is_done: true }, { is_done: false }];
    const r = resolveObjectiveDisplay({ ...numericObj, kind: "steps" }, parsedBase, steps);
    expect(r.isProject).toBe(true);
    expect(r.current).toBe(2);
    expect(r.target).toBe(3);
    expect(r.start).toBe(0);
    expect(r.progress).toBe(67);
  });

  it("projet sans étape : repli sur le blob current/target", () => {
    const r = resolveObjectiveDisplay(
      { ...numericObj, kind: "steps" },
      { ...parsedBase, current: 1, target: 4 },
      [],
    );
    expect(r.current).toBe(1);
    expect(r.target).toBe(4);
  });
});

describe("isObjectiveOverdue", () => {
  it("actif avec échéance passée → dépassé", () => {
    expect(isObjectiveOverdue("2026-06-30", "active", "2026-07-03")).toBe(true);
  });
  it("échéance aujourd'hui → pas encore dépassé", () => {
    expect(isObjectiveOverdue("2026-07-03", "active", "2026-07-03")).toBe(false);
  });
  it("sans échéance ou clôturé → jamais dépassé", () => {
    expect(isObjectiveOverdue(null, "active", "2026-07-03")).toBe(false);
    expect(isObjectiveOverdue("2026-06-30", "achieved", "2026-07-03")).toBe(false);
  });
  it("tolère un timestamp complet en date cible", () => {
    expect(isObjectiveOverdue("2026-06-30T10:00:00Z", "active", "2026-07-03")).toBe(true);
  });
});

describe("objectiveStatusMeta", () => {
  it("statut inconnu → repli on_track", () => {
    expect(objectiveStatusMeta("n_importe_quoi")).toBe(OBJECTIVE_STATUS_META.on_track);
  });
  it("chaque statut a un token sémantique cohérent badge/barre", () => {
    expect(OBJECTIVE_STATUS_META.on_track.barClass).toContain("success");
    expect(OBJECTIVE_STATUS_META.at_risk.barClass).toContain("warning");
    expect(OBJECTIVE_STATUS_META.behind.barClass).toContain("destructive");
  });
});
