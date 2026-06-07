# AUDIT — flow-pilot-complet (core flow business SPA OMS, app LIVE)

Test END-TO-END du parcours métier critique contre https://spa-flow-pilot.lovable.app.
Spa de test : Belhazar Spa by Sanagua (`2c54234f-430e-4dc9-b3a4-ddf316220cb8`).

Parcours : Login spa_manager → contexte spa → MeetingView plein écran → capture IDS →
clôture + synthèse IA (close-monthly-meeting → generate-meeting-summary GPT-4o → validate-final-report) → diffusion + réception Direction.

**VERDICT GLOBAL : le parcours métier critique PASSE de bout en bout.** Aucun maillon de la chaîne backend n'est cassé. Le rapport mensuel est créé, la réunion plein écran (MeetingView) se lance, les IDS sont capturés et persistés, la chaîne IA (close → generate-meeting-summary GPT-4o → validate-final-report) s'exécute, le rapport est validé/diffusé, et la Direction le reçoit (rapport lisible + notification + synthèse consultable).

Un seul accroc : les boutons **Clôturer / Valider** de l'UI MeetingView ne déclenchent pas l'action (statut figé) ; seul l'appel direct des Edge Functions débloque. Le backend est fiable, c'est la couche bouton React qui coince.

---

### [P1] Boutons Clôturer / Valider de la MeetingView ne déclenchent pas l'action (UI figée)

- **Étape** : 5a (Clôture réunion) et 5c (Validation + diffusion).
- **Symptôme (preuve)** : sur 2 parcours complets, après clic UI (normal + dispatchEvent) sur « Clôturer » → « Confirmer la clôture » puis sur « Valider et diffuser », le statut du rapport reste `in_meeting` / `post_meeting_generated`. La transition n'a abouti **que** via appel direct des Edge Functions : `close-monthly-meeting` (687-782ms) et `validate-final-report` (935-1493ms), tous deux `200 OK`. Connu du harnais existant (`closeMeeting.isPending` figé). Mêmes EF appelées par l'UI, donc backend OK — c'est le bouton qui ne fire pas.
- **Impact métier** : un Spa Manager réel n'a pas de fallback Edge Function. S'il est dans ce cas, il ne peut **ni clôturer la réunion ni diffuser le rapport** depuis l'interface → flux bloqué à la dernière marche. Contournable uniquement par un dev. À confirmer côté ergonomie/UI par l'agent dédié (peut être un effet timing du harnais headless, mais reproduit 2/2).
- **Recommandation** : auditer l'état `isPending` des mutations `closeMeeting` / `validateMonthly` dans MeetingView (probable promesse non résolue / état jamais reset bloquant le bouton `disabled`). Ajouter un timeout/reset de sécurité et un toast d'erreur explicite.

### [P3] `key_actions` stocké en JSON stringifié (non-array) dans `meeting_summaries`

- **Étape** : 5b (synthèse IA).
- **Symptôme (preuve)** : `generate-meeting-summary` écrit `key_actions: JSON.stringify(parsed.key_actions ?? [])`. En base la valeur est une **string** `"[\"...\"]"`, pas un array natif Postgres. Le contenu est correct (5 actions GPT-4o réelles, référençant les IDS capturés — ex. « Résoudre le problème de température dans la cabine 3 »).
- **Impact métier** : aucun impact fonctionnel observé (le front re-parse). Risque uniquement si un consommateur (PDF, autre EF) attend un array natif. Non bloquant.
- **Recommandation** : envisager une colonne `jsonb` native pour éviter le double encodage. À laisser tel quel si le front gère le parse partout.

---

## Vérification du maillon le plus fragile (synthèse IA + diffusion)

- **Latence synthèse GPT-4o** : 5.4-6.7s (cold). Acceptable pour une fin de réunion.
- **Contenu non vide** : ✅ executive_summary 875-1010 car, kpi_synthesis ~450-490 car, ids_synthesis ~420-550 car, **5 key_actions** réelles. La synthèse **incorpore les IDS capturés en réunion** (cabine 3, captation accueil week-end) → preuve que la capture IDS alimente bien l'IA.
- **Modèle réel** : ✅ `model_used = gpt-4o` (pas le fallback template — le fallback existe et serait silencieux, à surveiller).
- **Langue manager** : ✅ `language = fr` (hardcodé `"fr"` dans l'EF — OK pour FR, mais ne s'adapterait pas à un manager EN/ES ; hors-scope ici, déjà couvert ailleurs).
- **Diffusion Direction effective** : ✅ rapport `validated` lisible par Karim (RLS direction OK), ✅ notification `synthesis_ready` insérée, ✅ synthèse consultable côté Direction (875 car lus avec le JWT direction).

---

## Tableau récapitulatif — Étape → statut

| # | Étape du parcours | Statut |
|---|-------------------|--------|
| 1 | Login spa_manager (Sophie) | ✅ |
| 2 | Sélection / contexte du spa (spa_id depuis JWT app_metadata) | ✅ |
| — | Création rapport Monthly Mai 2026 + saisie KPI | ✅ |
| 3 | Entrée en mode réunion plein écran (MeetingView, status `in_meeting`) | ✅ |
| 4 | Capture d'items IDS (2 items persistés en DB) | ✅ |
| 5a | Clôture réunion (backend OK ; **boutons UI figés → EF requise**) | ⚠️ |
| 5b | Génération synthèse IA GPT-4o (non vide, fr, model=gpt-4o, intègre les IDS) | ✅ |
| 5c | Validation (backend OK ; **boutons UI figés → EF requise**) | ⚠️ |
| 6 | Diffusion + réception Direction (rapport lisible + notification + synthèse) | ✅ |

**Légende** : ✅ = passe sans rupture · ⚠️ = aboutit côté backend mais le bouton UI ne déclenche pas (fallback Edge Function) · ❌ = cassé/bloquant (aucun).
