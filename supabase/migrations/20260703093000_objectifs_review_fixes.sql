-- Appliquée MANUELLEMENT en prod le 2026-07-03 via Management API (projet zvitfplilnkhbclgrtru).
-- Correctifs issus du code review xhigh Phase 1 Objectifs. Record de traçabilité.

-- Fix review #9 : verrou consultatif par spa — deux INSERT concurrents ne peuvent plus
-- passer ensemble le count de la limite (count-then-insert sans verrou).
create or replace function enforce_objective_active_limit() returns trigger language plpgsql as $$
begin
  if new.status='active' then
    perform pg_advisory_xact_lock(hashtext('objective_limit_' || new.spa_id::text));
    if (select count(*) from objectives where spa_id=new.spa_id and status='active') >= 3 then
      raise exception 'OBJECTIVE_LIMIT_REACHED';
    end if;
  end if;
  return new;
end $$;

-- Fix review #26 : WITH CHECK explicite sur l'UPDATE du journal (aligné sur la policy INSERT :
-- created_by = auteur + cohérence référentielle objectif/spa).
drop policy if exists objective_updates_update_manager on objective_updates;
create policy objective_updates_update_manager on objective_updates for update
  using (current_user_role()='spa_manager' and spa_id=current_user_spa_id())
  with check (
    current_user_role()='spa_manager' and spa_id=current_user_spa_id()
    and created_by=auth.uid()
    and exists(select 1 from objectives o where o.id=objective_id and o.spa_id=objective_updates.spa_id)
  );
