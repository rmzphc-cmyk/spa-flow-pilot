# Audit Sécurité & Permissions — SPA OMS (Sanagua)

Auditeur : `permissions-rls-spa-oms`. Date : 2026-06-07.
Question : chaque rôle n'accède-t-il QU'À ce qu'il doit, et rien de plus ?

Méthode : matrice établie depuis le code (EF + migrations), **confirmée par probe live** sous les
3 JWT réels (admin@sanagua.com, karim.nassif@sanagua.com=direction, sophie.marchand@belhazar.com=spa_manager)
via lectures/écritures REST directes contre Supabase. Spa de Sophie = Belhazar
`2c54234f-430e-4dc9-b3a4-ddf316220cb8` (destination `73f87182…`). Spa témoin « autre » =
Paradisus Lanzarote `11111111-1111-1111-1111-111111111111` (destination `8ccbe382…`, **autre destination**).

---

## Matrice rôle × ressource (confirmée par comportement réel)

Légende : ✅ autorisé (attendu) · ⛔ refusé (attendu) · ⚠️ ANOMALIE (accès non conforme constaté).
« cross-spa » = lecture/écriture de la ressource d'un spa **non rattaché** au rôle.

| Ressource (action)                          | admin | direction | spa_manager |
|---------------------------------------------|:-----:|:---------:|:-----------:|
| users — read                                | ✅ tous | ✅ son périmètre | ✅ self uniquement |
| users — insert / PATCH role (escalade)      | ⛔ (RLS bloque) | ⛔ | ⛔ |
| spas — read                                 | ✅ tous | ✅ son périmètre | ✅ son spa |
| reports — read own-spa / cross-spa          | ✅ / ✅ | ✅ / ⛔ | ✅ / ⛔ |
| reports — insert cross-spa                  | ✅ | ⛔ | ⛔ |
| kpi_definitions — read/write cross-spa      | ✅ | ⛔ / ⛔ | ⛔ / ⛔ |
| kpi_entries — read cross-spa                | ✅ | ⛔ | ⛔ |
| ids_items / todos — read/write cross-spa    | ✅ | ⛔ | ⛔ |
| responsibility_templates — read/write cross-spa | ✅ | ⛔ | ⛔ |
| **kpi_monthly_targets — read cross-spa**    | ✅ | **⚠️ LEAK** | ⛔ |
| kpi_monthly_targets — write cross-spa       | ✅ | ⛔ | ⛔ |
| direction_spa_access — read                 | ✅ tous | ✅ ses lignes | ✅ ses lignes (vide) |
| direction_spa_access — self-grant cross-spa | ✅ (admin) | ⛔ | ⛔ |
| storage `meeting-recordings` — read autre spa | ✅ | **⚠️ design** | **⚠️ design** |

Sur l'isolation REST cœur (reports, kpi_entries, ids_items, todos, responsibility_templates,
kpi_definitions, meeting_summaries) **l'isolation inter-spa est correcte** : direction et spa_manager
reçoivent `[]` sur le spa d'une autre destination. Aucune escalade de privilège n'est passée
(toutes les écritures hors-rôle ont été refusées 403/42501).

---

## Findings

### [P0] Fuite cross-spa / cross-org de `kpi_monthly_targets` pour le rôle direction
- **Rôle & ressource** : `direction` × `public.kpi_monthly_targets` (lecture).
- **Comportement réel (probe sous JWT karim.nassif=direction)** :
  - `GET kpi_monthly_targets?spa_id=eq.11111111…` → **200, 25 lignes** (cibles KPI mensuelles de
    *Paradisus Lanzarote*, destination `8ccbe382…`).
  - Profil de Karim : `destination_id = 73f87182…` (Belhazar uniquement), `spas` ne lui renvoie que Belhazar.
  - `GET kpi_monthly_targets?select=spa_id` → renvoie **toutes** les cibles, tous spas confondus.
  - Contrôle : `reports`, `kpi_definitions`, `kpi_entries`, `ids_items`, `todos`,
    `responsibility_templates` sur ce même spa étranger → `[]` (correctement isolés).
- **Cause** : la policy `direction_read_targets` (migration `20260528170304…`) est
  `FOR SELECT USING (auth.jwt() -> 'app_metadata' ->> 'role' = 'direction')` — **aucune restriction
  de spa/destination/org**. Tout utilisateur `direction` lit les cibles de **tous les spas du SaaS**,
  y compris d'autres organisations.
- **Risque** : fuite de données business confidentielles (objectifs commerciaux chiffrés) entre
  resorts et entre clients du produit. Aggravé par la vocation multi-tenant (commercialisation Polypus).
- **Correctif RLS** : scoper sur `direction_spa_access` ou `user_can_access_spa()`. Remplacer :
  ```sql
  DROP POLICY IF EXISTS direction_read_targets ON public.kpi_monthly_targets;
  CREATE POLICY direction_read_targets ON public.kpi_monthly_targets
    FOR SELECT TO authenticated
    USING (
      auth.jwt() -> 'app_metadata' ->> 'role' = 'direction'
      AND EXISTS (
        SELECT 1 FROM public.direction_spa_access dsa
        WHERE dsa.user_id = auth.uid() AND dsa.spa_id = kpi_monthly_targets.spa_id
      )
    );
  ```
  (ou `USING (public.user_can_access_spa(kpi_monthly_targets.spa_id))` pour aligner sur les autres tables).

### [P1] Bucket storage `meeting-recordings` lisible par tout authentifié (cross-spa par design)
- **Rôle & ressource** : tout `authenticated` (donc tout `spa_manager` / `direction`) × bucket
  `meeting-recordings` (lecture ET upload).
