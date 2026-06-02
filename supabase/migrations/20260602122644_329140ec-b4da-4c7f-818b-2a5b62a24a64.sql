
DO $$
DECLARE
  v_spa uuid := '11111111-1111-1111-1111-111111111111';
  v_mgr uuid := '22222222-2222-2222-2222-222222222222';
  r19 uuid := 'aaaa0019-0000-4000-8000-000000000019';
  r20 uuid := 'aaaa0020-0000-4000-8000-000000000020';
  r21 uuid := 'aaaa0021-0000-4000-8000-000000000021';
  obj1 uuid := 'bbbb0001-0000-4000-8000-000000000001';
  obj2 uuid := 'bbbb0002-0000-4000-8000-000000000002';
  obj3 uuid := 'bbbb0003-0000-4000-8000-000000000003';
  ids19 uuid := 'cccc0019-0000-4000-8000-000000000019';
  ids20 uuid := 'cccc0020-0000-4000-8000-000000000020';
  ids21 uuid := 'cccc0021-0000-4000-8000-000000000021';
  t19a uuid := 'dddd1900-0000-4000-8000-00000000001a';
  t19b uuid := 'dddd1900-0000-4000-8000-00000000001b';
  t19c uuid := 'dddd1900-0000-4000-8000-00000000001c';
  t19d uuid := 'dddd1900-0000-4000-8000-00000000001d';
  t20a uuid := 'dddd2000-0000-4000-8000-00000000002a';
  t20b uuid := 'dddd2000-0000-4000-8000-00000000002b';
  t20c uuid := 'dddd2000-0000-4000-8000-00000000002c';
  t21a uuid := 'dddd2100-0000-4000-8000-00000000003a';
  t21b uuid := 'dddd2100-0000-4000-8000-00000000003b';
BEGIN

INSERT INTO reports (id, spa_id, manager_id, cycle_type, cycle_label, period_start, period_end, status, is_locked, validated_by, validated_at, created_at, updated_at) VALUES
(r19, v_spa, v_mgr, 'weekly', 'S19 - 2026', '2026-05-04', '2026-05-10', 'validated', true, v_mgr, '2026-05-10 18:00+00', '2026-05-04 08:00+00', '2026-05-10 18:00+00'),
(r20, v_spa, v_mgr, 'weekly', 'S20 - 2026', '2026-05-11', '2026-05-17', 'validated', true, v_mgr, '2026-05-17 18:00+00', '2026-05-11 08:00+00', '2026-05-17 18:00+00'),
(r21, v_spa, v_mgr, 'weekly', 'S21 - 2026', '2026-05-18', '2026-05-24', 'draft_preparation', false, NULL, NULL, '2026-05-18 08:00+00', '2026-05-22 14:00+00');

INSERT INTO checkins (report_id, mood_score, focus_level, key_context, created_at, updated_at) VALUES
(r19, 4, 4, 'Reprise sereine après pont du 1er mai. Équipe motivée, planning stable.', '2026-05-04 08:30+00', '2026-05-04 08:30+00'),
(r20, 5, 4, 'Semaine intense avec week-end Ascension : forte affluence hôtel, équipe sollicitée mais soudée.', '2026-05-11 08:30+00', '2026-05-11 08:30+00'),
(r21, 4, 4, 'Stabilisation après le pic. Focus sur la mise en place du programme fidélité.', '2026-05-18 08:30+00', '2026-05-18 08:30+00');

