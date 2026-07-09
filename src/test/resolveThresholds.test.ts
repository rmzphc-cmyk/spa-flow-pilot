import { describe, it, expect } from "vitest";
import { resolveThresholds, type KpiMonthlyTarget } from "@/hooks/useKpiMonthlyTargets";

const def = { threshold_excellent: 80, threshold_amber: 60, threshold_red: 40 };

function target(over: Partial<KpiMonthlyTarget>): KpiMonthlyTarget {
  return {
    id: "t",
    spa_id: "s",
    kpi_definition_id: "k",
    year_month: "2026-05",
    monthly_value: null,
    weekly_mode: "divide",
    weekly_override: null,
    actual_monthly_value: null,
    threshold_excellent: null,
    threshold_amber: null,
    threshold_red: null,
    created_at: "",
    updated_at: "",
    ...over,
  };
}

describe("resolveThresholds", () => {
  it("retombe sur la définition quand aucun mois n'a d'override", () => {
    expect(resolveThresholds(def, undefined, undefined)).toEqual({
      excellent: 80,
      amber: 60,
      red: 40,
    });
  });

  it("le mois courant l'emporte sur la définition", () => {
    const cur = target({ threshold_excellent: 90, threshold_amber: 70, threshold_red: 50 });
    expect(resolveThresholds(def, cur, undefined)).toEqual({
      excellent: 90,
      amber: 70,
      red: 50,
    });
  });

  it("hérite du mois précédent quand le mois courant est vide", () => {
    const prev = target({ threshold_excellent: 85, threshold_amber: 65, threshold_red: 45 });
    expect(resolveThresholds(def, undefined, prev)).toEqual({
      excellent: 85,
      amber: 65,
      red: 45,
    });
  });

  it("résout champ par champ (mois courant partiel, reste hérité/défaut)", () => {
    const cur = target({ threshold_excellent: 95 });
    const prev = target({ threshold_amber: 66 });
    expect(resolveThresholds(def, cur, prev)).toEqual({
      excellent: 95, // du mois courant
      amber: 66, // hérité du précédent
      red: 40, // défaut de la définition
    });
  });

  it("un seuil à 0 explicite n'est pas écrasé par le fallback", () => {
    const cur = target({ threshold_red: 0 });
    expect(resolveThresholds(def, cur, undefined).red).toBe(0);
  });

  it("définition sans seuils → null", () => {
    expect(
      resolveThresholds(
        { threshold_excellent: null, threshold_amber: null, threshold_red: null },
        undefined,
        undefined,
      ),
    ).toEqual({ excellent: null, amber: null, red: null });
  });
});
