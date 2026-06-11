-- Fix: spa_manager ne pouvait pas INSERTer dans checkins
-- L'upsert (onConflict: report_id) échoue à l'INSERT initial si la ligne n'existe pas encore.
-- La politique doit autoriser INSERT + UPDATE pour le manager propriétaire du rapport.

-- Supprimer les éventuelles politiques existantes sur checkins pour repartir propre
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'checkins'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.checkins', pol.policyname);
  END LOOP;
END $$;

-- Lecture : manager du rapport OU admin OU direction
CREATE POLICY "checkins_select"
  ON public.checkins FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.reports r
      WHERE r.id = checkins.report_id
        AND (
          r.manager_id = auth.uid()
          OR (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'direction')
        )
    )
  );

-- INSERT : manager propriétaire du rapport (non verrouillé)
CREATE POLICY "checkins_insert"
  ON public.checkins FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.reports r
      WHERE r.id = report_id
        AND r.manager_id = auth.uid()
        AND r.is_locked = false
    )
  );

-- UPDATE : manager propriétaire du rapport (non verrouillé)
CREATE POLICY "checkins_update"
  ON public.checkins FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.reports r
      WHERE r.id = checkins.report_id
        AND r.manager_id = auth.uid()
        AND r.is_locked = false
    )
  );

-- DELETE : admin uniquement (nettoyage)
CREATE POLICY "checkins_delete"
  ON public.checkins FOR DELETE
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );
