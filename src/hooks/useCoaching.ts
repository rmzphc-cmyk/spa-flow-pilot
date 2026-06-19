import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Coach onboarding contextuel — contenu pédagogique attaché à une SECTION du
 * rapport (clé i18n stable de son en-tête). Modèle « pourquoi / comment je
 * remplis cette section », voix corporate-friendly accessible.
 *
 * Le filtrage par rôle est assuré par la RLS (`coaching_content_select`, qui
 * compare au DbRole du JWT `app_metadata.role` — PAS l'AppRole "manager" du
 * front).
 */
export interface CoachingHint {
  id: string;
  section_slug: string;
  surface_key: string;
  titre: string;
  pourquoi: string;
  comment: string;
  exemple: string | null;
  a_retenir: string | null;
}

/** Langue de contenu (2 lettres) dérivée de la langue UI active. */
function contentLang(raw: string | undefined): string {
  return (raw || "fr").slice(0, 2);
}

export function useCoaching(surfaceKey: string | undefined) {
  const { userRole } = useAuth();
  const { i18n } = useTranslation();
  const lang = contentLang(i18n.language);

  return useQuery({
    queryKey: ["coaching_content", surfaceKey, lang, userRole],
    enabled: !!surfaceKey && !!userRole,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    // Dégrade en silence si la table n'est pas encore migrée : le coach est
    // opt-in, l'absence de contenu ne doit jamais bruiter ni réessayer.
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coaching_content")
        .select(
          "id, section_slug, surface_key, titre, pourquoi, comment, exemple, a_retenir",
        )
        .eq("surface_key", surfaceKey!)
        .eq("lang", lang)
        .eq("is_active", true)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CoachingHint[];
    },
  });
}
