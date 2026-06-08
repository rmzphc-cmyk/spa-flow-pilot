# AUDIT FINDINGS — Suivi P2 (2026-06-08)

Audit ciblé sur les 4 items P2 identifiés à l'issue du cycle de correctifs P0/P1 (clôturé le 2026-06-08) : synthèse IA sous-exploitée, continuité IDS sur changement de mois, double source de vérité RLS, écran orphelin DirectionView.tsx.

**⚠️ Reclassement majeur** : l'item "double source de vérité RLS", supposé P2, s'avère être une **vraie escalade de privilège confirmée en live (P1)** — priorité de correctif n°1 de ce lot.

---

## 🔴 [P1] Auto-attribution de `organization_id` via `public.users` → contournement de `orgs_select_member`

**Rôle & ressource** : `spa_manager` (Sophie Marchand) → tables `users`, `organizations`/`destinations`.

**Comportement réel observé (preuve probe live)** :
- `current_user_role()` / `current_user_spa_id()`, `AuthContext.tsx`, `_shared/auth.ts` : ✅ sains, lisent uniquement le JWT `app_metadata`.
- MAIS les policies `orgs_select_member` / `dest_select_member` (migration `20260603133508…`) et le trigger `sync_direction_spa_access` font confiance à `public.users.organization_id` / `.destination_id` / `.role` directement (`JOIN public.users u ON u.id = auth.uid()`), pas au JWT.
- Probe PATCH `users?id=eq.<sophie_id>` :
  - `role: 'admin'` → 403 (bloqué) ✅
  - `spa_id: <autre>` → 403 (bloqué) ✅
  - `organization_id: <id réel "Sanagua">` → **200 OK** ❌ → débloque ensuite `SELECT organizations` (lecture cross-org non autorisée)
  - Revert effectué immédiatement, aucune donnée résiduelle.

**Risque** : un `spa_manager` peut s'auto-assigner n'importe quel `organization_id`/`destination_id` et lire des structures hors de son périmètre métier, et potentiellement biaiser le trigger `sync_direction_spa_access`. Le JWT reste sain, mais `public.users` devient une source de vérité parallèle manipulable par l'utilisateur lui-même.

**Correctif proposé** :
1. Réécrire `orgs_select_member`/`dest_select_member` pour s'appuyer sur `current_user_role()`/`current_user_spa_id()` (JWT) + jointure via `spas`, pas sur les colonnes auto-déclarées `users.organization_id`/`destination_id`.
2. Verrouiller `users_update_own` avec un `WITH CHECK` (ou trigger `BEFORE UPDATE`) interdisant à un non-admin de modifier `role`, `spa_id`, `organization_id`, `destination_id`, `manager_id`.
3. Auditer `sync_direction_spa_access()` pour confirmer qu'elle ne peut pas être déclenchée/biaisée par une auto-modification de ces colonnes.

**Hors périmètre / sain confirmé** : `admin-manage-user` (chemin admin/service_role, resynchronise `app_metadata`) ; lectures `public.users` dans `useDirectionData.ts`/`useAdminOrganization.ts` pour affichage seul (noms/emails), sans décision d'autorisation — résidus inoffensifs.

---

## 🟠 [P2] Synthèse IA — 3 livrables sur 5 générés et stockés mais jamais affichés à la Direction

**Persona concerné** : Direction (consommateur final), Spa Manager (génère la synthèse en réunion).

**Écart observé** : `generate-meeting-summary/index.ts` génère et persiste 5 champs dans `meeting_summaries` (`executive_summary`, `kpi_synthesis`, `management_synthesis`, `ids_synthesis`, `key_actions`, exposés via `useMeetingSummary.ts`). Le front (`PostMeetingMode.tsx:127-145`, `MeetingView.tsx:193-206`) n'affiche que **2 sur 5** : `executive_summary` et `key_actions`.

`kpi_synthesis`, `management_synthesis`, `ids_synthesis` sont générés par GPT-4o, payés en tokens, stockés… et invisibles — alors qu'ils sont précisément les angles de lecture rapide ("où sont les points rouges", "quels problèmes restent ouverts") qu'une Direction multi-spa recherche.

