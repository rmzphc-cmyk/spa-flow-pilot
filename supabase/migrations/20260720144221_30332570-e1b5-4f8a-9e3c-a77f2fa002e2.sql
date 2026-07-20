-- ============================================================
-- Helpers: user_can_manage_spa / user_can_manage_destination
-- ============================================================

create or replace function public.user_can_manage_spa(_spa_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    left join public.spas s on s.id = _spa_id
    where u.id = auth.uid()
      and (
        u.role::text = 'admin'
        or (
          u.role::text = 'direction'
          and u.destination_id is not null
          and s.destination_id = u.destination_id
        )
      )
  )
$$;

create or replace function public.user_can_manage_destination(_destination_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users u
    where u.id = auth.uid()
      and (
        u.role::text = 'admin'
        or (u.role::text = 'direction' and u.destination_id = _destination_id)
      )
  )
$$;

grant execute on function public.user_can_manage_spa(uuid) to authenticated;
grant execute on function public.user_can_manage_destination(uuid) to authenticated;

-- ============================================================
-- SPAS
-- ============================================================
drop policy if exists spas_insert_admin on public.spas;
drop policy if exists spas_update_admin on public.spas;
drop policy if exists spas_delete_admin on public.spas;

create policy spas_insert_admin_or_direction on public.spas
  for insert to authenticated
  with check (public.user_can_manage_destination(destination_id));

create policy spas_update_admin_or_direction on public.spas
  for update to authenticated
  using (public.user_can_manage_destination(destination_id))
  with check (public.user_can_manage_destination(destination_id));

create policy spas_delete_admin_or_direction on public.spas
  for delete to authenticated
  using (public.user_can_manage_destination(destination_id));

-- SELECT direction sur toute sa destination (sans dépendre de direction_spa_access)
drop policy if exists spas_select_direction_dest on public.spas;
create policy spas_select_direction_dest on public.spas
  for select to authenticated
  using (
    public.current_user_role() = 'direction'
    and destination_id = public.current_user_destination_id()
  );

-- ============================================================
-- KPI DEFINITIONS
-- ============================================================
drop policy if exists kpi_def_insert on public.kpi_definitions;
drop policy if exists kpi_def_update on public.kpi_definitions;
drop policy if exists kpi_def_delete on public.kpi_definitions;

create policy kpi_def_insert on public.kpi_definitions
  for insert to authenticated
  with check (
    public.user_can_manage_spa(spa_id)
    or (public.current_user_role() = 'spa_manager' and spa_id = public.current_user_spa_id())
  );

create policy kpi_def_update on public.kpi_definitions
  for update to authenticated
  using (
    public.user_can_manage_spa(spa_id)
    or (public.current_user_role() = 'spa_manager' and spa_id = public.current_user_spa_id())
  )
  with check (
    public.user_can_manage_spa(spa_id)
    or (public.current_user_role() = 'spa_manager' and spa_id = public.current_user_spa_id())
  );

create policy kpi_def_delete on public.kpi_definitions
  for delete to authenticated
  using (
    public.user_can_manage_spa(spa_id)
    or (public.current_user_role() = 'spa_manager' and spa_id = public.current_user_spa_id())
  );

-- SELECT direction sur toute sa destination (en plus de la policy existante direction_spa_access)
drop policy if exists kpi_def_select_direction_dest on public.kpi_definitions;
create policy kpi_def_select_direction_dest on public.kpi_definitions
  for select to authenticated
  using (
    public.current_user_role() = 'direction'
    and public.user_can_manage_spa(spa_id)
  );

-- ============================================================
-- KPI ROLE ASSIGNMENTS
-- ============================================================
drop policy if exists kra_insert_admin_or_manager on public.kpi_role_assignments;
drop policy if exists kra_update_admin_or_manager on public.kpi_role_assignments;
drop policy if exists kra_delete_admin_or_manager on public.kpi_role_assignments;

