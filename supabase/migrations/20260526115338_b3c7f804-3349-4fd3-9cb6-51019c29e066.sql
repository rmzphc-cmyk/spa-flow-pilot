
-- 1. Create 3 auth users
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
) VALUES
  ('00000000-0000-0000-0000-000000000000','22222222-2222-2222-2222-222222222222','authenticated','authenticated','ana@sanagua.eu',crypt('sanagua2026', gen_salt('bf')),now(),
   jsonb_build_object('provider','email','providers',ARRAY['email'],'role','spa_manager','spa_id','11111111-1111-1111-1111-111111111111'),
   jsonb_build_object('full_name','Ana Sanagua'), now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000','44444444-4444-4444-4444-444444444444','authenticated','authenticated','valerie@sanagua.eu',crypt('sanagua2026', gen_salt('bf')),now(),
   jsonb_build_object('provider','email','providers',ARRAY['email'],'role','direction'),
   jsonb_build_object('full_name','Valérie Sanagua'), now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000','33333333-3333-3333-3333-333333333333','authenticated','authenticated','ramzi@photohotel.com',crypt('sanagua2026', gen_salt('bf')),now(),
   jsonb_build_object('provider','email','providers',ARRAY['email'],'role','admin'),
   jsonb_build_object('full_name','Ramzi Abichou'), now(), now(), '', '', '', '')
ON CONFLICT (id) DO NOTHING;

-- 2. Identities for email login
INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
VALUES
  (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', jsonb_build_object('sub','22222222-2222-2222-2222-222222222222','email','ana@sanagua.eu','email_verified',true), 'email', now(), now(), now()),
  (gen_random_uuid(), '44444444-4444-4444-4444-444444444444', '44444444-4444-4444-4444-444444444444', jsonb_build_object('sub','44444444-4444-4444-4444-444444444444','email','valerie@sanagua.eu','email_verified',true), 'email', now(), now(), now()),
  (gen_random_uuid(), '33333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333', jsonb_build_object('sub','33333333-3333-3333-3333-333333333333','email','ramzi@photohotel.com','email_verified',true), 'email', now(), now(), now())
ON CONFLICT DO NOTHING;

-- 3. public.users (must exist before spa due to FK on created_by; spa_id added after spa is created)
INSERT INTO public.users (id, email, full_name, role, preferred_language, timezone, spa_id, is_active)
VALUES
  ('33333333-3333-3333-3333-333333333333', 'ramzi@photohotel.com', 'Ramzi Abichou', 'admin', 'fr', 'Europe/Paris', NULL, true),
  ('22222222-2222-2222-2222-222222222222', 'ana@sanagua.eu', 'Ana Sanagua', 'spa_manager', 'fr', 'Atlantic/Canary', NULL, true),
  ('44444444-4444-4444-4444-444444444444', 'valerie@sanagua.eu', 'Valérie Sanagua', 'direction', 'fr', 'Europe/Paris', NULL, true)
ON CONFLICT (id) DO NOTHING;

-- 4. Default spa for Ana
INSERT INTO public.spas (id, name, slug, country, timezone, default_language, reporting_cycle_type, created_by, is_active)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'Sanagua Spa', 'sanagua-spa', 'ES', 'Atlantic/Canary', 'fr', 'monthly',
  '33333333-3333-3333-3333-333333333333', true
)
ON CONFLICT (id) DO NOTHING;

-- 5. Link Ana to her spa
UPDATE public.users
SET spa_id = '11111111-1111-1111-1111-111111111111'
WHERE id = '22222222-2222-2222-2222-222222222222';

-- 6. Preferences
INSERT INTO public.user_preferences (user_id)
VALUES
  ('22222222-2222-2222-2222-222222222222'),
  ('44444444-4444-4444-4444-444444444444'),
  ('33333333-3333-3333-3333-333333333333')
ON CONFLICT (user_id) DO NOTHING;

-- 7. Direction access for Valérie
INSERT INTO public.direction_spa_access (user_id, spa_id, granted_by)
VALUES (
  '44444444-4444-4444-4444-444444444444',
  '11111111-1111-1111-1111-111111111111',
  '33333333-3333-3333-3333-333333333333'
)
ON CONFLICT DO NOTHING;