- **Comportement réel** : policies (migration `20260531145329…`) :
  - SELECT `USING (bucket_id = 'meeting-recordings')` — aucun scoping par spa/dossier.
  - INSERT `WITH CHECK (bucket_id = 'meeting-recordings')` — n'importe qui peut écrire n'importe où.
  - Probe live : `POST storage/v1/object/list/meeting-recordings` renvoie **200** pour direction et
    manager. Bucket **actuellement vide** → aucune donnée réelle exfiltrée à ce jour, d'où P1 (faille
    latente) et non P0.
- **Risque** : dès qu'un enregistrement de réunion existera, un spa_manager d'un autre resort pourra
  lister et télécharger l'audio (et le transcript via EF) d'un spa concurrent. Upload non scopé =
  possibilité d'écrire dans le dossier d'un autre spa.
- **Correctif** : préfixer les objets par `spa_id` et scoper les policies sur le 1er segment du path :
  ```sql
  DROP POLICY IF EXISTS "authenticated can read recordings" ON storage.objects;
  CREATE POLICY "read own-spa recordings" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'meeting-recordings'
           AND public.user_can_access_spa(((storage.foldername(name))[1])::uuid));
  DROP POLICY IF EXISTS "spa_manager can upload recordings" ON storage.objects;
  CREATE POLICY "upload own-spa recordings" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'meeting-recordings'
           AND auth.jwt()->'app_metadata'->>'role' = 'spa_manager'
           AND (storage.foldername(name))[1] = auth.jwt()->'app_metadata'->>'spa_id');
  ```
  (Pré-requis : que le code uploade sous `"<spa_id>/<report_id>/…"`.)

### [P2] Source de vérité des rôles incohérente : RLS lit `public.users`, pas le JWT
- **Ressource** : helpers `current_user_role()`, `current_user_spa_id()`,
  `current_user_organization_id()`, `current_user_destination_id()`, `user_can_access_spa()`.
- **Constat (code)** : ces fonctions lisent `public.users WHERE id = auth.uid()`
  (cf. migration `20260603151513…` et `20260603133508…`), **pas** `app_metadata` du JWT. La spec
  d'audit pose pourtant `app_metadata` comme **unique** source de vérité. Les EF
  (`_shared/auth.ts`) et certaines policies (`kpi_monthly_targets`, `direction_read_targets`)
  utilisent bien le JWT → deux sources de vérité coexistent.
- **Comportement réel** : pas d'escalade exploitée (toutes les écritures sur `public.users` sont
  refusées par RLS — un manager ne peut pas modifier son `role`/`spa_id` dans la table). Le risque
  est donc **divergence**, pas escalade directe : si un jour `public.users.role` est modifiable par un
  chemin (trigger, EF, ou policy future) sans re-sync du JWT, les décisions RLS divergeront des EF.
- **Risque** : incohérence de décision d'autorisation + dépendance à `public.users` réintroduisant le
  risque de récursion (déjà corrigé une fois sur `users`).
- **Correctif recommandé** : faire dériver `current_user_role()`/`current_user_spa_id()` du JWT
  (`auth.jwt()->'app_metadata'->>'role'` / `->>'spa_id'`) pour unifier la source de vérité avec les EF
  et supprimer toute lecture de `public.users` dans le chemin d'autorisation. À défaut, documenter que
  `public.users` reste la SoT côté RLS et garantir la synchro stricte JWT↔users à chaque écriture.

### [P3] EF `structure-voice-note` : authn présente mais aucune authz métier
- **Ressource** : EF `structure-voice-note`. Valide le JWT (`getClaims`) mais n'utilise **pas**
  `authenticate()` partagé et **ne vérifie ni rôle ni spa**. Tout utilisateur connecté (n'importe quel
  rôle) peut faire reformuler n'importe quel texte par GPT-4o.
- **Risque** : faible — pas d'accès à des données d'un autre spa (le texte vient du client), mais
  consommation OpenAI non bornée par un appelant légitime. À surveiller pour le coût.
- **Correctif** : optionnel — refuser si `role` n'est pas dans `{spa_manager, admin}` ; au minimum
  rate-limiter. Non bloquant sécurité-isolation.

---

## Points vérifiés conformes (pas de finding)
- **Escalade de privilège** : `PATCH users SET role='admin'`, `INSERT users`,
  `INSERT direction_spa_access` self-grant → **tous refusés** (403/42501) pour direction et manager. ✅
- **Isolation manager** : Sophie ne voit que son spa sur toutes les tables testées (y compris
  `kpi_monthly_targets`, `direction_spa_access` → vide). ✅
- **Isolation direction** sur reports/kpi_entries/ids/todos/templates/kpi_definitions : correcte
  (`[]` sur spa hors destination). ✅
- **EF d'écriture** (`create-report-cycle`, `update-meeting-schedule`, `admin-manage-user`,
  `authorizeReportAccess`) : vérifient `caller.role`/`caller.spaId` issus du **JWT** et refusent
  cross-spa. `authorizeReportAccess` sans branche `direction` = **normal** (la Direction n'appelle pas
  d'EF d'écriture). ✅
- **Récursion RLS** sur `public.users` : non réapparue (helpers SECURITY DEFINER, pas de self-join). ✅

## Note d'exécution (probes non destructives)
Une écriture de test `INSERT direction_spa_access` (admin → spa Paradisus) a réussi (201, attendu pour
admin) puis a été **supprimée immédiatement** (DELETE 200 vérifié, table re-contrôlée → ligne absente).
Aucune autre écriture n'est passée. Aucun artefact laissé en base.
