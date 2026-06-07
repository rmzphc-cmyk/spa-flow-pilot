# AUDIT SPA OMS — Rapport consolidé

**Date :** 2026-06-07 · **Cible :** app live https://spa-flow-pilot.lovable.app · **Org/spa de test :** Sanagua / Belhazar Spa
**Méthode :** 5 sous-agents en parallèle, partition de scope étanche. 1 agent mutant (core flow), 4 en lecture seule/probes. Findings détaillés dans les fichiers `AUDIT_FINDINGS_<agent>.md`.

---

## Verdict global

> **Le produit FONCTIONNE en mono-spa : le core flow réunion → IDS → synthèse IA → diffusion passe de bout en bout, et les règles métier sont justes.**
> **Le produit n'est PAS prêt en multi-spa : la couche Direction est à la fois une faille de sécurité (fuite cross-client) et une coquille non branchée — c'est précisément le périmètre qui conditionne la commercialisation (Polypus).**

| Sévérité | Nb | Nature dominante |
|---|---|---|
| 🔴 **P0** | 4 | 1 sécurité multi-tenant + 2 produit Direction + 1 i18n |
| 🟠 **P1** | 8 | UI/flux, agrégation, sécurité latente |
| 🟡 **P2** | 6 | robustesse, dette, valeur produit |
| ⚫ **P3** | 3 | cosmétique / dette inerte |

**Couverture :** core flow E2E (live, 2 runs) · règles métier (code + données live) · matrice permissions 3 rôles confirmée par probe sous JWT · friction UX écrans secondaires + i18n · pertinence produit par persona.

---

## Le cluster prioritaire : la couche MULTI-SPA / DIRECTION

Trois findings indépendants pointent le même endroit — c'est **le** chantier n°1, car il cumule risque sécurité, trou fonctionnel et blocage commercial :

1. 🔴 **Fuite de données cross-client** (sécurité) — un `direction` lit les cibles KPI de tous les spas du SaaS.
2. 🔴 **Vue Direction consolidée inexistante** (produit) — KPI codés en dur à "—", aucun pilotage réseau possible.
3. 🔴 **Historique multi-périodes 100% mock** (produit) — composant construit mais non branché, lien cassé.

➡️ **Lever ce cluster = sécuriser le multi-tenant ET débloquer le seul livrable qui transforme l'outil en produit de pilotage vendable.** ROI élevé : surtout du branchement/scoping, peu de build neuf.

---

## 🔴 P0 — Bloquants

### P0-1 · [SÉCURITÉ — IMMÉDIAT] Fuite cross-spa/cross-org de `kpi_monthly_targets`
*Source : permissions-rls (confirmé par probe live sous JWT direction).*
La policy `direction_read_targets = USING(role='direction')` n'a **aucun scoping de spa**. Preuve : Karim (direction Belhazar) lit en live les 25 cibles KPI mensuelles de *Paradisus Lanzarote* — **autre destination, autre client**. Un `direction` voit les chiffres business de tout le SaaS.
**Impact :** violation d'isolation multi-tenant — rédhibitoire pour la commercialisation.
**Correctif :** scoper la policy via `direction_spa_access` / `user_can_access_spa`. **Policy hors `migrations/` → à appliquer manuellement en SQL Editor.**

### P0-2 · [PRODUIT] Aucune vue Direction consolidée multi-spas
*Source : pertinence-ope.*
`/direction` = liste de cartes mono-période ; les KPI de carte (CA/NPS/Resp) sont codés en dur à "—" (`useDirectionData.ts:102`). La Direction ne peut pas piloter le réseau.
**Correctif :** brancher les KPI consolidés réels (fetch existe au niveau `DirectionSpaDetail`).

### P0-3 · [PRODUIT] Historique / comparaison de périodes 100% mock
*Source : pertinence-ope.*
`SpaHistory` entièrement sur données mock + lien de navigation cassé (`/historique` vs route `/historique/:spa`). Composant construit, seul le fetch manque.
**Correctif :** démocker (brancher Supabase) + corriger la route.

### P0-4 · [I18N] Internationalisation quasi inexistante hors core
*Source : ux-friction.*
Seuls **13 fichiers /94** utilisent `t()`. **≥162 littéraux FR codés en dur sur ~25 fichiers** (AdminOrganization, KpiConfig, Rapports, DirectionView, sections rapport…). Page 404 entièrement en anglais.
**Impact :** la promesse i18next FR/EN/ES est violée à grande échelle → bloque tout déploiement resort international.
**Correctif :** chantier d'extraction i18n, prioriser les écrans Direction + admin.

---

## 🟠 P1 — Impact fort

