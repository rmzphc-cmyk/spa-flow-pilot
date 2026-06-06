/**
 * Traduit une erreur technique (Supabase, réseau, validation) en message
 * compréhensible par un utilisateur non-technique (spa manager).
 */
export function friendlyError(error: unknown): string {
  const raw = extractRawMessage(error).toLowerCase();
  const status = extractStatus(error);

  // Timeout / réseau
  if (
    raw.includes("timeout") ||
    raw.includes("timed out") ||
    raw.includes("etimedout") ||
    raw.includes("err_timeout") ||
    raw.includes("network") ||
    raw.includes("failed to fetch") ||
    raw.includes("networkerror") ||
    raw.includes("aborted")
  ) {
    return "Connexion trop lente. Attendez et réessayez.";
  }

  // Droits / auth
  if (
    status === 401 ||
    status === 403 ||
    raw.includes("permission denied") ||
    raw.includes("not authorized") ||
    raw.includes("unauthorized") ||
    raw.includes("forbidden") ||
    raw.includes("row-level security") ||
    raw.includes("rls")
  ) {
    return "Vous n'avez pas les droits pour cette action.";
  }

  // Fichier audio trop volumineux
  if (
    raw.includes("whisper") ||
    raw.includes("file too large") ||
    raw.includes("payload too large") ||
    raw.includes("trop volumineux") ||
    raw.includes("max size") ||
    raw.includes("25 mo") ||
    raw.includes("20 mo") ||
    status === 413
  ) {
    return "Fichier audio trop volumineux (max 20 Mo).";
  }

  // Contraintes DB / données incomplètes
  if (
    raw.includes("foreign key") ||
    raw.includes("constraint") ||
    raw.includes("violates") ||
    raw.includes("not null") ||
    raw.includes("null value") ||
    raw.includes("duplicate key") ||
    raw.includes("check constraint")
  ) {
    return "Données incomplètes. Vérifiez que toutes les sections sont remplies.";
  }

  return "Une erreur inattendue est survenue. Réessayez ou contactez le support.";
}

function extractRawMessage(error: unknown): string {
  if (!error) return "";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (typeof error === "object") {
    const e = error as Record<string, unknown>;
    const parts = [e.message, e.error_description, e.error, e.hint, e.details, e.code]
      .filter((v) => typeof v === "string");
    if (parts.length) return parts.join(" ");
    try { return JSON.stringify(error); } catch { return String(error); }
  }
  return String(error);
}

function extractStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const e = error as Record<string, unknown>;
  const s = e.status ?? e.statusCode ?? e.code;
  if (typeof s === "number") return s;
  if (typeof s === "string") {
    const n = parseInt(s, 10);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}
