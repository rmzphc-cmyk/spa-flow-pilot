ALTER TABLE reports ADD COLUMN IF NOT EXISTS audio_storage_path TEXT;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS audio_mime_type TEXT;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS audio_duration_s INT;

ALTER TABLE meeting_summaries ADD COLUMN IF NOT EXISTS transcript_text TEXT;
ALTER TABLE meeting_summaries ADD COLUMN IF NOT EXISTS transcript_status TEXT DEFAULT 'none';
ALTER TABLE meeting_summaries ADD COLUMN IF NOT EXISTS transcript_generated_at TIMESTAMPTZ;

ALTER TABLE meeting_summaries DROP CONSTRAINT IF EXISTS meeting_summaries_transcript_status_check;
ALTER TABLE meeting_summaries ADD CONSTRAINT meeting_summaries_transcript_status_check
  CHECK (transcript_status IN ('none', 'pending', 'done', 'error'));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'meeting-recordings', 'meeting-recordings', false, 157286400,
  ARRAY['audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/wav','audio/x-m4a','audio/m4a','audio/mpga']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "spa_manager can upload recordings" ON storage.objects;
CREATE POLICY "spa_manager can upload recordings"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'meeting-recordings');

DROP POLICY IF EXISTS "authenticated can read recordings" ON storage.objects;
CREATE POLICY "authenticated can read recordings"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'meeting-recordings');