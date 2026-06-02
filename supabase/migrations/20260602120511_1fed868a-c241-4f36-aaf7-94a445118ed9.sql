-- Suppression de tous les rapports et données liées, en gardant les configs KPI/responsabilités
DELETE FROM public.meeting_summaries;
DELETE FROM public.checkins;
DELETE FROM public.kpi_entries;
DELETE FROM public.responsibility_logs;
DELETE FROM public.ids_items;
DELETE FROM public.objectives;
DELETE FROM public.todos;
DELETE FROM public.notifications WHERE report_id IS NOT NULL;
DELETE FROM public.reports;