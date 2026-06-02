
CREATE POLICY resp_tmpl_insert_manager ON public.responsibility_templates
  FOR INSERT TO public
  WITH CHECK (current_user_role() = 'spa_manager' AND spa_id = current_user_spa_id());

CREATE POLICY resp_tmpl_update_manager ON public.responsibility_templates
  FOR UPDATE TO public
  USING (current_user_role() = 'spa_manager' AND spa_id = current_user_spa_id())
  WITH CHECK (current_user_role() = 'spa_manager' AND spa_id = current_user_spa_id());

CREATE POLICY resp_tmpl_delete_manager ON public.responsibility_templates
  FOR DELETE TO public
  USING (current_user_role() = 'spa_manager' AND spa_id = current_user_spa_id());
