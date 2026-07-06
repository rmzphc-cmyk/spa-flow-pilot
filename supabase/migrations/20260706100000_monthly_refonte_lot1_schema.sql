-- =============================================================================
-- Lot 1 — Refonte Monthly Meeting : fondations schéma
-- Application : MANUELLE via Dashboard → SQL Editor
-- NE PAS utiliser supabase db push / CLI
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. reports — snapshot "avant" + langue de réunion détectée par Whisper
-- -----------------------------------------------------------------------------

ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS snapshot_before_meeting JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS meeting_language        TEXT   DEFAULT NULL;

COMMENT ON COLUMN reports.snapshot_before_meeting IS
  'Snapshot JSONB des 7 sections capturé au démarrage de la réunion (clic "Lancer la réunion"). Null pour les reports créés avant la refonte monthly.';

COMMENT ON COLUMN reports.meeting_language IS
  'Langue détectée par Whisper (BCP-47 : fr, en, es, ro…). Null tant que la réunion n''a pas été transcrite.';


-- -----------------------------------------------------------------------------
-- 2. meeting_summaries — output complet de l'agent coach (JSONB unique)
-- -----------------------------------------------------------------------------
-- Pourquoi un seul champ ai_output plutôt que ai_proposals + ai_decisions :
--   · L'agent retourne un objet JSON unique validé — le stocker entier évite
--     toute désynchronisation entre colonnes.
--   · Évolution du schéma JSON = zero migration SQL.
--   · Accès aux sous-champs : ai_output->>'verdict', ai_output->'proposals', etc.
-- -----------------------------------------------------------------------------

ALTER TABLE meeting_summaries
  ADD COLUMN IF NOT EXISTS ai_output JSONB DEFAULT NULL;

COMMENT ON COLUMN meeting_summaries.ai_output IS
  'JSON complet retourné par l''agent coach mensuel : { meeting_language, audio_used, verdict, executive_summary, highlights, decisions, proposals, blind_spots }. Null tant que la synthèse n''a pas été générée. Les proposals restent ici tant que le manager ne les a pas acceptées (pas de vrais ids_items / todos / objectives créés avant acceptation).';


-- -----------------------------------------------------------------------------
-- 3. Enum language_code — ajout de 'ro' (roumain)
-- -----------------------------------------------------------------------------
-- Whisper peut détecter 'ro' ; l'agent coach écrit sa sortie dans la langue
-- de la réunion. Le frontend stocke la langue via meeting_summaries.language
-- (colonne existante, type language_code).
-- -----------------------------------------------------------------------------

ALTER TYPE language_code ADD VALUE IF NOT EXISTS 'ro';


-- -----------------------------------------------------------------------------
-- Vérification RLS
-- -----------------------------------------------------------------------------
-- Les nouvelles colonnes héritent automatiquement des policies existantes sur
-- leurs tables (reports, meeting_summaries). Aucune policy supplémentaire
-- n'est requise.
--
-- Rappel policies en place :
--   reports            → spa_manager lit/écrit ses propres reports (spa_id scoped)
--   meeting_summaries  → liée à reports via report_id (même scope)
-- -----------------------------------------------------------------------------

-- Contrôle rapide : les colonnes existent bien après migration
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reports' AND column_name = 'snapshot_before_meeting'
  ) THEN
    RAISE EXCEPTION 'MIGRATION FAILED: reports.snapshot_before_meeting manquante';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reports' AND column_name = 'meeting_language'
  ) THEN
    RAISE EXCEPTION 'MIGRATION FAILED: reports.meeting_language manquante';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meeting_summaries' AND column_name = 'ai_output'
  ) THEN
    RAISE EXCEPTION 'MIGRATION FAILED: meeting_summaries.ai_output manquante';
  END IF;

  RAISE NOTICE 'Lot 1 OK — 3 colonnes + enum ro ajoutés';
END;
$$;
