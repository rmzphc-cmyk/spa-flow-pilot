CREATE TABLE public.kpi_monthly_targets (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spa_id              UUID NOT NULL REFERENCES public.spas(id) ON DELETE CASCADE,
  kpi_definition_id   UUID NOT NULL REFERENCES public.kpi_definitions(id) ON DELETE CASCADE,
  year_month          TEXT NOT NULL,
  monthly_value       NUMERIC,
  weekly_mode         TEXT NOT NULL DEFAULT 'divide'
                      CHECK (weekly_mode IN ('divide', 'fixed')),
  weekly_override     NUMERIC,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (spa_id, kpi_definition_id, year_month)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kpi_monthly_targets TO authenticated;
GRANT ALL ON public.kpi_monthly_targets TO service_role;

CREATE TRIGGER set_updated_at_kpi_monthly_targets
  BEFORE UPDATE ON public.kpi_monthly_targets
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

ALTER TABLE public.kpi_monthly_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "manager_own_spa_targets"
  ON public.kpi_monthly_targets
  FOR ALL
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role' = 'spa_manager'
     AND spa_id::text = auth.jwt() -> 'app_metadata' ->> 'spa_id')
    OR auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role' = 'spa_manager'
     AND spa_id::text = auth.jwt() -> 'app_metadata' ->> 'spa_id')
    OR auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  );

CREATE POLICY "direction_read_targets"
  ON public.kpi_monthly_targets
  FOR SELECT
  TO authenticated
  USING (auth.jwt() -> 'app_metadata' ->> 'role' = 'direction');

ALTER TABLE public.kpi_entries
  ADD COLUMN IF NOT EXISTS target_value NUMERIC DEFAULT NULL;