INSERT INTO kpi_entries (report_id, kpi_definition_id, value_current, target_value, status, comment, comment_is_validated) VALUES
(r19, 'b1aa0001-0000-4000-0000-000000000001', 4200, 4500, 'amber', 'Démarrage prudent post-pont, mais bonne tenue weekend.', true),
(r19, 'b1aa0001-0000-4000-0000-000000000002', 4, 5, 'amber', 'Légèrement sous cible, prochain push commercial mercredi.', true),
(r19, 'b1aa0001-0000-4000-0000-000000000003', 620, 750, 'red', 'Retail faible : déclenche objectif mensuel push produits Sothys.', true),
(r19, 'b1aa0001-0000-4000-0000-000000000004', 78, 80, 'amber', 'Hôtel quasi-cible, bonne base pour S20.', true),
(r19, 'b1aa0001-0000-4000-0000-000000000006', 82, 85, 'amber', 'Panier moyen correct, marge sur upsell soins additionnels.', true),
(r19, 'b1aa0001-0000-4000-0000-000000000007', 88, 95, 'amber', 'Sous-occupation lundi/mardi, créneaux à booster.', true),
(r19, 'b1aa0001-0000-4000-0000-000000000008', 92, 90, 'excellent', 'Équipe au complet sauf demi-journée Léa (RDV médical).', true),
(r19, '0e9481b7-bbb1-4231-9aea-b1547a438dbe', 4.8, 4.7, 'excellent', '12 avis collectés, ton très positif sur accueil.', true),
(r19, '0d508e06-93bd-4449-ba64-9db156a628d1', 16, 18, 'red', 'Captation en retrait, à corriger via briefing concierge.', true),
(r19, 'ddfcc79a-abf0-43d2-9e8c-09991afdbaab', 4, 4, 'excellent', '4 avis Google cette semaine, dont 3 cinq étoiles.', true),
(r19, 'bbe0d21c-aab8-4556-9edd-b45dcbcf0212', 11, 12, 'amber', 'Reebooking à ré-ancrer en fin de soin.', true),
(r19, 'e4a5db47-0256-4c70-8770-5958b53a060c', 87, 90, 'amber', 'Productivité correcte, marge sur cabines 2 et 5.', true);

INSERT INTO kpi_entries (report_id, kpi_definition_id, value_current, target_value, status, comment, comment_is_validated) VALUES
(r20, 'b1aa0001-0000-4000-0000-000000000001', 5100, 4500, 'excellent', 'Excellent boost grâce au week-end Ascension.', true),
(r20, 'b1aa0001-0000-4000-0000-000000000002', 6, 5, 'excellent', 'Push commercial soins duo bien performé.', true),
(r20, 'b1aa0001-0000-4000-0000-000000000003', 890, 750, 'excellent', 'Retail x1.4 vs S19 : effet briefing équipe Sothys immédiat.', true),
(r20, 'b1aa0001-0000-4000-0000-000000000004', 88, 80, 'excellent', 'Hôtel quasi-plein sur week-end férié.', true),
(r20, 'b1aa0001-0000-4000-0000-000000000006', 87, 85, 'green', 'Panier moyen au-dessus de la cible.', true),
(r20, 'b1aa0001-0000-4000-0000-000000000007', 92, 95, 'amber', 'Équipe à 92%, presque saturée — vigilance fatigue.', true),
(r20, 'b1aa0001-0000-4000-0000-000000000008', 88, 90, 'amber', 'Sofia 1 jour absente (gastro), reste OK.', true),
(r20, '0e9481b7-bbb1-4231-9aea-b1547a438dbe', 4.75, 4.7, 'green', '18 avis, qualité maintenue malgré l''affluence.', true),
(r20, '0d508e06-93bd-4449-ba64-9db156a628d1', 19, 18, 'green', 'Captation au-dessus cible : protocole walk-in commence à payer.', true),
(r20, 'ddfcc79a-abf0-43d2-9e8c-09991afdbaab', 6, 4, 'excellent', '6 avis Google cette semaine, top mois.', true),
(r20, 'bbe0d21c-aab8-4556-9edd-b45dcbcf0212', 12, 12, 'green', 'Pile sur cible, à confirmer.', true),
(r20, 'e4a5db47-0256-4c70-8770-5958b53a060c', 95, 90, 'excellent', 'Productivité au top grâce affluence.', true);

INSERT INTO kpi_entries (report_id, kpi_definition_id, value_current, target_value, status, comment, comment_is_validated) VALUES
(r21, 'b1aa0001-0000-4000-0000-000000000001', 4800, 4500, 'green', 'Belle semaine, retour à un rythme stable.', false),
(r21, 'b1aa0001-0000-4000-0000-000000000003', 950, 750, 'excellent', 'Retail confirme la tendance — objectif mensuel en très bonne voie.', false),
(r21, 'b1aa0001-0000-4000-0000-000000000006', 86, 85, 'green', NULL, false),
(r21, '0e9481b7-bbb1-4231-9aea-b1547a438dbe', 4.85, 4.7, 'excellent', 'Très bons retours sur nouvelle équipe accueil.', false),
(r21, 'ddfcc79a-abf0-43d2-9e8c-09991afdbaab', 5, 4, 'excellent', NULL, false),
(r21, 'b1aa0001-0000-4000-0000-000000000007', 90, 95, 'amber', NULL, false),
(r21, 'bbe0d21c-aab8-4556-9edd-b45dcbcf0212', 11, 12, 'amber', 'Toujours en retrait — ouverture IDS rituel fin de soin.', false);

