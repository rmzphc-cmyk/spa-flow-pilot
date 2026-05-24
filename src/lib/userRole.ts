// Lightweight client-side role helper.
// Until real auth is wired in, role is persisted in localStorage and
// defaults to "manager". A spa_manager is scoped to a single spa; direction
// and admin see the multi-spa overview.

export type UserRole = "manager" | "direction" | "admin";

const ROLE_KEY = "user_role_v1";
const SPA_KEY = "user_spa_v1";

export const MANAGER_DEFAULT_SPA = { key: "par-gran-canaria", name: "Par Gran Canaria" };

export function getUserRole(): UserRole {
  try {
    const r = localStorage.getItem(ROLE_KEY);
    if (r === "direction" || r === "admin" || r === "manager") return r;
  } catch {}
  return "manager";
}

export function setUserRole(role: UserRole) {
  try { localStorage.setItem(ROLE_KEY, role); } catch {}
}

export function getManagerSpa(): { key: string; name: string } {
  try {
    const raw = localStorage.getItem(SPA_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p?.key && p?.name) return p;
    }
  } catch {}
  return MANAGER_DEFAULT_SPA;
}

export const isManagerRole = () => getUserRole() === "manager";
export const hasMultiSpaAccess = () => {
  const r = getUserRole();
  return r === "direction" || r === "admin";
};
