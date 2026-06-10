-- Fix : le trigger lock_sensitive_user_columns() verrouille role/spa_id/destination_id/
-- organization_id/manager_id sur public.users dès que l'appelant n'est pas 'admin'
-- (protection anti-escalade, 2026-06-08). Or l'Edge Function admin-manage-user écrit
-- avec la clé service_role (pas de JWT utilisateur) → current_user_role() = 'anonymous'
-- → le verrou annulait SILENCIEUSEMENT les écritures légitimes de rôle/affectation.
-- Symptôme : invitations créant des comptes role=spa_manager, spa_id/dest/org = NULL.
--
-- Correctif minimal et sûr : exempter le service_role. Cette clé est server-side
-- uniquement (env des Edge Functions, jamais exposée) et bypasse DÉJÀ toute la RLS ;
-- le trigger était accidentellement plus strict que la RLS. Les utilisateurs
-- 'authenticated' restent verrouillés (ils ne peuvent pas obtenir de JWT service_role).
CREATE OR REPLACE FUNCTION public.lock_sensitive_user_columns()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Les Edge Functions admin de confiance s'authentifient en service_role : on les
  -- laisse gérer les rôles et affectations (seul canal légitime de provisioning).
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF public.current_user_role() <> 'admin' THEN
    NEW.role            := OLD.role;
    NEW.spa_id          := OLD.spa_id;
    NEW.organization_id := OLD.organization_id;
    NEW.destination_id  := OLD.destination_id;
    NEW.manager_id      := OLD.manager_id;
  END IF;
  RETURN NEW;
END;
$function$;
