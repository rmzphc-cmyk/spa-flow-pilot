# Spec — Refonte de la feature « Objectifs »

> **Statut : Phase 0 (DB) ✅ prod · Phase 1 (création unifiée) ✅ implémentée · Code review xhigh ✅ PASSÉ le 2026-07-03 (72 candidats → 30 confirmés → 15 majeurs + cleanups TOUS CORRIGÉS) — EN ATTENTE : déploiement EF `ids-convert` puis commit/push. Phases 2-3 à faire.**
> Correctifs review appliqués : progression **baseline-relative** (`start` dans le blob + helper `src/lib/objectiveProgress.ts` + 6 lecteurs + 15 tests), types.ts régénéré, action **Clôturer** (page /objectifs), rendu minimal type Projet, titre éditable à la conversion, admin masqué, toast « déjà converti », fix timezone, verrou concurrence trigger + WITH CHECK journal (migration 20260703093000), compensations EF symétriques et loggées, `ids_item_id` renseigné, SectionIdsWeekly (mort) supprimé, copie i18n corrigée.
> Reste connu différé : dual-write à l'update (Phase 2), édition des étapes + saisie journal (Phase 2), garde UPDATE-réactivation du trigger (Phase 3), dédup coquille dialogs/mapping (cleanup).
> Document de référence pour l'implémentation, le code review et le déploiement.
> Produit à partir d'un audit UX + une repasse « angles morts » par 4 agents (RLS/sécurité, règles métier, inventaire/migration, friction UX).
> **Sécurité vérifiée live** : les policies `objectives` sont déjà scopées `direction_spa_access` (P1/P2 OK, pas de fuite Direction). ⚠️ Le helper `user_can_access_spa()` scope par `destination_id`/`organization_id` (**≠** `direction_spa_access`) → **NE PAS** l'utiliser pour les nouvelles tables ; répliquer le pattern `objectives`.
> SQL Phase 0 appliqué archivé dans `supabase/migrations/*_objectifs_refonte_phase0.sql`.
> Dernière mise à jour : 2026-07-02.

---

## 1. Contexte & objectif

Aujourd'hui un objectif = un **blob JSON unique** dans `objectives.description` (`{metric, target, unit, current, status_ui, comment}`), **écrasé à chaque écriture**. Conséquences : aucune cible saisissable (tout naît à 0), aucun historique, un seul type possible, 3 rendus divergents, 2 chemins de création non sécurisés.

**Objectif de la refonte :** faire de l'objectif un **fil de suivi long terme**, alimenté **à chaque weekly** par un **journal d'actions**, avec **2 natures d'objectif** et un **cycle de vie** réel.

⚠️ **Ce n'est pas une évolution, c'est une refonte de schéma.** Blast radius : ~15-18 fichiers, 3-4 migrations manuelles, ~27 traductions. Estimé 3-5 j.

---

## 2. Design verrouillé

### 2.1 Deux natures d'objectif (exclusives à la création)

| Type | Mesure de réussite | Avancement | Exemple |
|---|---|---|---|
| **Chiffré** (`numeric`) | la valeur atteint la cible | `(courant − départ) / (cible − départ)` | Rebooking 10% → 25% |
| **Projet / étapes** (`steps`) | toutes les étapes cochées | `étapes faites / total` | Menu en chambre (5 étapes) |

Les deux alimentent une barre 0→100 %.

### 2.2 Journal d'actions (cœur du besoin)