create policy kra_insert_admin_manager_dir on public.kpi_role_assignments
  for insert to authenticated
  with check (
    exists (
      select 1 from public.kpi_definitions kd
      where kd.id = kpi_role_assignments.kpi_definition_id
        and (
          public.user_can_manage_spa(kd.spa_id)
          or (public.current_user_role() = 'spa_manager' and kd.spa_id = public.current_user_spa_id())
        )
    )
  );

create policy kra_update_admin_manager_dir on public.kpi_role_assignments
  for update to authenticated
  using (
    exists (
      select 1 from public.kpi_definitions kd
      where kd.id = kpi_role_assignments.kpi_definition_id
        and (
          public.user_can_manage_spa(kd.spa_id)
          or (public.current_user_role() = 'spa_manager' and kd.spa_id = public.current_user_spa_id())
        )
    )
  )
  with check (
    exists (
      select 1 from public.kpi_definitions kd
      where kd.id = kpi_role_assignments.kpi_definition_id
        and (
          public.user_can_manage_spa(kd.spa_id)
          or (public.current_user_role() = 'spa_manager' and kd.spa_id = public.current_user_spa_id())
        )
    )
  );

create policy kra_delete_admin_manager_dir on public.kpi_role_assignments
  for delete to authenticated
  using (
    exists (
      select 1 from public.kpi_definitions kd
      where kd.id = kpi_role_assignments.kpi_definition_id
        and (
          public.user_can_manage_spa(kd.spa_id)
          or (public.current_user_role() = 'spa_manager' and kd.spa_id = public.current_user_spa_id())
        )
    )
  );

-- ============================================================
-- KPI MONTHLY TARGETS: direction ALL sur sa destination
-- ============================================================
drop policy if exists kpi_targets_direction on public.kpi_monthly_targets;
create policy kpi_targets_direction on public.kpi_monthly_targets
  for all to authenticated
  using (
    public.current_user_role() = 'direction'
    and public.user_can_manage_spa(spa_id)
  )
  with check (
    public.current_user_role() = 'direction'
    and public.user_can_manage_spa(spa_id)
  );

-- ============================================================
-- RESPONSIBILITY TEMPLATES
-- ============================================================
drop policy if exists resp_tmpl_insert_admin on public.responsibility_templates;
drop policy if exists resp_tmpl_update_admin on public.responsibility_templates;
drop policy if exists resp_tmpl_delete_admin on public.responsibility_templates;

create policy resp_tmpl_insert_admin_dir on public.responsibility_templates
  for insert to authenticated
  with check (public.user_can_manage_spa(spa_id));

create policy resp_tmpl_update_admin_dir on public.responsibility_templates
  for update to authenticated
  using (public.user_can_manage_spa(spa_id))
  with check (public.user_can_manage_spa(spa_id));

create policy resp_tmpl_delete_admin_dir on public.responsibility_templates
  for delete to authenticated
  using (public.user_can_manage_spa(spa_id));

-- ============================================================
-- USERS: direction gère les spa_manager de sa destination
-- (l'invite passe par l'edge function en service_role, RLS non requis)
-- ============================================================
drop policy if exists users_update_direction on public.users;
create policy users_update_direction on public.users
  for update to authenticated
  using (
    public.current_user_role() = 'direction'
    and role::text = 'spa_manager'
    and destination_id is not null
    and destination_id = public.current_user_destination_id()
  )
  with check (
    public.current_user_role() = 'direction'
    and role::text = 'spa_manager'
    and destination_id is not null
    and destination_id = public.current_user_destination_id()
  );

drop policy if exists users_delete_direction on public.users;
create policy users_delete_direction on public.users
  for delete to authenticated
  using (
    public.current_user_role() = 'direction'
    and role::text = 'spa_manager'
    and destination_id is not null
    and destination_id = public.current_user_destination_id()
  );

drop policy if exists users_select_direction_dest on public.users;
create policy users_select_direction_dest on public.users
  for select to authenticated
  using (
    public.current_user_role() = 'direction'
    and role::text = 'spa_manager'
    and destination_id is not null
    and destination_id = public.current_user_destination_id()
  );
