-- Fix bug « KPI non disponible » : un KPI marqué N/A ne se distinguait d'une
-- entrée not_applicable pré-créée (vierge) que par la PRÉSENCE d'un commentaire,
-- ce qui forçait une raison et faisait repasser la carte en saisie de valeur.
-- On ajoute un marqueur explicite `is_na` → la raison devient optionnelle et le
-- N/A persiste / se reconstruit correctement.
-- Additif et rétro-compatible (default false). À appliquer via `supabase db query --linked`.

alter table public.kpi_entries
  add column if not exists is_na boolean not null default false;

-- Backfill : les anciens « vrais N/A » (avant ce fix) = not_applicable + valeur nulle
-- + commentaire (la raison). On les marque is_na=true pour qu'ils restent affichés
-- en mode N/A dans la vue éditable (sinon ils repasseraient en saisie chiffrée).
-- Les entrées pré-créées vierges (not_applicable, valeur nulle, commentaire vide)
-- restent is_na=false → saisie chiffrée par défaut. Idempotent.
update public.kpi_entries
set is_na = true
where status = 'not_applicable'
  and value_current is null
  and comment is not null
  and btrim(comment) <> ''
  and is_na = false;
