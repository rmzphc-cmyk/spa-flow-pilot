# Audit UX & Friction — SPA OMS (Sanagua)

Agent : ux-friction-spa-oms. Périmètre : écrans secondaires, états non-nominaux, i18n, cohérence visuelle.
Méthode : navigation live LECTURE SEULE (3 rôles) + grep code. Screenshots : `tests/audit/screenshots/ux/`.

---

## P0

### [P0] i18n quasi inexistante hors core — 162+ chaînes FR codées en dur
- Écran/état : transverse (toutes pages secondaires + sections rapport)
- Friction : seuls **13 fichiers sur 94** importent `useTranslation`. ~132 clés i18n existent, mais **≥162 littéraux français accentués** (borne basse, hors « Email », « Dashboard »…) sont écrits en dur. Pages **sans aucun `t()`** : `AdminOrganization.tsx`, `KpiConfig.tsx`, `RespConfig.tsx`, `Rapports.tsx`, `RapportDetail.tsx`, `SpaHistory.tsx`, `Objectifs.tsx`, `Todos.tsx`, `DirectionView.tsx`, + composants `rapport/*` (`MeetingView`, `SectionTodo`, `SectionIds`, `SectionObjectifs`, `SectionCloture`, `ReportHeader`, `EmojiScore`, `AutosaveIndicator`…).
  - Preuves : `src/pages/AdminOrganization.tsx:210,213,233,389,586,801,903,977` (toasts + placeholders) ; `src/pages/Rapports.tsx:278,287,313,340,438,453` ; `src/pages/RespConfig.tsx:173,249,275,584,601` ; `src/pages/KpiConfig.tsx:154,209,314,449`.
- Impact : la règle projet (i18next FR/EN/ES, jamais de chaîne en dur) est violée à grande échelle. Un manager en EN/ES voit l'essentiel des écrans secondaires en français → produit non vendable hors FR via Polypus, et UI incohérente (mélange langues, cf. P1 enums).
- Reco : extraire ces littéraux vers `fr/en/es.json` et router via `t()`. Prioriser AdminOrganization (51 chaînes), KpiConfig, RespConfig, sections rapport.

### [P0] Page 404 entièrement en anglais
- Écran/état : route inexistante (NotFound)
- Friction : `« 404 / Oops! Page not found / Return to Home »` codé en dur en anglais. `src/pages/NotFound.tsx` — aucun `t()`. Screenshot : `ux/admin-kpi-config.png` (1er run, route erronée).
- Impact : rupture de langue totale en FR ; lien « Return to Home » pointe « Home » alors que l'app n'a pas de page « accueil » nommée ainsi.
- Reco : traduire + remplacer le lien par « Retour au tableau de bord » selon rôle.

---

## P1

### [P1] Accès refusé silencieux — redirection sans feedback
- Écran/état : permission refusée (manager → page admin)
- Friction : Sophie (spa_manager) ouvre `/admin/organisation` → **redirigée silencieusement vers le Dashboard**, aucun message « accès refusé ». Screenshot : `ux/sophie-admin-denied.png`.
- Impact : si un lien/onglet admin est cliqué par erreur, l'utilisateur perd son contexte sans comprendre pourquoi. Désorientant en réunion.
- Reco : afficher un toast/page « Accès non autorisé » avant redirection, OU masquer totalement les entrées admin pour les non-admins (cf. P2).

### [P1] Bouton « Seed rôles test » exposé en production admin
- Écran/état : `/admin/kpi` (Config KPI), rôle admin
- Friction : un bouton **« Seed rôles test »** (artefact de QA) est visible dans l'UI admin de production. Screenshot : `ux/admin-kpi-config.png`. Code : `src/pages/KpiConfig.tsx:154` (`toast.info("Aucun KPI ne correspond aux mots-clés de test")`).
- Impact : action de test à portée de clic d'un vrai admin → mutation de données accidentelle ; nuit à la crédibilité produit.
- Reco : retirer ou gate derrière un flag dev (`import.meta.env.DEV`).

### [P1] Enums affichés bruts en anglais dans l'UI FR
- Écran/état : dialog « Nouveau rapport » (manager), cartes statut
- Friction : le sélecteur « Type de cycle » affiche **« Monthly » / « Weekly »** en anglais même en mode FR. Screenshot : `ux/sophie-new-report-dialog.png`. Idem badge « Monthly » dans le header global.
- Impact : incohérence de langue visible sur un écran fréquent ; un manager FR voit un terme anglais dans un formulaire critique.
- Reco : mapper les valeurs enum (`weekly`/`monthly`) vers des libellés traduits (« Hebdomadaire »/« Mensuel »).