Alimenté **à chaque weekly** (aujourd'hui les objectifs sont mensuel-only). Une entrée =
- **date** (auto),
- **texte** « ce que j'ai fait / mis en place »,
- **tag de situation PAR entrée** : 🟢 En bonne voie / 🟠 Compliqué / 🔴 En difficulté,
- **(type chiffré)** la nouvelle valeur → construit la trajectoire ;
- **(type projet)** cochage d'une/des étape(s).

L'historique des tags = mémoire du moral dans le temps. Le mensuel devient le moment de **bilan / clôture**.

### 2.3 Décisions produit

| Réf | Décision |
|---|---|
| **A** | Création via conversion IDS (**primaire**) + bouton **direct secondaire**. |
| **B** | Tag / statut **manuel** (jugement du manager), pas d'auto-calcul. |
| **C** | Limite **3 objectifs actifs** par spa, **appliquée UI + serveur**. |
| Cycle de vie | `active → achieved/abandoned` (réutilise l'enum existant), libère un slot, **reste consultable en historique**. |

### 2.4 Décisions émergentes de l'analyse (à valider)

1. Le **journal passe par une Edge Function** (jamais insert client) — un objectif est transversal aux cycles, donc **pas de garde de verrou** `is_locked`.
2. Les objectifs **ne bloquent jamais la finalisation du weekly** — une semaine sans entrée est normale (section informative).
3. Le **type est modifiable tant que le journal est vide**, verrouillé ensuite.
4. Pour le type **projet**, le tag de situation devient un **« ressenti » optionnel** (le % mécanique = donnée dure).
5. **Objectif périmé** (échéance dépassée) : badge + CTA clôture ; il **compte** dans les 3 jusqu'à clôture.
6. **Écran « Historique »** (onglet `/objectifs`) pour les clôturés + section au PDF mensuel.
7. **Migration legacy** : objectifs existants → défaut `type = numeric`.

---

## 3. Modèle de données cible

> ⚠️ **SQL DRAFT** — à réconcilier avec les policies **live** de `objectives` (non versionnées dans le repo, hébergées au Dashboard/Drive). Les rôles sont lus depuis `app_metadata` (source de vérité). Migrations appliquées **manuellement** via Dashboard → SQL Editor.

### 3.1 Table `objectives` — colonnes à ajouter

Déjà présentes (à réutiliser) : `status (active|achieved|abandoned)`, `achieved_at`, `source (manual|ids_conversion)`, `ids_item_id`, `target_date`, `report_id_created`.

À déprécier : `progress_note`, `progress_updated_in_report` (doublon avec le journal).

```sql
-- Type d'objectif
create type objective_kind as enum ('numeric', 'steps');
alter table objectives add column if not exists kind objective_kind not null default 'numeric';

-- Modèle chiffré : vraies colonnes (sortir du blob JSON)
alter table objectives add column if not exists metric        text;
alter table objectives add column if not exists unit          text;
alter table objectives add column if not exists start_value   numeric;   -- baseline (ex. 10%)
alter table objectives add column if not exists target_value  numeric;   -- cible   (ex. 25%)
alter table objectives add column if not exists current_value numeric;   -- dérivé de la dernière entrée journal

-- Backfill depuis le JSON existant (legacy = numeric)
update objectives set
  metric        = coalesce(metric,        description::jsonb->>'metric'),
  unit          = coalesce(unit,          description::jsonb->>'unit'),
  target_value  = coalesce(target_value, (description::jsonb->>'target')::numeric),
  current_value = coalesce(current_value,(description::jsonb->>'current')::numeric)
where description is not null and description <> '';
```

### 3.2 Table `objective_updates` — le journal (nouvelle)

```sql
create table objective_updates (
  id            uuid primary key default gen_random_uuid(),
  objective_id  uuid not null references objectives(id) on delete cascade,
  spa_id        uuid not null references spas(id),          -- dénormalisé (RLS simple)
  report_id     uuid references reports(id),                -- weekly source (audit) — PAS de garde de verrou dessus
  created_by    uuid not null references users(id),
  action_text   text,
  value         numeric,                                    -- type chiffré : valeur à cette date
  situation_tag text check (situation_tag in ('on_track','complicated','struggling')),
  created_at    timestamptz not null default now()
);
alter table objective_updates enable row level security;

-- SELECT : manager du spa + direction scopée + admin
create policy objective_updates_select on objective_updates for select using (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  or exists (select 1 from users u
             where u.id = auth.uid() and u.spa_id = objective_updates.spa_id)
  or exists (select 1 from direction_spa_access dsa
             where dsa.user_id = auth.uid() and dsa.spa_id = objective_updates.spa_id)
);

-- INSERT : manager du spa parent uniquement (WITH CHECK cohérence spa_id ↔ objectif)
create policy objective_updates_insert on objective_updates for insert with check (
  created_by = auth.uid()
  and exists (select 1 from objectives o
              where o.id = objective_updates.objective_id
                and o.spa_id = objective_updates.spa_id
                and o.spa_id = (select spa_id from users where id = auth.uid()))
);
-- UPDATE/DELETE : owner + admin (à calquer sur les policies live objectives)
```

> **Piège confirmé (bug IDS bis)** : si l'écriture passe par un insert client, elle échouera **en silence** sur un weekly verrouillé. → **L'écriture du journal doit passer par une Edge Function service_role, sans garde `is_locked`.**

### 3.3 Table `objective_steps` — étapes (type projet, nouvelle)

```sql
create table objective_steps (
  id            uuid primary key default gen_random_uuid(),
  objective_id  uuid not null references objectives(id) on delete cascade,
  spa_id        uuid not null references spas(id),
  label         text not null,
  is_done       boolean not null default false,
  display_order int not null default 0,
  created_at    timestamptz not null default now()
);
alter table objective_steps enable row level security;
-- Policies : même matrice que objective_updates (SELECT manager/direction/admin ; write manager owner).
```

### 3.4 Limite de 3 — application serveur

La RLS seule ne peut pas compter (par ligne + race conditions). Deux options :

- **Option retenue : Edge Function transactionnelle** (cohérent avec l'unification des chemins de création) — compte `status='active'` puis insère dans la même transaction.
- Alternative : trigger `BEFORE INSERT` avec `SELECT count(*) ... FOR UPDATE`.

Gérer : la clôture libère un slot ; les données legacy peuvent déjà dépasser 3 (limiter les **INSERT**, pas les UPDATE).

---

## 4. Sécurité / RLS — à prouver AVANT de coder

Les policies de `objectives` **ne sont pas dans le repo**. Avant implémentation, **probes live obligatoires** (réutiliser `tests/audit/ids-lock-probe.spec.ts`) :

- [ ] **P1** — SELECT `objectives` scopé Direction : sous JWT direction à accès partiel (`karim.nassif@sanagua.com`), `GET objectives?spa_id=eq.<spa_non_autorisé>` → doit renvoyer `[]`. (Risque = ancien bug `kpi_monthly_targets`.)
- [ ] **P2** — UPDATE `objectives` filtré spa : sous JWT `sophie.marchand`, `PATCH objectives?id=eq.<obj_autre_spa>` → 0 ligne.
- [ ] **P3** — après création de `objective_updates` : mêmes probes SELECT/INSERT cross-spa.

Matrice cible pour les nouvelles tables : **SELECT** = spa_manager(spa) + direction(scopée `direction_spa_access`) + admin ; **INSERT/UPDATE** = spa_manager owner (via EF) + admin ; **DELETE** = admin.

---

## 5. Plan d'implémentation par phases

### Phase 0 — Fondations DB ✅ APPLIQUÉE (2026-07-02, prod)
- ✅ Colonnes `kind`/`start_value`/`target_value`/`current_value`/`metric`/`unit` sur `objectives`.
- ✅ Tables `objective_updates` (5 policies) + `objective_steps` (3 policies), RLS scopée `direction_spa_access`.
- ✅ Limite 3 via trigger `trg_objective_active_limit` (grandfather legacy) — **testé** : bloque le 4e (`OBJECTIVE_LIMIT_REACHED`), zéro ligne persistée.
- ✅ Probes P1/P2 : policies `objectives` déjà scopées, aucune fuite Direction.

### Phase 1 — Création unifiée & sécurisée
- **Un seul** chemin de création via EF (capture `kind` + champs + garde limite serveur). Supprimer l'insert client `useAddObjectiveFromIds`.
- `IdsToObjectiveDialog` : sélecteur de type + champs (métrique/départ/cible/unité **ou** étapes) + date ; bouton désactivé à 3.
- Bouton **création directe** secondaire (`/objectifs` + section rapport).

### Phase 2 — Journal weekly *(besoin cœur)*
- Ajouter `objectifs` à `weeklySections` (RapportDetail) — **non bloquant** pour la finalisation ; câbler `onStatusChange` (toujours ≥ warning, jamais incomplete-bloquant) + `isLocked`.
- Formulaire de saisie de **la semaine en cours** (via EF, append-only) + **timeline lecture seule** des entrées passées.
- Tag par entrée + valeur (chiffré) / cases à cocher (projet). `current_value` = dernière entrée chiffrée.
- Pré-remplissage : rappeler la dernière valeur/date sous l'input.

### Phase 3 — Cycle de vie, historique, cohérence
- Action **« Atteint / Clôturer »** (réutilise `status`/`achieved_at`) → libère un slot.
- Badge **« échéance dépassée »** + CTA clôture.
- Onglet **Historique** (`/objectifs`) + section objectifs clôturés au **PDF mensuel**.
- **Unifier les 3 cartes** en un `ObjectiveCard` partagé + une seule logique de couleur (tokens sémantiques `success/warning/destructive`).
- **Densité réunion** : MeetingView n'affiche que l'entrée courante + résumé de la précédente.
- Étendre les **synthèses IA** (weekly + mensuelle) pour lire le journal *(déploiement via Lovable)*.
- **i18n** : corriger 2 chaînes en dur + ajouter ~27 clés FR/EN/ES.

---

## 6. Registre des angles morts (consolidé)

### 🔴 Bloquants
| Réf | Angle mort | Traité en |
|---|---|---|
| B1 | Aucune table journal (blob écrasé) | Phase 0/2 |
| B2 | Type projet/étapes inexistant en DB | Phase 0/1 |
| B3 | Journal perdu en silence sur rapport verrouillé (bug IDS bis) | Phase 0/2 (EF) |
| B4 | Limite 3 non gardée (contournable via IDS) | Phase 0/1 |

### 🟠 Impacts forts
| Réf | Angle mort | Traité en |
|---|---|---|
| O1 | `SectionObjectifs` sans `onStatusChange`/`isLocked` pour le weekly | Phase 2 |
| O2 | Fuite Direction cross-spa possible (filtre client) | §4 probe P1 |
| O3 | 2 chemins de création divergents | Phase 1 |
| O4 | Pas de valeur de départ → barre rouge 0% à la création | Phase 0/1 |
| O5 | Tag redondant/contradictoire pour type projet | Phase 2 (déc. 4) |
| O6 | Densité journal en réunion | Phase 3 |
| O7 | Objectif périmé non détecté | Phase 3 |
| O8 | Aucun écran historique des clôturés | Phase 3 |

### 🟡 À gérer
- 3 logiques de couleur de barre divergentes → unifier (Phase 3).
- Synthèses IA aveugles au journal → étendre (Phase 3).
- Legacy `progress_note`/`progress_updated_in_report` en doublon → déprécier (Phase 0).
- Décalage temporel « mensuel = mois précédent » → à expliquer dans l'UX.
- État vide « objectif projet sans étape » → message guidé (Phase 2).

---

## 7. i18n (FR/EN/ES)

À corriger : 2 pluriels en dur dans `MeetingView.tsx` (~l.425, ~l.1011).
À créer (~9 clés × 3 langues) : sélecteur de type, baseline, étapes (add/delete/empty), journal (titre/entrée/tag par entrée), clôture (atteint/abandonné), état périmé, onglet historique, état vide « pas de départ ».

---

## 8. Critères d'acceptation

- [ ] Un objectif **chiffré** se crée avec départ + cible + unité ; la barre reflète `(courant−départ)/(cible−départ)`.
- [ ] Un objectif **projet** se crée avec des étapes ; la barre reflète `étapes faites/total`.
- [ ] À chaque **weekly**, on ajoute une entrée de journal (texte + tag + valeur/étape) **sans écraser** les précédentes ; l'historique est visible.
- [ ] L'écriture du journal **fonctionne même sur un rapport verrouillé** (via EF).
- [ ] Impossible de créer un **4e** objectif actif (bloqué UI **et** serveur) ; la clôture d'un objectif libère un slot.
- [ ] Un directeur à accès partiel **ne voit que** les objectifs/journaux de ses spas (probes P1-P3 vertes).
- [ ] Les objectifs clôturés restent **consultables** (onglet Historique + PDF mensuel).
- [ ] Aucune chaîne en dur ; parité FR/EN/ES.
- [ ] `npm run build`, `npm run lint`, `npm test` verts.

---

## 9. Checklist avant déploiement

1. [ ] Probes RLS live **P1-P3** vertes.
2. [ ] Compter les objectifs existants en prod (dimensionner la migration / cas « déjà > 3 actifs »).
3. [ ] Migrations §3 appliquées au Dashboard (dans l'ordre) + vérifiées.
4. [ ] Edge Function(s) déployées via Lovable/Supabase.
5. [ ] **Coordination Lovable** : chantier sur ~15-18 fichiers que Lovable édite aussi → `git pull` avant chaque incrément, push après, éviter la divergence.
6. [ ] `/code-review` sur le diff avant le push final.
