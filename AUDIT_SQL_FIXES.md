# SQL de correction — Audit 2026-06-07

⚠️ À appliquer **manuellement dans Supabase → SQL Editor** (ces policies vivent dans le Dashboard, pas dans `migrations/`). Ne pas `supabase db push`.

---

## ✅ P0-1 — Fuite cross-client `kpi_monthly_targets` (APPLIQUÉ + vérifié le 2026-06-07)

Pour mémoire (déjà en prod) :

```sql
DROP POLICY IF EXISTS direction_read_targets ON public.kpi_monthly_targets;
CREATE POLICY direction_read_targets ON public.kpi_monthly_targets
  FOR SELECT TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'direction'
    AND public.user_can_access_spa(kpi_monthly_targets.spa_id)
  );
```
Vérifié live (JWT direction) : spa étranger → `0` ligne, accès légitime préservé.

---

## 🟠 P1-4 — Bucket `meeting-recordings` lisible/écrivable par tout authentifié

**Contexte vérifié dans le code** : l'upload écrit sous le path `"<spa_id>/<report_id>/<filename>"`
(`src/hooks/useAudioUpload.ts:24`). Le **1er segment du path = `spa_id`** → on scope dessus.
Le bucket est **actuellement vide** : aucun risque de perte de données à appliquer ce fix.

### Étape 1 — Pré-check (lecture seule) : voir les policies actuelles du bucket
```sql
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
  AND (coalesce(qual,'') LIKE '%meeting-recordings%'
    OR coalesce(with_check,'') LIKE '%meeting-recordings%');
```

### Étape 2 — Le fix (remplace les policies trop permissives par des policies scopées)
Le `DO $$` supprime dynamiquement **toutes** les policies du bucket (noms inconnus = on ne devine pas),
puis recrée 3 policies scopées par spa. Atomique.

```sql
BEGIN;

-- 1) Purge des policies existantes du bucket (par leur définition, pas leur nom)
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND (coalesce(qual,'') LIKE '%meeting-recordings%'
        OR coalesce(with_check,'') LIKE '%meeting-recordings%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

-- 2) Lecture : uniquement si l'utilisateur a accès au spa (1er segment du path)
--    user_can_access_spa() couvre admin + spa_manager (son spa) + direction (sa destination)
CREATE POLICY "mr_read_own_spa" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'meeting-recordings'
    AND public.user_can_access_spa(((storage.foldername(name))[1])::uuid)
  );

-- 3) Upload : uniquement le spa_manager de CE spa (son spa_id JWT = 1er segment)
CREATE POLICY "mr_insert_own_spa" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'meeting-recordings'
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'spa_manager'
    AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'spa_id')
  );

-- 4) Update : upload utilise upsert:true (réécrit) → même règle que l'insert
CREATE POLICY "mr_update_own_spa" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'meeting-recordings'
    AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'spa_id')
  )
  WITH CHECK (
    bucket_id = 'meeting-recordings'
    AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'spa_id')
  );

COMMIT;
```

### Hypothèses prises (notées)
- Le `spa_id` du spa_manager est bien présent dans `app_metadata` du JWT (confirmé par la mémoire d'audit : rôle ET spa_id viennent de `app_metadata`).
- L'upload reste préfixé par `spa_id/` (vrai aujourd'hui, `useAudioUpload.ts:24`). Si ce préfixe change, ajuster le segment.
- Vérification post-fix impossible en SQL Editor (ignore la RLS) → tester via l'app sous un compte spa_manager une fois un enregistrement créé, ou me demander une probe.
