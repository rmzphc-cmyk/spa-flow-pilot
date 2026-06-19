-- Coach onboarding v2 — passage du modèle « concept par champ » au modèle
-- « section à remplir » : un panneau par section du rapport, structure
-- Pourquoi / Comment / Exemple / À retenir. Voix validée : corporate-friendly,
-- accessible (spa managers issues de l'esthétique), méthode invisible.
-- ⚠️ APPLIQUER MANUELLEMENT (Dashboard SQL Editor) ou via `supabase db query --linked`.
-- Source contenu : ~/Google Drive/Claude Dev/Sanagua OMS/coaching_content_lot1_FR.md

drop table if exists public.coaching_content cascade;

create table public.coaching_content (
  id            uuid primary key default gen_random_uuid(),
  section_slug  text not null,
  surface_key   text not null,
  role          text not null default 'spa_manager',
  titre         text not null,
  pourquoi      text not null,
  comment       text not null,
  exemple       text,
  a_retenir     text,
  lang          text not null default 'fr',
  display_order int  not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint coaching_content_section_lang_unique unique (section_slug, lang)
);

create index coaching_content_surface_idx
  on public.coaching_content (surface_key, role, lang);

alter table public.coaching_content enable row level security;

create policy coaching_content_select on public.coaching_content
  for select to authenticated
  using (
    is_active = true
    and (
      role = (auth.jwt() -> 'app_metadata' ->> 'role')
      or (auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'direction')
    )
  );

create policy coaching_content_admin_all on public.coaching_content
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- ───────────────── SEED — 6 sections du weekly (FR), audience spa_manager ─────────────────
insert into public.coaching_content
  (section_slug, surface_key, role, titre, pourquoi, comment, exemple, a_retenir, lang, display_order)
values
-- ① Check-in rapide
(
  'section-checkin-weekly',
  'report.checkinWeekly.title',
  'spa_manager',
  $$La section « Check-in rapide »$$,
  $$Avant les chiffres, on prend la température : la vôtre, et celle de l'équipe. Une semaine difficile ou une équipe fatiguée explique souvent bien des résultats. Votre ressenti n'est pas un détail — c'est une vraie information de pilotage. 30 secondes, pas plus.$$,
  $$1. Votre énergie cette semaine — honnêtement.
2. L'état de l'équipe : ambiance, motivation, tensions.
3. Une phrase si besoin ; sinon, on passe.$$,
  null,
  $$Ce n'est pas un bilan psychologique, juste un repère. On ne vous demande pas d'aller bien tout le temps — juste de savoir où vous en êtes.$$,
  'fr', 1
),
-- ② KPI de la semaine
(
  'section-kpi-weekly',
  'report.kpi.weeklyTitle',
  'spa_manager',
  $$La section « KPI de la semaine »$$,
  $$Vous renseignez vos chiffres de la semaine pour les comparer à votre objectif. L'intérêt : réagir tôt. Plutôt que de découvrir un écart en fin de mois, vous le voyez tout de suite et vous ajustez pendant qu'il est encore temps. Chaque rôle a un chiffre qui compte vraiment — le vôtre, c'est votre boussole.$$,
  $$1. Saisissez la valeur réelle de la semaine.
2. Loin de l'objectif ? Ajoutez une phrase de contexte — la cause, simplement (une absence, une opération, peu de passages…).
3. Vérifiez le petit ✓ « enregistré » avant de partir.$$,
  null,
  $$Pas besoin de longs commentaires : une phrase suffit. Le but n'est pas de vous justifier, mais d'expliquer ce que les chiffres seuls ne disent pas.$$,
  'fr', 1
),
-- ③ Responsabilités
(
  'section-responsabilites-weekly',
  'report.responsabilites.titleWeekly',
  'spa_manager',
  $$La section « Responsabilités »$$,
  $$Vos responsabilités, ce sont les actions qui ne dépendent que de vous — celles que vous tenez quoi qu'il arrive. Les pointer chaque semaine, c'est tenir vos propres engagements, sans attendre que la direction vienne vérifier. C'est votre tableau de bord avant d'être le sien.$$,
  $$1. Pour chacune, indiquez si elle a été tenue cette semaine.
2. Sinon, une ligne de contexte suffit.$$,
  null,
  $$Ce n'est pas un contrôle. C'est là que vous vérifiez, pour vous-même, que l'essentiel a bien été fait.$$,
  'fr', 1
),
-- ④ Actions (to-do)
(
  'section-todo-weekly',
  'report.todo.weekly.thisWeek',
  'spa_manager',
  $$La section « Actions »$$,
  $$On retrouve ici les petites actions concrètes décidées les semaines passées. Les passer en revue, c'est éviter qu'une seule se perde entre deux semaines chargées. Rien de lourd : juste garder le fil.$$,
  $$1. Pour chaque action : faite, en cours, ou reportée.
2. Si vous reportez, donnez la nouvelle échéance (et la raison si elle compte).$$,
  null,
  $$Reporter n'a rien de grave : une semaine, ça déborde. L'important, c'est de toujours savoir où en est chaque action.$$,
  'fr', 1
),
-- ⑤ Objectifs
(
  'section-objectifs',
  'report.objectifs.title',
  'spa_manager',
  $$La section « Objectifs »$$,
  $$Les objectifs, ce sont vos chantiers de fond — ceux qui se construisent dans le temps, en plusieurs étapes (faire progresser une thérapeute, installer une nouvelle habitude…). On en garde trois au maximum, et c'est volontaire : on choisit ses combats pour vraiment les mener au bout, plutôt que d'en lancer dix qui n'avancent pas.$$,
  $$1. Faites le point : où en êtes-vous, qu'est-ce qui avance, qu'est-ce qui bloque ?
2. Un objectif atteint laisse la place au suivant.$$,
  null,
  $$Trois objectifs, ce n'est pas une limite frustrante : c'est ce qui vous permet de les tenir. Mieux vaut trois chantiers finis que dix abandonnés en route.$$,
  'fr', 1
),
-- ⑥ Problèmes identifiés (IDS)
(
  'section-ids-weekly',
  'report.ids.identifiedTitle',
  'spa_manager',
  $$La section « Problèmes identifiés »$$,
  $$Ici, vous remontez à la direction les problèmes de la semaine qui méritent vraiment son attention — pas tous les petits imprévus du quotidien. Car si on remonte tout, l'important se noie dans la masse. Ce tri, vous le faites déjà naturellement dans votre tête au fil de la semaine ; cette section vous permet simplement de le poser — pour vous soulager, et le partager clairement avec la direction.$$,
  $$1. Écrivez le problème en une phrase, simplement. L'important est de l'identifier, pas de le rédiger parfaitement.
2. Demandez-vous : est-ce urgent ? et est-ce à vous de le régler ?
   🔴 Bloquant — urgent, ça touche vos résultats, à traiter par vous.
   🔵 À déléguer — urgent, mais c'est le rôle d'un autre (l'hôtel, la maintenance…).
   🟡 Priorité — important, mais ça se construit dans le temps.
   ⚫ Veille — à garder à l'œil, sans urgence.
3. Réglable en une fois ? → une to-do. Plusieurs étapes ? → un objectif.$$,
  $$« Je crains le départ de plusieurs membres de l'équipe » → bloquant, c'est à vous de gérer.
« Fuite au plafond de la cabine 3 » → à déléguer à la maintenance : c'est urgent, mais ce n'est pas votre métier.$$,
  $$Vouloir tout remonter pour être tranquille. Signaler vingt problèmes, c'est n'en signaler aucun. Votre vraie valeur, ici, c'est votre capacité à trier — pas à tout consigner.$$,
  'fr', 1
);
