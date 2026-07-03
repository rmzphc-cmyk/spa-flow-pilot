/**
 * Progression d'un objectif chiffré, relative à la valeur de DÉPART (baseline).
 *
 * Un objectif « passer de 10 % à 25 % de rebooking » démarre à 0 % de
 * progression (current = start = 10) et atteint 100 % à la cible (current =
 * target = 25) — et non pas 40 % comme le donnerait un simple current/target.
 * Gère aussi les objectifs DÉCROISSANTS (ex. réduire les annulations de 20 à
 * 5 : current 12 → 53 %).
 *
 * Les objectifs legacy n'ont pas de `start` dans leur blob description →
 * défaut 0, ce qui redonne exactement l'ancien calcul current/target pour les
 * objectifs croissants partant de zéro.
 */
export function computeObjectiveProgress(
  current: number,
  target: number,
  start = 0,
): number {
  if (!Number.isFinite(current) || !Number.isFinite(target) || !Number.isFinite(start)) {
    return 0;
  }
  if (target === start) {
    // Cible dégénérée (cible = départ) : pas de direction de progression
    // définissable — atteint (100 %) uniquement si la valeur courante est sur
    // la cible, sinon 0. La validation du formulaire empêche désormais de
    // créer ce cas (cible ≠ départ requis).
    return current === target ? 100 : 0;
  }
  const ratio = ((current - start) / (target - start)) * 100;
  return Math.min(100, Math.max(0, Math.round(ratio)));
}