### [P1] État d'erreur « Spa introuvable » orphelin (sans chrome)
- Écran/état : `/historique/:spa` avec id invalide
- Friction : affiche « Spa introuvable » + bouton, **centré dans une page totalement vide** — pas de header, pas de sidebar. Screenshot : `ux/sophie-historique.png`.
- Impact : ressemble à un crash plutôt qu'à un état géré ; l'utilisateur perd toute navigation et le repère visuel de l'app.
- Reco : rendre l'état d'erreur **dans le layout** (header+sidebar conservés), comme les EmptyState de Rapports.

---

## P2

### [P2] KPI vide rendu comme `""` côté Direction
- Écran/état : `/direction/spa/:id` onglet KPI (rôle direction)
- Friction : une ligne KPI s'affiche avec un nom vide entre guillemets `""` et aucune donnée. Screenshot : `ux/direction-spa-detail.png`.
- Impact : artefact visible côté Direction — donne une impression de bug/donnée corrompue sur l'écran le plus regardé par la hiérarchie.
- Reco : filtrer les KPI sans label, ou afficher un placeholder « — » cohérent.

### [P2] Pluriel non géré : « 1 spas »
- Écran/état : `/direction` (Vue d'ensemble)
- Friction : « 1 spas · Période : … » — pas de gestion singulier/pluriel. Screenshot : `ux/direction-overview.png`.
- Impact : finition perçue comme négligée par la Direction.
- Reco : pluralisation i18next (`count`), résout aussi le problème en EN/ES.

### [P2] Écrans admin KPI & Resp. : « Sélectionner un spa » imposé, sans pré-sélection
- Écran/état : `/admin/kpi` et `/admin/responsabilites` (admin)
- Friction : les deux pages s'ouvrent **vides** tant qu'aucun spa n'est choisi dans un select discret en haut à droite ; aucune guidance, aucun spa pré-sélectionné. Screenshots : `ux/admin-kpi-config.png`, `ux/admin-responsabilites.png`.
- Impact : friction de premier pas — l'admin voit une page « morte » et doit deviner l'action requise.
- Reco : pré-sélectionner le 1er spa (ou le dernier consulté), ou remplacer l'empty-state par une invite explicite (flèche vers le select).

### [P2] Entrées admin visibles dans la sidebar du spa_manager
- Écran/état : sidebar (rôle spa_manager)
- Friction : « Config KPI », « Config Resp. », « Organisation » apparaissent dans la sidebar de Sophie (manager) ; clic → redirection silencieuse (cf. P1). Screenshots : `ux/sophie-todos.png`, `ux/sophie-rapports.png`. Code : `src/components/AppSidebar.tsx:62-64,359` (filtre `/admin/` appliqué selon contexte mais liens visibles côté manager).
- Impact : invite à des clics qui mènent à un cul-de-sac.
- Reco : masquer ces liens si `userRole !== 'admin'`.

---

## P3

### [P3] Messages d'états non-nominaux corrects mais non traduits
- Écran/état : loading/empty/error (Rapports, KpiConfig)
- Friction : les états SONT gérés (loaders `Loader2`, `EmptyState`, messages d'erreur) — bon point — mais textes en dur : `Rapports.tsx:414,417,438,453` (« Chargement… », « Erreur de chargement des rapports. », EmptyState), `KpiConfig.tsx:209,314`.
- Impact : faible (cohérent visuellement), mais relève du P0 i18n.
- Reco : englober dans la passe i18n.

### [P3] Toasts incohérents : « ✓ » en dur dans certains libellés
- Écran/état : RespConfig (admin)
- Friction : `RespConfig.tsx:173,184,373` — « Template modifié ✓ », « Sauvegardé ✓ » ; ailleurs pas de coche. Mélange de conventions de feedback.
- Impact : cosmétique.
- Reco : uniformiser le style des toasts de succès (icône via le composant, pas dans le texte).

---

## Points positifs
- États loading/empty/error globalement présents et propres (EmptyState Rapports, Todos « Aucune action à traiter », loaders).
- Primitives shadcn réutilisées (Dialog, Select, Tabs) — pas de réécriture observée ; dialogs admin propres et accessibles (labels présents).
- Sidebar et UserSettings/DirectionOverview correctement traduits via `t()`.