**Conséquence** : coût IA partiellement gaspillé (≈3/5 du contenu facturé sans valeur visible) ; perte de valeur Direction ; incohérence produit (le hook expose ces champs comme s'ils étaient utilisés).

**Recommandation** :
- **Option A (retenue, faible effort)** : afficher `kpi_synthesis`, `management_synthesis`, `ids_synthesis` dans `PostMeetingMode.tsx` et/ou `DirectionSpaDetail.tsx` — la donnée existe déjà, c'est un ajout de rendu pur (pas de risque sur la logique).
- Option B (si jugés redondants après test de A) : retirer ces clés du prompt/fallback pour ne plus payer leur génération.
- **Levier Polypus** : packager une "synthèse multi-niveaux" (executive / KPI / management / problèmes) est un argument différenciant pour du reporting managérial commercialisable.

---

## ⚪ [P3] Continuité IDS sur changement de mois — pas un bug, agrégation lecture seule mal nommée "preview"

**Constat (`useIdsItems.ts:307-356`, fonction `useIdsItemsForMonthlyPeriod`)** : agrégation **en lecture seule** des `ids_items` des rapports weekly du mois cible (filtrage par `period_start`/`period_end`), sans aucune écriture (`update`/`insert`/`delete`). Le `triage_mode` est posé une fois (`useUpdateIdsTriage`) sur le rapport weekly d'origine et reste persistant — ni réinitialisé, ni dupliqué, ni déplacé d'un mois à l'autre.

**Conclusion** : aucune perte, doublon ou report artificiel. Comportement correct — le rapport mensuel est une synthèse en lecture seule de la période, pas un mécanisme de suivi cross-période.

**Suggestion produit (hors bug)** : ajouter une vue/filtre transverse listant les `ids_items` `bloquant`/`priorite`/`deleguer` non convertis (`converted_to_todo_id IS NULL AND converted_to_objective_id IS NULL`), indépendamment de la période, pour une visibilité de suivi cross-mois — amélioration fonctionnelle, pas correctif.

---

## ⚪ [P3] Écran orphelin `DirectionView.tsx` — code mort accessible par URL directe, doublon de `DirectionSpaDetail.tsx`

**Écart observé** : la route `/direction/:id` (`App.tsx:14, 97`) pointe toujours vers `DirectionView.tsx`, en plus de `/direction` (`DirectionOverview`) et `/direction/spa/:id` (`DirectionSpaDetail`). **Aucun lien/`navigate()` actif** ne pointe vers `/direction/:id` (recherche exhaustive `grep -rn "/direction/"` — seules `AppSidebar.tsx`, `DirectionOverview.tsx`, `DirectionSpaDetail.tsx` naviguent, vers les deux autres routes). `DirectionView.tsx` réutilise le même hook (`useDirectionSpaDetail`) et les mêmes types mock que `DirectionSpaDetail.tsx` — doublon quasi fonctionnel, démocké lors du cycle précédent mais jamais retiré.

**Conséquence** : confusion potentielle si accès par URL directe (parité fonctionnelle non garantie) ; dette de maintenance (toute évolution de `useDirectionSpaDetail`/`directionMockData` impacte deux écrans, dont un mort) ; la note CLAUDE.md ("DirectionView.tsx est encore en mock, non branché Supabase") est **obsolète** — il est en réalité branché Supabase, seuls les *types* viennent encore de `directionMockData.ts`.

**Recommandation** :
- Supprimer `DirectionView.tsx` et la route `/direction/:id` (`App.tsx:14, 97`) — `DirectionSpaDetail.tsx` couvre déjà ce besoin.
- Vérifier si `directionMockData.ts` ne sert plus que de réservoir de types ; si oui, migrer ces types hors de `data/` et corriger la note CLAUDE.md.
- Pas de levier Polypus — pur nettoyage de dette technique.

---

## Synthèse priorisation pour le lot de correctifs Lovable
1. **P1 sécurité** — RLS `orgs_select_member`/`dest_select_member` + verrou `users_update_own` (SQL, à appliquer manuellement via Dashboard comme tout le reste — PAS de prompt Lovable pour le SQL).
2. **P2 produit** — afficher les 3 livrables IA manquants (`kpi_synthesis`, `management_synthesis`, `ids_synthesis`) dans `PostMeetingMode.tsx`/`DirectionSpaDetail.tsx`.
3. **P3 nettoyage** — supprimer `DirectionView.tsx` + route orpheline + mise à jour CLAUDE.md.
4. **P3 IDS** — aucun correctif requis (comportement sain) ; amélioration produit "vue transverse IDS non clôturés" à considérer en backlog futur, pas dans ce lot.
