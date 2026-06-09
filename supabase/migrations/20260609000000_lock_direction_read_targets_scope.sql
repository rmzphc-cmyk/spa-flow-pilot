-- ============================================================================
-- Anti-régression : verrouille le scope de la policy SELECT `direction_read_targets`
-- sur public.kpi_monthly_targets.
--
-- POURQUOI : la migration 20260528170304 a créé cette policy en version NON scopée
--   USING (auth.jwt()->'app_metadata'->>'role' = 'direction')
-- → un rôle `direction` lisait les cibles KPI de TOUS les spas (fuite cross-org).
-- La prod a depuis été corrigée MANUELLEMENT (Dashboard) vers la version scopée
-- ci-dessous (helper public.user_can_access_spa, défini en 20260603133508), mais le
-- correctif n'avait jamais été codifié en git → drift. Cette migration réaligne git
-- sur la prod et empêche toute régression par replay/resync.
--
-- IDEMPOTENT + NO-OP fonctionnel : la définition ci-dessous est IDENTIQUE à la policy
-- actuellement active en prod (vérifié via pg_policies le 2026-06-09). Réappliquer ne
-- change donc rien au comportement, cela ne fait que figer la bonne version.
--
-- N'altère PAS `manager_own_spa_targets` (déjà conforme git↔prod).
-- ============================================================================

DROP POLICY IF EXISTS "direction_read_targets" ON public.kpi_monthly_targets;

CREATE POLICY "direction_read_targets"
  ON public.kpi_monthly_targets
  FOR SELECT
  TO authenticated
  USING (
    auth.jwt() -> 'app_metadata' ->> 'role' = 'direction'
    AND public.user_can_access_spa(spa_id)
  );
