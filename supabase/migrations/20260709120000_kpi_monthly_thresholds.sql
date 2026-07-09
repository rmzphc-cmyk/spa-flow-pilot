-- Seuils d'évaluation KPI variables dans le temps.
--
-- Jusqu'ici les 3 paliers (excellent / bon / correct) vivaient uniquement sur
-- kpi_definitions (valeur unique, figée). On les rend révisables par mois en
-- ajoutant des colonnes d'override (nullable) sur kpi_monthly_targets.
--
-- Résolution applicative (voir resolveThresholds côté front) :
--   seuil du mois → seuil du mois précédent (héritage) → seuil par défaut de la
--   définition. NULL sur une colonne = on retombe sur le niveau suivant.
--
-- comparison_direction reste sur kpi_definitions : le sens d'un KPI ne change pas
-- d'un mois à l'autre.
--
-- Rétrocompatible : aucune donnée à migrer. Les rapports passés gardent leur
-- statut figé (kpi_entries.status).

ALTER TABLE public.kpi_monthly_targets
  ADD COLUMN IF NOT EXISTS threshold_excellent NUMERIC NULL,
  ADD COLUMN IF NOT EXISTS threshold_amber     NUMERIC NULL,
  ADD COLUMN IF NOT EXISTS threshold_red       NUMERIC NULL;

COMMENT ON COLUMN public.kpi_monthly_targets.threshold_excellent IS
  'Override mensuel du seuil « excellent ». NULL = mois précédent, sinon kpi_definitions.threshold_excellent.';
COMMENT ON COLUMN public.kpi_monthly_targets.threshold_amber IS
  'Override mensuel du seuil « bon » (amber). NULL = mois précédent, sinon kpi_definitions.threshold_amber.';
COMMENT ON COLUMN public.kpi_monthly_targets.threshold_red IS
  'Override mensuel du seuil « correct » (red). NULL = mois précédent, sinon kpi_definitions.threshold_red.';
