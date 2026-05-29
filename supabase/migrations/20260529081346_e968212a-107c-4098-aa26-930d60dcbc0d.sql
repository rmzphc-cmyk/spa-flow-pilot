-- Supprimer les 3 politiques admin-only existantes
DROP POLICY IF EXISTS "kpi_def_insert_admin" ON public.kpi_definitions;
DROP POLICY IF EXISTS "kpi_def_update_admin" ON public.kpi_definitions;
DROP POLICY IF EXISTS "kpi_def_delete_admin" ON public.kpi_definitions;

-- INSERT : admin OU spa_manager pour son propre spa
CREATE POLICY "kpi_def_insert"
  ON public.kpi_definitions FOR INSERT
  WITH CHECK (
    public.current_user_role() = 'admin'
    OR (
      public.current_user_role() = 'spa_manager'
      AND spa_id = public.current_user_spa_id()
    )
  );

-- UPDATE : admin OU spa_manager pour son propre spa
-- WITH CHECK obligatoire pour bloquer toute tentative de changer spa_id
CREATE POLICY "kpi_def_update"
  ON public.kpi_definitions FOR UPDATE
  USING (
    public.current_user_role() = 'admin'
    OR (
      public.current_user_role() = 'spa_manager'
      AND spa_id = public.current_user_spa_id()
    )
  )
  WITH CHECK (
    public.current_user_role() = 'admin'
    OR (
      public.current_user_role() = 'spa_manager'
      AND spa_id = public.current_user_spa_id()
    )
  );

-- DELETE (soft-delete is_active=false) : admin OU spa_manager pour son propre spa
CREATE POLICY "kpi_def_delete"
  ON public.kpi_definitions FOR DELETE
  USING (
    public.current_user_role() = 'admin'
    OR (
      public.current_user_role() = 'spa_manager'
      AND spa_id = public.current_user_spa_id()
    )
  );