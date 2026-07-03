import { describe, it, expect } from "vitest";
import { computeObjectiveProgress } from "@/lib/objectiveProgress";

describe("computeObjectiveProgress", () => {
  describe("objectif croissant (start 10 → target 25)", () => {
    it("vaut 0 % au départ", () => {
      expect(computeObjectiveProgress(10, 25, 10)).toBe(0);
    });
    it("vaut 50 % à mi-chemin", () => {
      expect(computeObjectiveProgress(17.5, 25, 10)).toBe(50);
    });
    it("vaut 100 % à la cible", () => {
      expect(computeObjectiveProgress(25, 25, 10)).toBe(100);
    });
    it("est plafonné à 100 % en cas de dépassement", () => {
      expect(computeObjectiveProgress(30, 25, 10)).toBe(100);
    });
    it("est plancher à 0 % en cas de régression sous le départ", () => {
      expect(computeObjectiveProgress(5, 25, 10)).toBe(0);
    });
    it("arrondit au pourcent entier", () => {
      // (12 - 10) / (25 - 10) = 13,33 % → 13
      expect(computeObjectiveProgress(12, 25, 10)).toBe(13);
    });
  });

  describe("objectif décroissant (start 20 → target 5)", () => {
    it("vaut 0 % au départ", () => {
      expect(computeObjectiveProgress(20, 5, 20)).toBe(0);
    });
    it("vaut 53 % à current = 12", () => {
      expect(computeObjectiveProgress(12, 5, 20)).toBe(53);
    });
    it("vaut 100 % à la cible", () => {
      expect(computeObjectiveProgress(5, 5, 20)).toBe(100);
    });
    it("est plafonné à 100 % si la cible est dépassée (encore plus bas)", () => {
      expect(computeObjectiveProgress(2, 5, 20)).toBe(100);
    });
    it("est plancher à 0 % si la valeur remonte au-dessus du départ", () => {
      expect(computeObjectiveProgress(25, 5, 20)).toBe(0);
    });
  });

  describe("cible = départ (cas dégénéré, bloqué à la création désormais)", () => {
    it("vaut 100 % si la valeur courante est sur la cible", () => {
      expect(computeObjectiveProgress(10, 10, 10)).toBe(100);
    });
    it("vaut 0 % si la valeur courante n'est pas sur la cible", () => {
      expect(computeObjectiveProgress(8, 10, 10)).toBe(0);
      expect(computeObjectiveProgress(15, 10, 10)).toBe(0);
    });
  });

  describe("legacy : start absent → défaut 0", () => {
    it("retombe sur l'ancien calcul current/target", () => {
      expect(computeObjectiveProgress(12, 25)).toBe(48);
      expect(computeObjectiveProgress(0, 25)).toBe(0);
      expect(computeObjectiveProgress(25, 25)).toBe(100);
      expect(computeObjectiveProgress(30, 25)).toBe(100);
    });
  });

  describe("entrées invalides", () => {
    it("retourne 0 sur NaN ou infini", () => {
      expect(computeObjectiveProgress(NaN, 25, 0)).toBe(0);
      expect(computeObjectiveProgress(10, NaN, 0)).toBe(0);
      expect(computeObjectiveProgress(10, 25, NaN)).toBe(0);
      expect(computeObjectiveProgress(Infinity, 25, 0)).toBe(0);
    });
  });
});
