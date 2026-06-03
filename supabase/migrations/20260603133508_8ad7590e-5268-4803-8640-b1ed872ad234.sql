-- 1. EXTEND user_role ENUM
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'employee';

-- 2. Tables
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.destinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  country text,
  timezone text NOT NULL DEFAULT 'UTC',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, slug)
);
CREATE INDEX idx_destinations_org ON public.destinations(organization_id);
GRANT SELECT ON public.destinations TO authenticated;
GRANT ALL ON public.destinations TO service_role;
ALTER TABLE public.destinations ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER orgs_set_updated_at BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();
CREATE TRIGGER dest_set_updated_at BEFORE UPDATE ON public.destinations
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- 3. Columns
ALTER TABLE public.spas
  ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT,
  ADD COLUMN destination_id  uuid REFERENCES public.destinations(id)  ON DELETE RESTRICT;
CREATE INDEX idx_spas_org  ON public.spas(organization_id);
CREATE INDEX idx_spas_dest ON public.spas(destination_id);

ALTER TABLE public.users
  ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  ADD COLUMN destination_id  uuid REFERENCES public.destinations(id)  ON DELETE SET NULL,
  ADD COLUMN manager_id      uuid REFERENCES public.users(id)         ON DELETE SET NULL;
CREATE INDEX idx_users_org     ON public.users(organization_id);
CREATE INDEX idx_users_dest    ON public.users(destination_id);
CREATE INDEX idx_users_manager ON public.users(manager_id);

-- 4. Policies on new tables
CREATE POLICY orgs_all_admin ON public.organizations
  FOR ALL USING (current_user_role() = 'admin');

CREATE POLICY orgs_select_member ON public.organizations
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.organization_id = organizations.id)
    OR EXISTS (
      SELECT 1 FROM public.spas s
      JOIN public.users u ON u.spa_id = s.id
      WHERE u.id = auth.uid() AND s.organization_id = organizations.id
    )
  );

CREATE POLICY dest_all_admin ON public.destinations
  FOR ALL USING (current_user_role() = 'admin');

CREATE POLICY dest_select_member ON public.destinations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND (u.destination_id = destinations.id OR u.organization_id = destinations.organization_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.spas s
      JOIN public.users u ON u.spa_id = s.id
      WHERE u.id = auth.uid() AND s.destination_id = destinations.id
    )
  );

-- 5. DATA MIGRATION
DO $$
DECLARE
  v_org_id  uuid;
  v_dest_id uuid;
BEGIN
  INSERT INTO public.organizations (name, slug) VALUES ('Sanagua', 'sanagua')
  RETURNING id INTO v_org_id;

  INSERT INTO public.destinations (organization_id, name, slug, country, timezone)
  VALUES (v_org_id, 'Sanagua Default', 'default', 'ES', 'Atlantic/Canary')
  RETURNING id INTO v_dest_id;

  UPDATE public.spas SET organization_id = v_org_id, destination_id = v_dest_id
  WHERE organization_id IS NULL;

  UPDATE public.users u SET organization_id = v_org_id, destination_id = v_dest_id
  FROM public.spas s
  WHERE u.spa_id = s.id AND u.organization_id IS NULL;

  UPDATE public.users SET organization_id = v_org_id, destination_id = v_dest_id
  WHERE role::text = 'direction' AND organization_id IS NULL;
END $$;

ALTER TABLE public.spas
  ALTER COLUMN organization_id SET NOT NULL,
  ALTER COLUMN destination_id  SET NOT NULL;

-- 6. Helper (uses ::text to avoid uncommitted-enum issue with 'employee')
CREATE OR REPLACE FUNCTION public.user_can_access_spa(_spa_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    LEFT JOIN public.spas s ON s.id = _spa_id
    WHERE u.id = auth.uid()
      AND (
        u.role::text = 'admin'
        OR (u.role::text = 'spa_manager' AND u.spa_id = _spa_id)
        OR (u.role::text = 'direction' AND u.destination_id IS NOT NULL AND u.destination_id = s.destination_id)
        OR (u.role::text = 'direction' AND u.destination_id IS NULL AND u.organization_id = s.organization_id)
        OR (u.role::text = 'employee' AND EXISTS (
              SELECT 1 FROM public.users mgr
              WHERE mgr.id = u.manager_id AND mgr.spa_id = _spa_id
            ))
      )
  )
$$;

-- 7. Auto-sync direction_spa_access
CREATE OR REPLACE FUNCTION public.sync_direction_spa_access()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'users' THEN
    DELETE FROM public.direction_spa_access WHERE user_id = NEW.id;
    IF NEW.role::text = 'direction' THEN
      INSERT INTO public.direction_spa_access (user_id, spa_id, granted_by)
      SELECT NEW.id, s.id, NEW.id
      FROM public.spas s
      WHERE (NEW.destination_id IS NOT NULL AND s.destination_id = NEW.destination_id)
         OR (NEW.destination_id IS NULL AND NEW.organization_id IS NOT NULL AND s.organization_id = NEW.organization_id)
      ON CONFLICT DO NOTHING;
    END IF;
    RETURN NEW;
  ELSIF TG_TABLE_NAME = 'spas' THEN
    DELETE FROM public.direction_spa_access dsa
    USING public.users u
    WHERE dsa.user_id = u.id AND dsa.spa_id = NEW.id AND u.role::text = 'direction';
    INSERT INTO public.direction_spa_access (user_id, spa_id, granted_by)
    SELECT u.id, NEW.id, u.id
    FROM public.users u
    WHERE u.role::text = 'direction'
      AND (
        (u.destination_id IS NOT NULL AND u.destination_id = NEW.destination_id)
        OR (u.destination_id IS NULL AND u.organization_id IS NOT NULL AND u.organization_id = NEW.organization_id)
      )
    ON CONFLICT DO NOTHING;
    RETURN NEW;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_sync_dsa_users
  AFTER INSERT OR UPDATE OF role, destination_id, organization_id ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_direction_spa_access();

CREATE TRIGGER trg_sync_dsa_spas
  AFTER INSERT OR UPDATE OF destination_id, organization_id ON public.spas
  FOR EACH ROW EXECUTE FUNCTION public.sync_direction_spa_access();

-- 8. Backfill existing direction access
INSERT INTO public.direction_spa_access (user_id, spa_id, granted_by)
SELECT u.id, s.id, u.id
FROM public.users u
JOIN public.spas s
  ON (u.destination_id IS NOT NULL AND s.destination_id = u.destination_id)
  OR (u.destination_id IS NULL AND u.organization_id IS NOT NULL AND s.organization_id = u.organization_id)
WHERE u.role::text = 'direction'
ON CONFLICT DO NOTHING;