| # | Finding | Source | Preuve / Correctif |
|---|---|---|---|
| P1-1 | **Boutons Clôturer/Valider de MeetingView ne déclenchent rien** (figé 2/2) — seul l'appel direct des EF débloque ; un manager réel est bloqué | flow-pilot (+ recoupe overlay) | Transition d'état pilotée UI ; vérifier handler/overlay |
| P1-2 | **Agrégation IDS mensuelle perd les semaines à cheval** sur le changement de mois (filtre `period_start` seul) — ~12 semaines-charnières/an d'IDS absents de la synthèse Direction | qa-metier | `useIdsItems.ts:318-322` — filtrer sur le chevauchement |
| P1-3 | **Synthèse IA non multilingue** : langue forcée `"fr"` malgré i18n FR/EN/ES | pertinence-ope | `generate-meeting-summary` ~ligne 201 — passer la langue du manager |
| P1-4 | **Bucket `meeting-recordings` lisible/écrivable par tout authentifié** (latent : bucket vide) | permissions-rls | Policies `USING(bucket_id=…)` sans scoping → scoper par spa |
| P1-5 | **Accès refusé silencieux** : manager redirigé sans message en ouvrant une page admin | ux-friction | Ajouter feedback explicite |
| P1-6 | **Bouton « Seed rôles test » (artefact QA) exposé en prod** sur l'écran admin Config KPI | ux-friction | Retirer / gater hors prod |
| P1-7 | **Enums « Monthly/Weekly » affichés en anglais** dans le dialog « Nouveau rapport » en mode FR | ux-friction | Mapper via `t()` |
| P1-8 | **État « Spa introuvable » orphelin** (sans header/sidebar) — ressemble à un crash | ux-friction | Rendre dans le layout normal |

---

## 🟡 P2 — Robustesse, dette & valeur

| # | Finding | Source |
|---|---|---|
| P2-1 | Aucun garde-fou logiciel « Monthly = mois précédent » ; le dropdown propose le mois courant (`Rapports.tsx:193-208`) — conformité = discipline d'usage | qa-metier |
| P2-2 | Double source de vérité : helpers RLS (`current_user_role/spa_id`) lisent `public.users`, les EF lisent `app_metadata` (JWT). Pas d'escalade exploitée, mais incohérent | permissions-rls |
| P2-3 | Synthèse IA sous-exploitée : l'EF produit 5 livrables, l'app n'en affiche que 2 (executive + key_actions) ; KPI/management/IDS_synthesis jetés. Le fallback template porte le **même AiBadge** qu'une vraie analyse → confiance erronée | pertinence-ope |
| P2-4 | IDS/objectifs sans continuité inter-réunions (saisie sans redevabilité dans la durée) | pertinence-ope |
| P2-5 | Diffusion = ping générique non scopé : envoyé à tous les directeurs, sans nom de spa ni alerte, in-app seul, sans relance | pertinence-ope |
| P2-6 | Divers polish : KPI vide rendu `""` côté Direction · « 1 spas » (pluriel) · empty-states admin KPI/Resp non guidés · liens admin visibles dans la sidebar manager | ux-friction |

---

## ⚫ P3 — Mineur / dette inerte

| # | Finding | Source |
|---|---|---|
| P3-1 | `key_actions` stocké en JSON stringifié (string au lieu d'array natif) — contenu correct, aucun impact observé | flow-pilot |
| P3-2 | Code mort `computePeriod/computeEndFromStart/defaultLabel` (`Rapports.tsx:116-152`) portant l'ancienne règle « mois courant » — inerte mais piège | qa-metier |
| P3-3 | EF `structure-voice-note` : authn sans authz métier (coût OpenAI, pas d'isolation données) | permissions-rls |

---

## Vérifiés CONFORMES (pas de bruit)

- Isolation inter-spa globalement correcte (reports, kpi_entries, ids_items, todos, responsibility_templates, meeting_summaries renvoient `[]` cross-spa).
- **Aucune escalade de privilège** : toutes écritures hors-rôle refusées (403/42501).
- Enum triage `bloquant|priorite|deleguer|veille|NULL` + couleurs/icônes/tri conformes ; règle N/A KPI correcte ; matrice rôles×niveaux complète en code.
- Core flow backend fiable (EF chain), synthèse IA réelle (GPT-4o, latence 5-7s, référence les IDS de la réunion), diffusion Direction effective.

---

## Plan d'action recommandé

**Cette semaine — sécurité d'abord :**
1. **P0-1** : appliquer le scoping SQL sur `kpi_monthly_targets` en SQL Editor (fuite cross-client active).
2. **P1-4** : scoper le bucket `meeting-recordings` avant qu'il se remplisse.

**Sprint produit (déblocage commercial / Polypus) :**
3. **P0-2 + P0-3** : brancher la vue Direction consolidée + démocker SpaHistory → l'outil devient un produit de pilotage. *Surtout du câblage.*
4. **P1-1** : réparer les boutons Clôture/Validation MeetingView (sinon le flux casse pour un vrai manager).
5. **P1-2** : corriger l'agrégation IDS sur les semaines-charnières.

**Chantier i18n (déploiement international) :**
6. **P0-4 + P1-3 + P1-7** : extraction i18n des écrans Direction/admin + langue de la synthèse IA.

**Nettoyage :** P1-6 (bouton seed prod), P2/P3 en finition.

> **Réflexe Polypus :** le ROI commercial est concentré sur le cluster multi-spa (P0-1/2/3). Sécuriser + brancher cette couche est ce qui distingue un classeur de rapports d'un SaaS de pilotage multi-tenant vendable. La méthode d'audit elle-même (5 agents parallèles à scope partitionné) est réutilisable et packageable.
