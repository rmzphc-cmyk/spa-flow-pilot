DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.checkins'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ~* '(mood_score|focus_level)'
  LOOP
    EXECUTE format('ALTER TABLE public.checkins DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.checkins
  ADD CONSTRAINT checkins_mood_score_check  CHECK (mood_score  BETWEEN 0 AND 5),
  ADD CONSTRAINT checkins_focus_level_check CHECK (focus_level BETWEEN 0 AND 5);