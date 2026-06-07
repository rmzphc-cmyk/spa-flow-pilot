# Prompts Lovable — correctifs Audit 2026-06-07

Prompts prêts à coller dans Lovable, **dans cet ordre**. Chaque prompt = une responsabilité.
Vérifiés contre le code réel de `main` au 2026-06-07.

> ⚠️ **Piège terminologique rôle** (à ne jamais casser) : le guard d'UI (`src/App.tsx`, `AuthContext`)
> utilise `"manager" | "direction" | "admin"`, mais la **colonne DB `role` = `"spa_manager"`**
> (cf. `useDirectionData` qui filtre `.eq("role","spa_manager")`). Garder les deux corrects.
> Le rôle et le `spa_id` viennent **uniquement du JWT** (`app_metadata`), jamais d'un SELECT sur `users`.

---

## 🟥 PROMPT 1 — P0-2 : KPI réels sur l'écran d'entrée Direction

```
Projet SPA OMS (spa-flow-pilot). Stack : React 18 + TS + Vite + shadcn/ui + Tailwind + Supabase + TanStack Query.
NE PAS reconstruire l'UI. NE PAS ajouter d'input (la vue Direction est 100% read-only).

PROBLÈME : sur l'écran d'entrée Direction (/direction → src/pages/DirectionOverview.tsx), les cartes
spa affichent les KPI CA / NPS / Responsabilités en dur à "—". La cause est dans le hook
src/hooks/useDirectionData.ts, fonction useDirectionSpas() : le retour contient
`kpis: { ca: "—", nps: "—", responsabilites: "—" }` (codé en dur). La Direction ne peut donc rien piloter.

BONNE NOUVELLE : la logique de calcul existe DÉJÀ dans le même fichier, fonction useDirectionSpaDetail()
(elle lit kpi_entries.value_current + kpi_definitions(name,unit) et responsibility_logs.completion_rate).

MISSION (uniquement src/hooks/useDirectionData.ts, fonction useDirectionSpas) :
1. Étendre la requête Supabase existante pour récupérer, sur le dernier rapport de chaque spa :
   - kpi_entries(value_current, status, kpi_definitions(name, unit))
   - responsibility_logs(completion_rate)
2. Calculer pour chaque spa :
   - ca = value_current du KPI dont le name contient "CA" ou "chiffre d'affaires" (insensible à la casse), formaté avec l'unité (ex "44000€"), sinon "—".
   - nps = value_current du KPI dont le name contient "NPS", sinon "—".
   - responsabilites = moyenne arrondie des completion_rate en "%" (ex "73%"), sinon "—".
3. Remplacer le `kpis` codé en dur par ces valeurs calculées. Garder "—" UNIQUEMENT quand la donnée est absente.

EN PLUS — badge de période figé (src/pages/DirectionOverview.tsx, ~ligne 146) :
le badge "🔵 Monthly — {t('period.march2026')}" est codé sur mars 2026. Le remplacer par le
cycle_label du rapport le plus récent parmi les spas affichés (fallback : mois courant en toutes lettres).

RÈGLES :
- Ne pas modifier le type SpaOverview au-delà des champs kpis (qui restent des strings).
- Ne pas toucher useDirectionSpaDetail (déjà correct).
- Le rôle DB filtré reste "spa_manager".

RÉSULTAT ATTENDU : les cartes Direction affichent les vrais CA/NPS/Resp par spa, et le badge période est dynamique.
```

---

## 🟥 PROMPT 2 — P0-3 : Démock de l'historique multi-périodes + lien cassé

