DO $$
DECLARE
  report_ids uuid[];
BEGIN
  SELECT array_agg(id) INTO report_ids FROM public.reports WHERE cycle_type IN ('weekly','monthly');
  IF report_ids IS NOT NULL THEN
    DELETE FROM public.kpi_entries WHERE report_id = ANY(report_ids);
    DELETE FROM public.responsibility_logs WHERE report_id = ANY(report_ids);
    DELETE FROM public.checkins WHERE report_id = ANY(report_ids);
    DELETE FROM public.ids_items WHERE report_id = ANY(report_ids);
    DELETE FROM public.meeting_summaries WHERE report_id = ANY(report_ids);
    UPDATE public.todos SET report_id = NULL WHERE report_id = ANY(report_ids);
    UPDATE public.objectives SET progress_updated_in_report = NULL WHERE progress_updated_in_report = ANY(report_ids);
    DELETE FROM public.objectives WHERE report_id_created = ANY(report_ids);
    DELETE FROM public.notifications WHERE report_id = ANY(report_ids);
    DELETE FROM public.reports WHERE id = ANY(report_ids);
  END IF;
END $$;