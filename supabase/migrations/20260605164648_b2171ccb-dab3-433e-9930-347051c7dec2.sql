
DROP POLICY IF EXISTS kra_insert_admin ON public.kpi_role_assignments;
DROP POLICY IF EXISTS kra_update_admin ON public.kpi_role_assignments;
DROP POLICY IF EXISTS kra_delete_admin ON public.kpi_role_assignments;

CREATE POLICY kra_insert_admin_or_manager ON public.kpi_role_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_role() = 'admin'
    OR (
      public.current_user_role() = 'spa_manager'
      AND EXISTS (
        SELECT 1 FROM public.kpi_definitions kd
        WHERE kd.id = kpi_role_assignments.kpi_definition_id
          AND kd.spa_id = public.current_user_spa_id()
      )
    )
  );

CREATE POLICY kra_update_admin_or_manager ON public.kpi_role_assignments
  FOR UPDATE TO authenticated
  USING (
    public.current_user_role() = 'admin'
    OR (
      public.current_user_role() = 'spa_manager'
      AND EXISTS (
        SELECT 1 FROM public.kpi_definitions kd
        WHERE kd.id = kpi_role_assignments.kpi_definition_id
          AND kd.spa_id = public.current_user_spa_id()
      )
    )
  )
  WITH CHECK (
    public.current_user_role() = 'admin'
    OR (
      public.current_user_role() = 'spa_manager'
      AND EXISTS (
        SELECT 1 FROM public.kpi_definitions kd
        WHERE kd.id = kpi_role_assignments.kpi_definition_id
          AND kd.spa_id = public.current_user_spa_id()
      )
    )
  );

CREATE POLICY kra_delete_admin_or_manager ON public.kpi_role_assignments
  FOR DELETE TO authenticated
  USING (
    public.current_user_role() = 'admin'
    OR (
      public.current_user_role() = 'spa_manager'
      AND EXISTS (
        SELECT 1 FROM public.kpi_definitions kd
        WHERE kd.id = kpi_role_assignments.kpi_definition_id
          AND kd.spa_id = public.current_user_spa_id()
      )
    )
  );