INSERT INTO responsibility_logs (responsibility_template_id, report_id, actual_count, completion_rate, comment) VALUES
('b2aa0001-0000-4000-0000-000000000001', r19, 7, 100, 'Daily offer affichée chaque matin, pool marketing OK.'),
('b2aa0001-0000-4000-0000-000000000002', r19, 1, 100, 'Planning S20 publié vendredi, équipe alignée.'),
('b2aa0001-0000-4000-0000-000000000004', r19, 1, 100, 'Inventaire huiles fait, commande à passer S20.'),
('b2aa0001-0000-4000-0000-000000000005', r19, 1, 100, 'Analyse hebdo : retail à pousser, captation à corriger.'),
('b2aa0001-0000-4000-0000-000000000001', r20, 6, 86, 'Manqué jeudi férié — affichage statique conservé.'),
('b2aa0001-0000-4000-0000-000000000002', r20, 1, 100, 'Planning S21 ajusté pour récup post-Ascension.'),
('b2aa0001-0000-4000-0000-000000000004', r20, 0, 0, 'Pas pu — semaine trop dense. Reporté S21.'),
('b2aa0001-0000-4000-0000-000000000005', r20, 1, 100, 'Analyse menée mardi : retail confirme tendance.'),
('b2aa0001-0000-4000-0000-000000000001', r21, 4, 57, 'En cours — 4 jours sur 7 affichés à date.'),
('b2aa0001-0000-4000-0000-000000000002', r21, 1, 100, 'Planning S22 déjà préparé.'),
('b2aa0001-0000-4000-0000-000000000004', r21, 1, 100, 'Commande huiles passée lundi — rattrapage S20.'),
('b2aa0001-0000-4000-0000-000000000005', r21, NULL, 0, NULL);

INSERT INTO objectives (id, spa_id, report_id_created, created_by, title, description, target_date, status, source, progress_note, progress_updated_in_report, created_at) VALUES
(obj1, v_spa, r19, v_mgr,
 'Booster le retail de +15% sur mai',
 'Push produits soins corps Sothys avec formation équipe et mise en avant cabine + accueil. Cible 3 450 € sur le mois (vs 3 000 € avril).',
 '2026-05-31', 'active', 'manual',
 'S20 : Retail x1.4 vs S19 (890€ vs 620€). S21 confirme à 950€. Cumul mois sur la trajectoire.',
 r21, '2026-05-04 09:00+00'),
(obj2, v_spa, r19, v_mgr,
 'Atteindre 20% de captation globale hôtel',
 'Renforcer la conversion hôtel→spa via briefing quotidien du concierge et flyer accueil chambre.',
 '2026-05-31', 'active', 'manual',
 'S20 : 19% atteint grâce au protocole walk-in. À consolider via réunion concierge faite en S21.',
 r20, '2026-05-04 09:15+00'),
(obj3, v_spa, r19, v_mgr,
 'Lancer le programme fidélité Sanagua Privilege',
 'Carte 5 soins = 1 offert. Déploiement complet (caisse, supports, formation équipe) avant fin mai.',
 '2026-05-31', 'active', 'manual',
 'Supports imprimés reçus S21, paramétrage caisse en cours.',
 r21, '2026-05-04 09:30+00');

-- 1) Insère les IDS d'abord SANS converted_to_todo_id (pour résoudre la FK circulaire)
INSERT INTO ids_items (id, report_id, spa_id, cycle_type, capture_text, problem_statement, root_cause, proposed_solution, status, created_by, display_order, captured_at) VALUES
(ids19, r19, v_spa, 'weekly',
 'Cabine 3 climatisation bruyante depuis vendredi — gêne perçue par 2 clientes.',
 'Bruit de climatisation perturbe les soins en cabine 3.',
 'Compresseur en fin de vie, dernier entretien il y a 14 mois.',
 'Appeler le technicien dès lundi matin pour diagnostic et devis.',
 'structured', v_mgr, 0, '2026-05-06 11:00+00'),
(ids20, r20, v_spa, 'weekly',
 'Manque protocole accueil pour clients hôtel arrivant sans réservation spa (walk-in).',
 'Walk-in hôtel mal gérés : perte de captation et expérience client dégradée.',
 'Aucun script ni flyer dédié, concierge improvise au cas par cas.',
 'Créer un flyer + script court côté concierge, briefing 5 min équipe accueil.',
 'structured', v_mgr, 0, '2026-05-13 10:30+00'),
