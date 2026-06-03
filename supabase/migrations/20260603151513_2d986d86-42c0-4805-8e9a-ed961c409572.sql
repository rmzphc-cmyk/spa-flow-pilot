
-- Helper functions to avoid recursion when referencing users from other tables' policies
CREATE OR REPLACE FUNCTION public.current_user_organization_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT organization_id FROM public.users WHERE id = auth.uid() $$;

CREATE OR REPLACE FUNCTION public.current_user_destination_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT destination_id FROM public.users WHERE id = auth.uid() $$;

-- Replace recursive policies on organizations
DROP POLICY IF EXISTS orgs_select_member ON public.organizations;
CREATE POLICY orgs_select_member ON public.organizations
  FOR SELECT
  USING (
    id = public.current_user_organization_id()
    OR EXISTS (
      SELECT 1 FROM public.spas s
      WHERE s.organization_id = organizations.id
        AND s.id = public.current_user_spa_id()
    )
  );

-- Replace recursive policies on destinations
DROP POLICY IF EXISTS dest_select_member ON public.destinations;
CREATE POLICY dest_select_member ON public.destinations
  FOR SELECT
  USING (
    id = public.current_user_destination_id()
    OR organization_id = public.current_user_organization_id()
    OR EXISTS (
      SELECT 1 FROM public.spas s
      WHERE s.destination_id = destinations.id
        AND s.id = public.current_user_spa_id()
    )
  );