```
Projet SPA OMS (spa-flow-pilot). Stack : React 18 + TS + Vite + shadcn/ui + Tailwind + Supabase + TanStack Query.
NE PAS reconstruire l'UI riche existante (timeline, graphes recharts, signaux humains, export CSV, side panel).

PROBLÈME : src/pages/SpaHistory.tsx est 100% mock : un objet `spaData` codé en dur (clé slug
"par-gran-canaria") alimente toute la page. De plus le lien de navigation est cassé :
src/components/AppSidebar.tsx (~ligne 61) pointe vers url "/historique" alors que la route (src/App.tsx)
est "/historique/:spa" → clic = page 404.

CONTEXTE : la route /historique est réservée au rôle "manager" (un manager = un seul spa).
Le rôle/spa_id viennent du JWT (app_metadata) via useAuth().

MISSION :
1. Créer un hook src/hooks/useSpaHistory.ts → useSpaHistory(spaId) qui récupère via Supabase tous les
   rapports du spa avec status IN ('validated','post_meeting_generated'), triés par période croissante,
   chacun mappé vers le type HistoryReport déjà défini dans SpaHistory.tsx :
   - period = cycle_label ; type = cycle_type ('monthly'|'weekly') ; status
   - meteoEquipe = checkins.mood_score (stocké /5) ramené sur /10 (×2) ; energieManager = checkins.focus_level idem
   - respCompletion = moyenne arrondie des responsibility_logs.completion_rate
   - summary = meeting_summaries.executive_summary (sinon chaîne vide)
   - kpis = kpi_entries → { label: kpi_definitions.name, unit: kpi_definitions.unit,
            value: value_current, target: (kpi_monthly_targets.target_value si dispo sinon value_n1),
            status }
2. Brancher SpaHistory.tsx sur des données réelles : récupérer le spaId du manager via useAuth()
   (plus de slug mock). Remplacer `spaData[spa]` par le résultat de useSpaHistory(spaId). Conserver
   tout le reste de l'UI et les états (filtres période/cycle, side panel, export CSV) à l'identique.
3. Réparer le lien : route simplifiée en "/historique" (sans :spa) dans src/App.tsx, et url du menu
   dans AppSidebar.tsx → "/historique". SpaHistory lit le spa depuis useAuth, plus depuis useParams.
4. Garder les états vides existants : < 2 rapports → message "l'historique sera disponible dès le 2e rapport".

RÈGLES :
- Aucune réécriture des composants TimelinePoint / SidePanel / graphes : seule la SOURCE de données change.
- Gérer loading (Skeleton) et erreur proprement.

RÉSULTAT ATTENDU : un manager ouvre "Historique" depuis le menu (plus de 404) et voit ses vrais rapports validés.
```

> **Note produit (Polypus)** : Prompt 1 + Prompt 2 = le livrable qui transforme l'outil en produit de pilotage.
> Après-coup, prévoir d'ouvrir l'historique à la Direction aussi (actuellement manager-only) — hors périmètre de ce lot.

---

## 🟧 PROMPT 3 — P0-4 + P1-7 : Internationalisation des écrans non traduits

Le chantier i18n couvre ~25 fichiers / ≥162 littéraux : **trop pour un seul prompt**. On le fait
**écran par écran**, dans l'ordre de priorité ci-dessous, en répétant le template avec le fichier ciblé.

Priorité : `DirectionView.tsx` & `DirectionOverview.tsx` → `AdminOrganization.tsx` (51 littéraux) →
`KpiConfig.tsx` / `RespConfig.tsx` → `Rapports.tsx` (inclut **P1-7** : enums Monthly/Weekly) →
`NotFound.tsx` (404 en anglais) → sections `src/components/rapport/*`.

```
Projet SPA OMS (spa-flow-pilot). i18next est déjà configuré (src/i18n/index.ts + src/i18n/fr.json,
en.json, es.json). Règle projet : AUCUNE chaîne d'UI en dur, tout passe par t().

MISSION (UNIQUEMENT le fichier : <CHEMIN_DU_FICHIER>) :
1. Repérer toutes les chaînes de texte visibles codées en dur (titres, labels, boutons, placeholders,
   messages d'état, toasts) et les remplacer par des appels t("namespace.cle").
2. Ajouter les clés correspondantes dans les 3 fichiers src/i18n/fr.json (texte FR exact actuel),
   en.json (traduction anglaise), es.json (traduction espagnole). Réutiliser une clé existante si elle
   existe déjà (il y a ~132 clés et 434 appels t()).
3. Cas particulier Rapports.tsx (dialog "Nouveau rapport") : les libellés d'enum "Monthly"/"Weekly"
   affichés en dur en anglais doivent passer par t() (ex t("reportType.monthly") = "Mensuel" en FR).

RÈGLES :
- NE PAS toucher la logique ni les autres fichiers. NE PAS renommer de clés existantes.
- Namespaces cohérents avec l'existant (ex "direction.", "admin.", "kpi.", "report.", "common.").
- Garder le formatage (nombres, dates) inchangé.

RÉSULTAT ATTENDU : l'écran ciblé bascule entièrement FR/EN/ES selon la langue choisie, sans littéral en dur.
```

---

## 🟧 PROMPT 4 — P1-3 : Synthèse IA dans la langue du manager

```
Projet SPA OMS (spa-flow-pilot). Edge Function Supabase (Deno) : supabase/functions/generate-meeting-summary/index.ts.

PROBLÈME : la synthèse IA est toujours générée et stockée en français. À la ligne ~201, le champ
`language: "fr"` est codé en dur, le prompt système (~ligne 164) et les instructions de sortie (~ligne 89)
sont en français. Or le produit revendique FR/EN/ES.

MISSION :
1. Accepter un paramètre optionnel `language` dans le body de la requête (valeurs 'fr' | 'en' | 'es',
   défaut 'fr' si absent ou invalide).
2. Adapter le prompt système ET la consigne de sortie pour demander à GPT-4o de rédiger TOUS les
   champs (executive_summary, kpi_synthesis, management_synthesis, ids_synthesis, key_actions)
   dans cette langue. Garder le même schéma JSON et les mêmes clés.
3. Stocker la vraie langue utilisée : `language: <langue choisie>` (ne plus coder "fr" en dur).
4. Adapter aussi le template de secours (buildFallback) pour produire son texte dans la langue demandée
   (au minimum FR/EN/ES via un petit mapping de libellés).
5. Côté front : à l'endroit qui invoke('generate-meeting-summary'), passer language: i18n.language
   (la langue UI courante du manager).

RÈGLES :
- Ne pas changer la logique de fallback ni le format de meeting_summaries.
- Défaut sûr = 'fr' si la langue n'est pas reconnue.

RÉSULTAT ATTENDU : un manager en EN/ES reçoit une synthèse IA dans sa langue ; le champ language reflète la réalité.
```