(ids21, r21, v_spa, 'weekly',
 'Reebooking stagnant à 11% alors que cible 12% — équipe ne propose pas systématiquement le prochain RDV en fin de soin.',
 'Taux de reebooking sous la cible depuis 3 semaines.',
 'Absence de rituel formalisé en fin de soin pour proposer la prochaine séance.',
 'Former l''équipe à un rituel court de proposition + outil de prise immédiate.',
 'structured', v_mgr, 0, '2026-05-20 16:00+00');

-- 2) Insère les todos (ids_item_id pointe vers ids déjà insérés)
INSERT INTO todos (id, spa_id, report_id, ids_item_id, source, title, description, priority, status, due_date, completed_at, deferred_from_date, deferred_count, assigned_to, created_by, created_at) VALUES
(t19a, v_spa, r19, ids19, 'ids_conversion',
 'Appeler le technicien clim pour cabine 3',
 'Diagnostic urgent + devis sous 48h.',
 'high', 'done', '2026-05-07', '2026-05-07 14:00+00', NULL, 0, v_mgr, v_mgr, '2026-05-06 11:30+00'),
(t19b, v_spa, r19, NULL, 'manual',
 'Briefer l''équipe sur le push retail Sothys',
 'Présentation des 3 produits prioritaires + argumentaires en réunion lundi.',
 'medium', 'done', '2026-05-05', '2026-05-05 09:30+00', NULL, 0, v_mgr, v_mgr, '2026-05-04 09:00+00'),
(t19c, v_spa, r19, NULL, 'manual',
 'Préparer trame formation vente additionnelle',
 'Construire un support de formation 30 min sur l''upsell soins additionnels et retail.',
 'medium', 'deferred', '2026-05-22', NULL, '2026-05-15', 2, v_mgr, v_mgr, '2026-05-04 10:00+00'),
(t19d, v_spa, r19, NULL, 'manual',
 'Auditer le stock huiles essentielles avant commande',
 'Inventaire complet et passer commande fournisseur.',
 'medium', 'done', '2026-05-12', '2026-05-12 16:00+00', NULL, 0, v_mgr, v_mgr, '2026-05-04 10:15+00'),
(t20a, v_spa, r20, ids20, 'ids_conversion',
 'Créer protocole accueil walk-in hôtel',
 'Flyer + script concierge + briefing équipe accueil.',
 'high', 'done', '2026-05-16', '2026-05-15 17:00+00', NULL, 0, v_mgr, v_mgr, '2026-05-13 11:00+00'),
(t20b, v_spa, r20, NULL, 'manual',
 'Réunion mi-mois avec concierge hôtel',
 'Point captation + retours sur protocole walk-in.',
 'medium', 'done', '2026-05-19', '2026-05-19 11:00+00', NULL, 0, v_mgr, v_mgr, '2026-05-12 09:00+00'),
(t20c, v_spa, r20, NULL, 'manual',
 'Commander présentoirs retail accueil',
 'Devis fournisseur validé, à commander pour livraison fin de mois.',
 'low', 'pending', '2026-05-25', NULL, NULL, 0, v_mgr, v_mgr, '2026-05-14 14:00+00'),
(t21a, v_spa, r21, NULL, 'manual',
 'Paramétrer la carte Sanagua Privilege côté caisse',
 'Création de l''article carte + procédure de tamponnage. Lié à l''objectif Privilège.',
 'high', 'pending', '2026-05-28', NULL, NULL, 0, v_mgr, v_mgr, '2026-05-19 10:00+00'),
(t21b, v_spa, r21, ids21, 'ids_conversion',
 'Former l''équipe au rituel de fin de soin',
 'Script de proposition prochain RDV + outil de prise immédiate.',
 'high', 'pending', '2026-05-31', NULL, NULL, 0, v_mgr, v_mgr, '2026-05-20 16:30+00');

-- 3) Met à jour les IDS avec la conversion (FK satisfaite maintenant que les todos existent)
UPDATE ids_items SET converted_to_todo_id = t19a, status = 'converted', resolution_type = 'todo_created', resolution_notes = 'Converti en to-do prioritaire — résolu en S19.' WHERE id = ids19;
UPDATE ids_items SET converted_to_todo_id = t20a, status = 'converted', resolution_type = 'todo_created', resolution_notes = 'Protocole créé et déployé en S20.' WHERE id = ids20;
UPDATE ids_items SET converted_to_todo_id = t21b, status = 'converted', resolution_type = 'todo_created', resolution_notes = 'Converti en to-do formation équipe.' WHERE id = ids21;

END $$;
