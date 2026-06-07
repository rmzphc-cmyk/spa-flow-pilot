# Audit conformité MÉTIER — SPA OMS (agent qa-metier-spa-oms)

Périmètre : exactitude LOGIQUE et DONNÉES (période Monthly, enum IDS triage, matrice KPI, cycle).
Méthode : lecture code + sondes REST LECTURE SEULE sous JWT `sophie.marchand@belhazar.com` (spa `2c54234f…`).

---

### [P1] Agrégation IDS mensuelle exclut les semaines à cheval sur le changement de mois
**Règle** — Le rapport Monthly (mois M) doit remonter les IDS de toutes les réunions weekly **de ce mois**. Une semaine majoritairement en mai appartient au reporting de mai.
**Écart** — `useIdsItemsForMonthlyPeriod` filtre les weekly par `period_start` uniquement :
`src/hooks/useIdsItems.ts:318-322` → `.gte("period_start", periodStart).lte("period_start", periodEnd)`.
Preuve live : la semaine S18 a `period_start=2026-04-30`, `period_end=2026-05-06` (probe REPORTS). Pour le Monthly « Mai 2026 » (`period_start=2026-05-01` → `period_end=2026-05-31`), S18 est **exclue** car son `period_start` (30 avril) < 1er mai — alors que 6 de ses 7 jours sont en mai. Symétriquement, une semaine commençant fin mai mais finissant en juin serait rattachée à mai. Le rattachement dépend du seul lundi de la semaine, pas du chevauchement réel.
**Impact métier** — Des IDS capturés en semaine de transition sont silencieusement absents (ou mal rattachés) de la synthèse Direction du mois. Perte de traçabilité sur les semaines-charnières (12 / an).
**Correctif** — Filtrer par chevauchement d'intervalle plutôt que par `period_start` seul : `period_end >= monthStart AND period_start <= monthEnd`, puis décider d'une règle de rattachement déterministe (ex. semaine rattachée au mois contenant son jeudi / sa majorité de jours) et l'appliquer de façon cohérente aux deux bornes.

---

### [P2] Aucun garde-fou sur la règle « Monthly = mois précédant la réunion »
**Règle** — Réunion en juin → le rapport Monthly couvre **mai** (`period_start = AAAA-05-01`). CLAUDE.md.
**Écart** — La période n'est PAS calculée automatiquement à partir de la date de réunion. `create-report-cycle` reçoit `period_start`/`period_end` du client sans les recalculer (`supabase/functions/create-report-cycle/index.ts`, insert l.~60). Côté UI, `monthlyOptions` propose les 12 derniers mois **dont le mois courant** (`Rapports.tsx:193-208`, boucle `i=0..11`, `i=0` = mois en cours). Rien n'empêche un manager de créer en juin un Monthly « Juin 2026 » (mois en cours, non clos). La conformité repose entièrement sur le bon choix humain dans la liste déroulante.
Preuve live : le Monthly existant est correct (`Mai 2026`, `period_start=2026-05-01`, `meeting_started_at=2026-06-07`) — la règle TIENT en pratique, mais par discipline d'usage, pas par contrainte logicielle.
**Impact métier** — Risque de rapport mensuel ouvert sur un mois incomplet (données partielles, KPI non consolidés) si l'utilisateur sélectionne le mois courant.
**Correctif** — Soit exclure le mois courant des options par défaut (démarrer la boucle à `i=1`) en gardant le mois courant accessible explicitement, soit présélectionner le mois précédent. Décision produit, pas bug de calcul — d'où P2.

---

### [P3] Code mort de calcul de période dans Rapports.tsx
**Règle** — Une seule source de vérité pour le calcul de période.
**Écart** — `computePeriod`, `computeEndFromStart`, `defaultLabel` (`src/pages/Rapports.tsx:116-152`) sont définis mais **jamais appelés** (vérifié par grep : seules les définitions). La période vient désormais de `monthlyOptions`/`weeklyOptions`. `computePeriod(monthly)` utilisait le **mois courant** comme période — logique divergente de la règle « mois précédent », heureusement inerte.
**Impact métier** — Aucun en l'état (dead code), mais risque de régression si réutilisé par erreur (il code la mauvaise règle de période).
**Correctif** — Supprimer ces trois helpers.

---

## Points VÉRIFIÉS CONFORMES (pas de finding)

- **Enum IDS `triage_mode`** : `bloquant|priorite|deleguer|veille` + `NULL`=à trier. Type, `TRIAGE_CONFIG` (couleurs/icônes 🔴🔵🟡⚫), tri (`TRIAGE_SORT_ORDER`), et regroupement `grouped.get(null)`=« non qualifiés » cohérents (`useIdsItems.ts:9,11-81`, `SectionIds.tsx:33-37`, `MeetingView.tsx:954-958`). NULL traité partout comme « à trier avant clôture ». Non testable sur live (0 IDS), validé par code.
- **Règle N/A KPI** (piège create-report-cycle) : `entryToCardValue` ne retient `isNa` que si `status=not_applicable` ET `value_current=null` ET `comment` non vide (`SectionKpi.tsx:106-109`). Les entrées semées en `not_applicable` sans valeur/commentaire par `create-report-cycle` sont donc affichées comme champ vierge, pas comme N/A. RÈGLE TIENT. Confirmé live : aucune entrée bloquée en `not_applicable` parasite (toutes les entrées remplies ont status calculé green/amber/red/excellent + valeur).
- **Matrice KPI rôles × niveaux** : `KpiRole = therapist|spa_concierge|spa_manager|ambassador`, `KpiNiveau = prioritaire|secondaire|suivi` (`useKpiRoleAssignments.ts:5-6`), labels/couleurs complets. Upsert contraint sur `(kpi_definition_id, role)`. Câblage assignations→cartes via `assignmentsByKpiId` (`SectionKpi.tsx:208-215`), KPIs non assignés regroupés en « unassigned ». Cohérent.
- **Cycle période Monthly** : le Monthly live est correctement positionné sur le mois précédant la réunion (voir P2, preuve live).

## Notes données live (non-bugs)
- Couverture assignations partielle : 7/12 KPIs actifs assignés ; rôle `ambassador` et niveau `suivi` **jamais utilisés** dans les données live. Dimensions valides en code mais non exercées → 5 KPIs tombent dans le groupe « non assigné ». Sparsité de seed, pas défaut logique.
- `ids_items` vide sur le spa de test → branche triage/agrégation mensuelle non vérifiable par données, validée par lecture de code uniquement.
