-- ============================================================================
-- A0 SÉCURITÉ — Verrou ANTI-RÉGRESSION : direction_read_targets (kpi_monthly_targets)
--
-- ÉTAT (vérifié live le 2026-06-09 via pg_policies) :
--   • direction_read_targets · SELECT ·
--       USING (role='direction' AND user_can_access_spa(spa_id))   ← DÉJÀ CORRECT en prod
--   • manager_own_spa_targets · ALL · (manager=son spa OR admin)   ← conforme, on n'y touche pas
--
-- La fuite cross-org (un rôle direction lisait les cibles KPI de TOUS les spas) est
-- donc FERMÉE en prod (preuve : 25 lignes Paradisus, un direction scopé Belhazar en
-- lit 0 — cf. AUDIT_SECURITY_CLOSURE_A0.md). Le correctif avait été posé MANUELLEMENT
-- (Dashboard), jamais codifié en git → la migration committée 20260528170304 garde la
-- version NON scopée. Drift git↔prod = seul risque résiduel.
--
-- Ce SQL est désormais committé comme migration supersédante :
--   supabase/migrations/20260609000000_lock_direction_read_targets_scope.sql
--
-- APPLICATION : facultative et NO-OP côté prod (la policy live est déjà identique).
-- L'appliquer via Dashboard → SQL Editor ne fait que re-figer la bonne version
-- (idempotent). À faire si tu veux une ceinture-bretelles ; sinon git est déjà réaligné.
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

-- ============================================================================
-- REVALIDATION (rejouer la sonde, doit rester vert) :
--   npx playwright test tests/audit/security-probe.spec.ts \
--     --config=tests/audit/playwright.audit.config.ts
--   Attendu : [FUITE] direction lit OTHER_SPA rows=0 ✅ | [CENSUS ADMIN] rows=25 (table pleine)
-- ============================================================================
