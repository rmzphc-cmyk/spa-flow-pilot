-- Appliquée MANUELLEMENT en prod le 2026-07-02 via Management API (projet zvitfplilnkhbclgrtru).
-- Refonte Objectifs — Phase 0. Record de traçabilité (les migrations ne sont pas auto-trackées).

-- ============================================================
-- SPA OMS — Refonte Objectifs — Phase 0 (fondations DB)
-- Additif & réversible. Idempotent. Transaction atomique.
-- ============================================================

-- 0.1 — objectives : type + colonnes chiffrées ---------------
do $$ begin
  if not exists (select 1 from pg_type where typname='objective_kind') then
    create type objective_kind as enum ('numeric','steps');
  end if;
end $$;

alter table objectives
  add column if not exists kind          objective_kind not null default 'numeric',
  add column if not exists metric        text,
  add column if not exists unit          text,
  add column if not exists start_value   numeric,
  add column if not exists target_value  numeric,
  add column if not exists current_value numeric;

-- 0.2 — journal d'actions ------------------------------------
do $$ begin
  if not exists (select 1 from pg_type where typname='objective_situation') then
    create type objective_situation as enum ('on_track','complicated','struggling');
  end if;
end $$;

create table if not exists objective_updates (
  id           uuid primary key default gen_random_uuid(),
  objective_id uuid not null references objectives(id) on delete cascade,
  spa_id       uuid not null references spas(id),
  report_id    uuid references reports(id),
  created_by   uuid not null default auth.uid() references users(id),
  action_text  text,
  value        numeric,
  situation    objective_situation,
  created_at   timestamptz not null default now()
);
create index if not exists objective_updates_obj_idx on objective_updates(objective_id, created_at desc);
alter table objective_updates enable row level security;

drop policy if exists objective_updates_admin_all        on objective_updates;
drop policy if exists objective_updates_select_manager   on objective_updates;
drop policy if exists objective_updates_select_direction on objective_updates;
drop policy if exists objective_updates_insert_manager   on objective_updates;
drop policy if exists objective_updates_update_manager   on objective_updates;

create policy objective_updates_admin_all        on objective_updates for all    using (current_user_role()='admin');
create policy objective_updates_select_manager   on objective_updates for select using (current_user_role()='spa_manager' and spa_id=current_user_spa_id());
create policy objective_updates_select_direction on objective_updates for select using (current_user_role()='direction' and exists(select 1 from direction_spa_access d where d.user_id=auth.uid() and d.spa_id=objective_updates.spa_id));
create policy objective_updates_insert_manager   on objective_updates for insert with check (current_user_role()='spa_manager' and spa_id=current_user_spa_id() and created_by=auth.uid() and exists(select 1 from objectives o where o.id=objective_id and o.spa_id=objective_updates.spa_id));
create policy objective_updates_update_manager   on objective_updates for update using (current_user_role()='spa_manager' and spa_id=current_user_spa_id());

-- 0.3 — étapes (type projet) ---------------------------------
create table if not exists objective_steps (
  id            uuid primary key default gen_random_uuid(),
  objective_id  uuid not null references objectives(id) on delete cascade,
  spa_id        uuid not null references spas(id),
  label         text not null,
  is_done       boolean not null default false,
  display_order int not null default 0,
  created_at    timestamptz not null default now()
);
alter table objective_steps enable row level security;

drop policy if exists objective_steps_admin_all        on objective_steps;
drop policy if exists objective_steps_manager_all       on objective_steps;
drop policy if exists objective_steps_select_direction on objective_steps;

create policy objective_steps_admin_all        on objective_steps for all    using (current_user_role()='admin');
create policy objective_steps_manager_all      on objective_steps for all    using (current_user_role()='spa_manager' and spa_id=current_user_spa_id()) with check (current_user_role()='spa_manager' and spa_id=current_user_spa_id() and exists(select 1 from objectives o where o.id=objective_id and o.spa_id=objective_steps.spa_id));
create policy objective_steps_select_direction on objective_steps for select using (current_user_role()='direction' and exists(select 1 from direction_spa_access d where d.user_id=auth.uid() and d.spa_id=objective_steps.spa_id));

-- 0.4 — limite 3 actifs (serveur, grandfather legacy) --------
create or replace function enforce_objective_active_limit() returns trigger language plpgsql as $$
begin
  if new.status='active' and (select count(*) from objectives where spa_id=new.spa_id and status='active') >= 3 then
    raise exception 'OBJECTIVE_LIMIT_REACHED';
  end if;
  return new;
end $$;

drop trigger if exists trg_objective_active_limit on objectives;
create trigger trg_objective_active_limit before insert on objectives for each row execute function enforce_objective_active_limit();
