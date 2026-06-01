-- Suppression du rapport mensuel Mai 2026 et de toutes ses données liées
DELETE FROM meeting_summaries WHERE report_id = 'bcf6df43-7254-456c-a0fe-35e29e105847';
DELETE FROM responsibility_logs WHERE report_id = 'bcf6df43-7254-456c-a0fe-35e29e105847';
DELETE FROM kpi_entries WHERE report_id = 'bcf6df43-7254-456c-a0fe-35e29e105847';
DELETE FROM reports WHERE id = 'bcf6df43-7254-456c-a0fe-35e29e105847';