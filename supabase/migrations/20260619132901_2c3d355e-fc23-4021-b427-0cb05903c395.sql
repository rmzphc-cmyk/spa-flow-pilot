
UPDATE auth.users
SET email = 'ramzi@photohotel.com',
    email_change = '',
    email_change_token_new = '',
    email_change_token_current = '',
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    updated_at = now()
WHERE id = 'e8a39ac8-1a53-45d1-a5dc-11909cce4770';

UPDATE auth.identities
SET identity_data = jsonb_set(identity_data, '{email}', '"ramzi@photohotel.com"'),
    updated_at = now()
WHERE user_id = 'e8a39ac8-1a53-45d1-a5dc-11909cce4770' AND provider = 'email';

UPDATE public.users
SET email = 'ramzi@photohotel.com'
WHERE id = 'e8a39ac8-1a53-45d1-a5dc-11909cce4770';
