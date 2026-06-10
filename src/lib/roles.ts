// Source unique de vérité pour les rôles utilisateur.
//
// Deux vocabulaires coexistent volontairement et NE doivent jamais être confondus :
//
//  • DbRole  — la valeur stockée dans public.users.role (enum SQL `user_role`).
//              C'est ce que renvoient les requêtes Supabase et ce sur quoi on
//              filtre les listes admin (onglets Direction / Manager).
//
//  • AppRole — le rôle « applicatif » utilisé pour le routage UI, où le manager
//              de spa est simplement « manager ». Dérivé du DbRole via toAppRole().
//
// Le piège historique : un directeur a pour DbRole "direction" (PAS "director"
// ni "directeur" — ces variantes n'existent que dans les libellés traduits).
// Filtrer un onglet sur la mauvaise constante = utilisateur classé au mauvais
// endroit. On centralise donc ici pour bannir les chaînes magiques.

// Valeurs exactes de l'enum SQL `user_role` (public.users.role), telles que
// déclarées dans la DB live (cf. src/integrations/supabase/types.ts).
// `EMPLOYEE` existe dans l'enum mais n'est pas exploité par l'app aujourd'hui —
// conservé ici pour que le typage reste fidèle à la base (pas de cast forcé).
export const DB_ROLES = {
  SPA_MANAGER: "spa_manager",
  DIRECTION: "direction",
  ADMIN: "admin",
  EMPLOYEE: "employee",
} as const;

export type DbRole = (typeof DB_ROLES)[keyof typeof DB_ROLES];

export const ALL_DB_ROLES: readonly DbRole[] = Object.values(DB_ROLES);

/** Rôles réellement gérés par l'UI d'invitation admin (sous-ensemble de DbRole). */
export type InvitableRole = typeof DB_ROLES.SPA_MANAGER | typeof DB_ROLES.DIRECTION;

/** Garde-fou : vrai uniquement pour une valeur d'enum DB connue. */
export function isDbRole(value: unknown): value is DbRole {
  return typeof value === "string" && (ALL_DB_ROLES as readonly string[]).includes(value);
}

/** Rôle applicatif (routage UI). Le spa_manager se replie sur "manager". */
export type AppRole = "manager" | "direction" | "admin";

/**
 * Convertit n'importe quelle valeur (DbRole, alias "manager", inconnu…) vers
 * le rôle applicatif. Renvoie null si la valeur n'est pas reconnue — le code
 * appelant DOIT traiter ce cas (jamais de rôle par défaut silencieux).
 */
export function toAppRole(raw: unknown): AppRole | null {
  if (typeof raw !== "string") return null;
  if (raw === DB_ROLES.SPA_MANAGER || raw === "manager") return "manager";
  if (raw === DB_ROLES.DIRECTION) return "direction";
  if (raw === DB_ROLES.ADMIN) return "admin";
  return null;
}
