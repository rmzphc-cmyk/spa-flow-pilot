import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Coach onboarding contextuel — lecture du contenu pédagogique attaché à une
 * surface de l'app (clé i18n stable). Une surface peut porter PLUSIEURS unités
 * (ex. KPI hiérarchisé + indicateur de suivi sur `kpiConfig.roleAssignment`).
 *
 * Le filtrage par rôle est assuré par la RLS (`coaching_content_select`, qui
 * compare au DbRole du JWT `app_metadata.role` — PAS l'AppRole "manager" du
 * front). On ne sélectionne jamais `expert_note` : c'est la couche méthodo de
 * coulisses, réservée au chatbot v2 / IP Polypus.
 */
export interface CoachingHint {
  id: string;
  concept_slug: string;
  surface_key: string;
  quoi: string;
  pourquoi: string;
  benefice_metier: string;
  objection: string | null;
  exemple: string | null;
  piege: string | null;
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
          "id, concept_slug, surface_key, quoi, pourquoi, benefice_metier, objection, exemple, piege",
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
