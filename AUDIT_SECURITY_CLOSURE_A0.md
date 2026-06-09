# Clôture sécurité A0 — preuves live (2026-06-08)

Mode « sécurité d'abord, preuves ensuite ». Deux incidents soulevés par le sondage permissions du 2026-06-07, traités en priorité absolue avant tout sujet produit/frontend.

Sonde rejouable : `tests/audit/security-probe.spec.ts` (config `tests/audit/playwright.audit.config.ts`), exécutée en live contre la prod (https://spa-flow-pilot.lovable.app) sous les 3 JWT réels. Lecture seule, sauf suppression ciblée de la ligne parasite (conditionnelle, non déclenchée car inexistante).

---

## Incident 1 — Ligne parasite `direction_spa_access` (admin → autre spa)

| | |
|---|---|
| **État initial (live)** | `direction_spa_access` sur OTHER_SPA (`11111111…` Paradisus) = **0 ligne**. Vue admin globale de la table = **1 seule ligne**, légitime : `karim (bbbbbbbb…001) → Belhazar (2c54234f…)`. |
| **Correctif appliqué** | **Aucun nécessaire** — la ligne parasite (admin→OTHER_SPA) n'existe pas. Soit le cleanup du sondage antérieur a bien tourné, soit l'INSERT n'a jamais persisté. Vérifié, pas assumé. |
| **Preuve post-fix** | `GET direction_spa_access?user_id=eq.<adminUid>&spa_id=eq.OTHER_SPA` → `[]` (status 200). Aucun artefact résiduel. |
| **Risque résiduel** | Nul. Remarque : même si elle avait existé, une ligne DSA pointant un compte **admin** est inerte (l'admin a déjà accès à tout par son rôle) — clutter, pas escalade. |

**→ CLOS.**

---

## Incident 2 — Fuite cross-org `kpi_monthly_targets` (rôle direction)

Le 2026-06-07, un compte `direction` lisait les cibles KPI mensuelles de **tous les spas** (25 lignes d'un spa hors périmètre + « toutes » les cibles). Cause identifiée : policy `direction_read_targets` `USING (role='direction')`, **sans scope spa**.

| | |
|---|---|
| **État initial (live, 2026-06-08)** | Table **non vide** : recensement admin = **25 lignes, toutes sur OTHER_SPA (Paradisus)** — exactement le jeu qui fuyait. Karim (direction) n'a qu'**1 grant** `direction_spa_access` → Belhazar. |
| **Correctif appliqué** | Déjà appliqué en prod **manuellement (Dashboard)** entre le 07 et le 08/06 — la policy live est désormais **scopée** (hors git). |
| **Preuve post-fix** | Sous JWT karim=direction : `GET kpi_monthly_targets?spa_id=eq.OTHER_SPA` → **0 ligne** ; `GET kpi_monthly_targets` (tout) → **0 ligne / 0 spa**. **Décisif** : la table contient 25 lignes (vues par l'admin) mais le rôle direction en lit **0** → la policy filtre réellement (ce n'est pas un effet de table vide). Contrôle : `reports` OTHER_SPA = 0 (isolé). Contrôle manager (Sophie) : 0 hors Belhazar. |
| **Risque résiduel** | 🟠 **Drift git↔prod.** La migration committée `20260528170304_…sql` contient ENCORE la policy **non scopée**. Un replay de migration / resync Lovable pourrait **restaurer** la version permissive et **rouvrir la fuite**. → Verrou fourni : `AUDIT_SQL_SECURITY_A0.sql` (à appliquer via Dashboard pour aligner git sur prod). Avant application : capturer la policy live exacte (`SELECT … FROM pg_policies WHERE tablename='kpi_monthly_targets'`) pour codifier le live plutôt que l'écraser. |

**→ FUITE FERMÉE (prouvée). Reste : verrouiller contre la régression.**

---

## Points connexes vus dans le sondage (hors périmètre des 2 incidents, NON traités ici)
- **[P1] Bucket storage `meeting-recordings`** lisible/écrivable par tout authentifié (cross-spa par design). Latent (bucket vide), mais à scoper avant tout enregistrement réel. SQL esquissé dans `AUDIT_FINDINGS_permissions.md`.
- **[P2] Double source de vérité rôles** (RLS lit `public.users` vs JWT) — déjà tracé dans le lot P2 ([[spa-oms-audit-p2-2026-06-08]]), pas d'escalade exploitable constatée.

## Note d'exécution
- 1er login admin de la sonde : échec « Identifiants incorrects » (flakiness cold-start Lovable) ; aux passes suivantes admin/karim/sophie s'authentifient tous les 3. Mot de passe canonique `Audit2026!` confirmé valide.
- Sonde additive (`security-probe.spec.ts`), gitignorée comme le reste de `tests/audit/`. Aucun fichier d'audit existant supprimé (gel respecté).
