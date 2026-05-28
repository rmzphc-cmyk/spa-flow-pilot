ALTER TABLE public.kpi_definitions
  ADD COLUMN IF NOT EXISTS kpi_group TEXT NOT NULL DEFAULT 'spa';

ALTER TABLE public.kpi_definitions
  DROP CONSTRAINT IF EXISTS kpi_definitions_kpi_group_check;

ALTER TABLE public.kpi_definitions
  ADD CONSTRAINT kpi_definitions_kpi_group_check
  CHECK (kpi_group IN ('spa', 'manager'));

UPDATE public.kpi_definitions
  SET kpi_group = 'manager' WHERE category = 'hr';