---

## 🟧 PROMPT 5 — P1-1 : Brancher la clôture de réunion au backend réel

```
Projet SPA OMS (spa-flow-pilot). Stack : React 18 + TS + Supabase Edge Functions + TanStack Query.

PROBLÈME (important) : la page Mode Réunion (src/pages/MeetingMode.tsx) n'est PAS branchée au backend.
La fonction handleClose() (~lignes 159-164) appelle updateReportStatus()/updateReportSection() qui sont
les fonctions du STORE MOCK localStorage (src/lib/reportsStore.ts), et affiche un toast optimiste sans
jamais déclencher d'Edge Function. Résultat : un vrai manager clôture "dans le vide" — le statut DB ne
change pas et la synthèse IA n'est jamais générée. (Confirmé par audit live : seul l'appel direct des
Edge Functions débloque le cycle.)

CONTEXTE BACKEND (déjà déployé, fiable) : la chaîne d'Edge Functions
close-monthly-meeting → generate-meeting-summary (GPT-4o) → validate-final-report fonctionne et est
appelable par le spa_manager du spa. Le report a un id (param :id de la route /reunion/:id).
Les IDS capturés en réunion (variable `issues`) doivent aller dans la table ids_items, pas en localStorage.

MISSION (src/pages/MeetingMode.tsx) :
1. Persister les IDS capturés dans la table Supabase ids_items (report_id = id), au fil de l'eau ou au
   plus tard à la clôture — remplacer les updateReportSection(id,"ids",...) par des écritures Supabase.
2. Réécrire handleClose en mutation TanStack Query qui :
   - invoke('close-monthly-meeting', { body: { report_id: id } }) et ATTEND la réponse,
   - en cas de succès : toast succès + navigate(`/rapport/${id}`),
   - en cas d'erreur : toast destructif avec le message, et NE PAS naviguer (garder le dialog ouvert),
   - état de chargement sur le bouton "Confirmer la clôture" (désactivé + libellé "Clôture en cours…").
3. Supprimer la mise à jour de statut via le store mock (updateReportStatus) : la transition d'état est
   désormais faite côté Edge Function.

RÈGLES :
- Ne pas casser la capture d'IDS en réunion (UX inchangée), seule la persistance change (mock → Supabase).
- Rôle/spa_id depuis le JWT (useAuth), jamais depuis users.
- Conserver le reste de la page (timer, layout, sidebar) tel quel.

RÉSULTAT ATTENDU : "Confirmer la clôture" déclenche réellement la clôture + la synthèse côté backend,
avec gestion d'erreur visible ; plus de toast optimiste mensonger.
```

---

## ⚫ PROMPT 6 — P1-6 : Retirer le bouton "Seed rôles test" exposé en prod

```
Projet SPA OMS (spa-flow-pilot).

PROBLÈME : un bouton de test QA "🧪 Seed rôles test" est exposé en production sur l'écran admin
Config KPI (src/pages/KpiConfig.tsx, bouton ~lignes 291-294, handler seedTestRoleAssignments ~ligne 120).
Un admin réel peut cliquer dessus et injecter des assignations de test.

MISSION (src/pages/KpiConfig.tsx) :
1. Supprimer le bouton "🧪 Seed rôles test" de l'UI.
2. Supprimer la fonction seedTestRoleAssignments() devenue inutile (et ses imports orphelins éventuels).

RÈGLES : ne toucher à rien d'autre dans KpiConfig. Aucune régression sur la config KPI réelle.

RÉSULTAT ATTENDU : plus aucun artefact de seed visible en production sur l'écran Config KPI.
```

---

### Récap ordre d'exécution
1. **Prompt 1 + 2** (P0-2/P0-3) — déblocage produit multi-spa ✅ priorité
2. **Prompt 3** (P0-4/P1-7) — i18n, écran par écran
3. **Prompt 4** (P1-3) — synthèse multilingue
4. **Prompt 5** (P1-1) — clôture branchée backend
5. **Prompt 6** (P1-6) — nettoyage seed

> Rappel SQL (hors Lovable) : appliquer **P1-4** (`AUDIT_SQL_FIXES.md`) en SQL Editor pour finir la sécurité.
