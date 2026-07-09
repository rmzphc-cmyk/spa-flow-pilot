import { describe, it, expect } from "vitest";
import { resolveThresholds, type ResolvedThresholds } from "@/hooks/useKpiMonthlyTargets";

const def = { threshold_excellent: 80, threshold_amber: 60, threshold_red: 40 };

const eff = (o: Partial<ResolvedThresholds>): ResolvedThresholds => ({
  excellent: null,
  amber: null,
  red: null,
  ...o,
});

describe("resolveThresholds (fallback vers la définition)", () => {
  it("retombe sur la définition quand aucun seuil effectif n'existe", () => {
    expect(resolveThresholds(def, undefined)).toEqual({ excellent: 80, amber: 60, red: 40 });
    expect(resolveThresholds(def, null)).toEqual({ excellent: 80, amber: 60, red: 40 });
  });

  it("les seuils effectifs l'emportent sur la définition", () => {
    expect(resolveThresholds(def, eff({ excellent: 90, amber: 70, red: 50 }))).toEqual({
      excellent: 90,
      amber: 70,
      red: 50,
    });
  });

  it("résout champ par champ (effectif partiel, reste = défaut)", () => {
    expect(resolveThresholds(def, eff({ excellent: 95 }))).toEqual({
      excellent: 95, // effectif
      amber: 60, // défaut
      red: 40, // défaut
    });
  });

  it("un seuil effectif à 0 n'est pas écrasé par le défaut", () => {
    expect(resolveThresholds(def, eff({ red: 0 })).red).toBe(0);
  });

  it("définition sans seuils → null", () => {
    expect(
      resolveThresholds(
        { threshold_excellent: null, threshold_amber: null, threshold_red: null },
        undefined,
      ),
    ).toEqual({ excellent: null, amber: null, red: null });
  });
});
