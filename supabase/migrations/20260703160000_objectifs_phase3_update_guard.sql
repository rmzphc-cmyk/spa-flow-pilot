-- Phase 3 Objectifs — garde UPDATE du trigger limite (record de traçabilité).
-- Appliquée MANUELLEMENT en prod via Management API (projet zvitfplilnkhbclgrtru).
--
-- Trou fermé : le trigger limite ne couvrait que l'INSERT. Un UPDATE
-- achieved/abandoned → active (réactivation) pouvait porter le nombre
-- d'objectifs actifs au-delà de 3. Aucune UI ne réactive aujourd'hui :
-- garde-fou serveur contre un futur code ou un appel API direct.
--
-- La clause WHEN ne cible que la TRANSITION vers 'active' : un update
-- ordinaire d'un objectif déjà actif (titre, current_value, blob) ne
-- déclenche pas la garde — sinon tout update à 3/3 échouerait.
-- La fonction enforce_objective_active_limit() reste inchangée (verrou
-- consultatif + count) : au moment du BEFORE UPDATE, la ligne est encore
-- 'achieved'/'abandoned' en table, donc le count ne l'inclut pas.

drop trigger if exists trg_objective_active_limit_update on objectives;
create trigger trg_objective_active_limit_update
  before update of status on objectives
  for each row
  when (old.status is distinct from new.status and new.status = 'active')
  execute function enforce_objective_active_limit();
