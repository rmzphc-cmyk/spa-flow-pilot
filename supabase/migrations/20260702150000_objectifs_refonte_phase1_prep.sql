-- Appliquée MANUELLEMENT en prod le 2026-07-02 via Management API (projet zvitfplilnkhbclgrtru).
-- Refonte Objectifs — préparation Phase 1. Record de traçabilité.

-- Création directe (décision A) : un objectif peut naître hors rapport (page /objectifs).
alter table objectives alter column report_id_created drop not null;

-- Note données (hors schéma) : les 6 objectifs de test legacy (titres bruts d'IDS,
-- target=0, métrique vide) ont été supprimés le 2026-07-02 avec l'accord explicite
-- de Ramzi. La FK ids_items.converted_to_objective_id (ON DELETE SET NULL) a délié
-- les IDS automatiquement. Base repartie à zéro objectif.
