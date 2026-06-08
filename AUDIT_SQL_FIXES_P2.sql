-- ============================================================================
-- AUDIT P2 — Correctif SQL P1 (sécurité) : verrouillage des colonnes sensibles
-- de public.users contre l'auto-modification par l'utilisateur lui-même
--
-- Contexte : la policy `users_update_own` (USING/WITH CHECK : id = auth.uid())
-- autorise un utilisateur à modifier sa propre ligne sans restriction de colonne.
-- Probe live confirmée (2026-06-08) : un spa_manager ne peut PAS changer son
-- `role` ni son `spa_id` (bloqués par 403, mécanisme déjà en place ailleurs),
-- MAIS PEUT changer son `organization_id` / `destination_id` → débloque ensuite
-- la lecture cross-org via `orgs_select_member` / `dest_select_member`, qui
-- font confiance à ces colonnes (au lieu du JWT app_metadata).
--
-- Correctif retenu : verrouiller TOUTES les colonnes d'autorisation sur
-- public.users via un trigger BEFORE UPDATE — défense en profondeur, robuste
-- indépendamment de la logique de chaque policy en aval (orgs/dest/dsa…).
--
-- À appliquer manuellement via Supabase Dashboard → SQL Editor (PAS de CLI,
-- conformément au workflow du projet).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.lock_sensitive_user_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.current_user_role() <> 'admin' THEN
    NEW.role            := OLD.role;
    NEW.spa_id          := OLD.spa_id;
    NEW.organization_id := OLD.organization_id;
    NEW.destination_id  := OLD.destination_id;
    NEW.manager_id      := OLD.manager_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lock_sensitive_user_columns ON public.users;

CREATE TRIGGER trg_lock_sensitive_user_columns
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.lock_sensitive_user_columns();

-- ============================================================================
-- Vérification post-application (à rejouer sous JWT spa_manager, ex. Sophie) :
--   PATCH users?id=eq.<son_id>  body: { "organization_id": "<autre org réelle>" }
--   → attendu : 200 OK mais la colonne reste inchangée (silently ignored par le trigger)
--             ou alternativement la requête peut renvoyer 200 avec l'ancienne valeur.
--   Confirmer ensuite que SELECT organizations sous ce JWT ne retourne plus
--   que les organisations réellement liées à son spa.
-- ============================================================================
