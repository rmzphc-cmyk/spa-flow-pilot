-- 1. Fix SECURITY DEFINER view: switch to security_invoker
ALTER VIEW public.todos_overdue SET (security_invoker = on);

-- 2. Fix function with mutable search_path
CREATE OR REPLACE FUNCTION public.trigger_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- 3. Restrict EXECUTE on the auth hook (only supabase_auth_admin should call it)
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;

-- 4. Lock down realtime.messages so users can only subscribe to their own topic
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can subscribe to their own topics" ON realtime.messages;
CREATE POLICY "Authenticated users can subscribe to their own topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  -- Allow only topics that contain the authenticated user's id.
  -- The app uses `notifications-${userId}` channels; this also accommodates
  -- any future per-user topic naming convention.
  realtime.topic() LIKE '%' || auth.uid()::text || '%'
);