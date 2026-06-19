-- Coach onboarding contextuel — table de contenu pédagogique + RLS + seed lot 1 (FR).
-- ⚠️ APPLIQUER MANUELLEMENT via Dashboard → SQL Editor (convention projet : pas de db push).
-- Source de vérité contenu : ~/Google Drive/Claude Dev/Sanagua OMS/coaching_content_lot1_FR.md
--
-- Modèle : 1 ligne = 1 unité de connaissance × 1 langue. Une surface (surface_key)
-- peut porter PLUSIEURS unités (ex. KPI hiérarchisé + indicateur de suivi partagent
-- kpiConfig.roleAssignment). Unicité sur (concept_slug, lang).
-- La carte vue par le manager n'expose PAS expert_note (coulisses méthodo → chatbot v2 / IP Polypus) :
-- le front ne sélectionne simplement pas cette colonne.

create table if not exists public.coaching_content (
  id              uuid primary key default gen_random_uuid(),
  concept_slug    text not null,
  surface_key     text not null,
  role            text not null default 'spa_manager',
  quoi            text not null,
  pourquoi        text not null,
  benefice_metier text not null,
  objection       text,
  exemple         text,
  piege           text,
  expert_note     text,
  lang            text not null default 'fr',
  display_order   int  not null default 0,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint coaching_content_concept_lang_unique unique (concept_slug, lang)
);

create index if not exists coaching_content_surface_idx
  on public.coaching_content (surface_key, role, lang, display_order);

alter table public.coaching_content enable row level security;

-- Lecture : tout utilisateur authentifié voit le contenu actif de SON rôle ;
-- admin/direction voient tout (le rôle est la valeur DbRole du JWT app_metadata,
-- ex. 'spa_manager' — PAS l'AppRole 'manager' du front).
drop policy if exists coaching_content_select on public.coaching_content;
create policy coaching_content_select on public.coaching_content
  for select to authenticated
  using (
    is_active = true
    and (
      role = (auth.jwt() -> 'app_metadata' ->> 'role')
      or (auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'direction')
    )
  );

-- Écriture : admin uniquement (contenu chargé via SQL / future UI admin).
drop policy if exists coaching_content_admin_all on public.coaching_content;
create policy coaching_content_admin_all on public.coaching_content
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- ───────────────────────── SEED — lot 1 (FR), audience spa_manager ─────────────────────────
-- Réexécutable : on purge les 5 concepts FR avant réinsertion.
delete from public.coaching_content
where lang = 'fr'
  and concept_slug in (
    'responsabilite-mesurable', 'kpi-hierarchise', 'indicateur-suivi',
    'todo-vs-objectif', 'triage-ids'
  );

insert into public.coaching_content
  (concept_slug, surface_key, role, quoi, pourquoi, benefice_metier, objection, exemple, piege, expert_note, lang, display_order)
values
-- 1. Responsabilité mesurable
(
  'responsabilite-mesurable',
  'respConfig.sheet.titleLabel',
  'spa_manager',
  $$Une responsabilité = une action concrète, identifiable et mesurable qui ne dépend que de toi et doit être faite quoi qu'il arrive — peu importe la météo, les équipes ou le chiffre de la semaine.$$,
  $$C'est la pierre angulaire de tout le système. Ce qui ne peut pas être monitoré ne peut être ni suivi, ni jugé. On pilote sur des actes vérifiables, jamais sur des intentions : une responsabilité vague (« bien manager », « assurer la qualité ») ne crée aucune redevabilité.$$,
  $$C'est ce qui te permet de te corriger seule, avant que la direction n'ait à intervenir. Quand chaque responsabilité est mesurable, tu vois d'un coup d'œil ce qui est tenu et ce qui glisse : tu gardes la main sur ta performance au lieu de la subir. Et tu n'es jugée que sur ce que tu contrôles — c'est une protection autant qu'une exigence.$$,
  $$« Gestion des équipes », « garantir l'expérience client » = ta fiche de poste, pas une responsabilité. Le test : peut-on la compter ou la cocher ? Reformule en « Vérifier les cabines chaque matin », « 1 entretien individuel / thérapeute / semaine ».$$,
  $$« Si tu mets "gestion des équipes", c'est comme la fiche de poste. Une responsabilité, c'est une action concrète : vérifier que la donnée rentrée est correcte, une fois par semaine. »$$,
  $$Test en une question : « même si on ne fait qu'1 € de CA cette semaine, est-ce que ça doit quand même être fait ? » Si la réponse dépend d'un facteur externe → ce n'est pas une responsabilité, c'est un objectif ou un vœu.$$,
  $$Cercle de contrôle (Covey, 7 Habitudes) : une responsabilité vit strictement dans ce qui « ne dépend que de toi ». Locus de contrôle interne (Rotter) : on ne tient redevable que du contrôlable. « What gets measured gets managed » (Drucker) + critère M de SMART. Accountability Chart EOS : une fonction, une personne redevable.$$,
  'fr', 1
),
-- 2. KPI hiérarchisé
(
  'kpi-hierarchise',
  'kpiConfig.roleAssignment',
  'spa_manager',
  $$Chaque KPI est rattaché à un rôle avec un niveau : prioritaire (la boussole du rôle — une seule), secondaire (compte, sans être vital), suivi (contexte).$$,
  $$Un rôle ne peut pas tout porter en même temps. Le KPI prioritaire, c'est le seul indicateur qui résume la performance du rôle ET sur lequel la personne a réellement la main : le CA pour le manager, le rebooking pour la thérapeute.$$,
  $$Tu donnes à chacun une cible nette à défendre au lieu de douze chiffres dilués. C'est ce qui rend l'auto-correction possible : une thérapeute qui sait que son rebooking est SA bataille va le travailler ; noyée dans 10 KPI, elle ne priorise rien. Pour toi, c'est aussi un cap clair en entretien individuel.$$,
  $$« Mais tout est important. » → si tout est prioritaire, plus rien ne l'est. Hiérarchiser n'efface pas le reste (secondaire, suivi) : ça désigne la bataille n°1. Tu continues à suivre les autres.$$,
  $$« Total Income, c'est la responsabilité principale du manager → prioritaire. Le retail, c'est le thérapeute → secondaire. L'occupation de l'hôtel : c'est le manager, mais indicateur de suivi, t'as pas d'impact dessus. »$$,
  $$Un rôle = un seul KPI prioritaire. Deux « prioritaires » sur un même rôle annulent l'effet boussole. Piège technique : croire que c'est enregistré sans avoir vu le ✓ « Sauvegardé ».$$,
  $$Lead vs lag measures (4DX) : le KPI contrôlable est un lead measure (rebooking), le résultat global (CA) un lag. « Act on the lead measures. » One Metric That Matters (Lean Analytics) / one number des Rockefeller Habits. Garde-fou loi de Goodhart : secondaire/suivi servent de contre-poids à la cible unique.$$,
  'fr', 1
),
-- 3. Indicateur de suivi
(
  'indicateur-suivi',
  'kpiConfig.roleAssignment',
  'spa_manager',
  $$Un indicateur de suivi = une donnée que tu observes mais sur laquelle tu n'as pas de levier direct : occupation de l'hôtel, prix de la chambre, taux de présence du staff.$$,
  $$Il ne sert pas à te juger, il sert à lire correctement un résultat. Croisé avec ton KPI prioritaire, il dit si un écart vient de toi ou du contexte. Sans lui, un mauvais chiffre te tombe dessus sans explication.$$,
  $$C'est à la fois ta lucidité et ta protection. Un résultat faible accompagné de son contexte n'est plus une excuse, c'est un fait vérifiable : « CA insuffisant, mais 2 thérapeutes en arrêt → présence staff à 50 %. » La direction comprend en trois secondes, sans réunion.$$,
  $$« Pourquoi suivre un truc que je ne contrôle pas ? » → précisément parce que tu ne le contrôles pas : c'est lui qui explique tes écarts. Tu ne le pilotes pas, tu t'en sers pour interpréter.$$,
  $$« On a fait 4000 € au lieu de 7000, insuffisant. Mais la présence staff devait être à 90 %, deux se sont mis en arrêt, j'étais à 50 %. Et là, tout colle. »$$,
  $$Ne lui fixe pas d'objectif de performance comme à un vrai KPI — c'est un capteur de contexte. Surveille la qualité de la donnée : une valeur mal saisie t'induit en erreur (cf. bonus versés sur un taux d'occupation faux). Vérifie qu'elle est juste, pas seulement remplie.$$,
  $$Lag / contextual measures (4DX) : cadre d'interprétation, pas de pilotage. Théorie de l'attribution (Weiner) : distinguer causes internes/externes. Désamorce le biais d'attribution fondamentale côté direction. Data quality « garbage in, garbage out » : une décision ne vaut que ce que vaut la donnée.$$,
  'fr', 2
),
-- 4. To-do vs Objectif
(
  'todo-vs-objectif',
  'report.ids.identifiedTitle',
  'spa_manager',
  $$Une to-do = une action ponctuelle, réglable en une fois et cochable « fait ». Un objectif = une cible qui se construit dans le temps, en plusieurs étapes.$$,
  $$On ne règle pas un objectif « en appuyant sur un bouton ». Confondre les deux a un coût : soit tu traites un vrai chantier comme une corvée (et il n'avance pas), soit tu encombres ta liste d'actions de travail de fond qui ne se coche jamais — et ça décourage.$$,
  $$Tu sépares le « à faire vite » du « à construire dans la durée ». Résultat : ta liste d'actions reste vivante (des choses qui se terminent vraiment) et tes vrais chantiers obtiennent le temps et les étapes qu'ils méritent. Tu arrêtes de croire qu'un sujet est « réglé » alors que c'est l'affaire de plusieurs semaines.$$,
  $$« C'est pareil, c'est à faire. » → non. Le test en une question : puis-je le cocher "fait" aujourd'hui ? Oui = to-do. Non, il faut plusieurs étapes dans le temps = objectif.$$,
  $$« La tasse à café, je la rachète → to-do. Améliorer le rebooking de Maria, ça se construit, je me donne 2-3 semaines → objectif. Ce n'est pas la tasse à café. »$$,
  $$Max 3 objectifs actifs en parallèle : « je ne peux pas ouvrir 15 batailles de front, je choisis mes batailles. » Et règle métier : un objectif se crée uniquement en post-réunion mensuelle — en weekly, tu captures, tu ne lances pas.$$,
  $$GTD (David Allen) : next action (une étape) vs projet (résultat multi-étapes). WIP limit (Kanban) + Discipline 1 de 4DX (focus on the wildly important, 1-2 objectifs majeurs) : le plafond de 3 protège l'exécution. Coût du context-switching : au-delà de 3 chantiers, aucun n'avance.$$,
  'fr', 1
),
-- 5. Triage IDS
(
  'triage-ids',
  'report.ids.triage.dialogTitle',
  'spa_manager',
  $$Qualifier un problème, c'est choisir son traitement : bloquant 🔴 (impacte les résultats, c'est maintenant), à déléguer 🔵 (urgent mais pas à toi de le régler), priorité 🟡 (important mais se construit dans le temps), veille ⚫ (à noter / surveiller).$$,
  $$Sans hiérarchie, « tout est important, tout est urgent » — et la direction se noie. « Trop de problèmes, il n'y a plus de problèmes. » Le triage répond à deux questions simples — est-ce urgent ? est-ce à moi ? — et en déduit l'action.$$,
  $$Tu choisis tes batailles et tu protèges l'attention de la direction : Valérie ne reçoit que les vrais sujets, le reste tu le gères en direct. Bonus : le triage route automatiquement le problème — un bloquant urgent devient une to-do, une priorité de fond devient un objectif. Tu tries pour décider quoi faire.$$,
  $$« Je remonte tout, comme ça je suis couverte. » → l'inverse : noyer la direction sous 20 problèmes, c'est n'en faire ressortir aucun. Remonter, c'est trier ce dont la direction doit être au courant — pas vider son sac.$$,
  $$« Inondation dans le toit → bloquant ET à déléguer à la maintenance de l'hôtel : c'est urgent, mais ce n'est pas à toi de le régler. "Peur que les équipes partent" → bloquant pour toi. »$$,
  $$« Délégué » ≠ « ce n'est plus mon problème ». Si Marco ne le fait pas, c'est TON problème, pas le sien : tu délègues la tâche, pas la responsabilité du suivi.$$,
  $$IDS = méthode EOS (Gino Wickman, Traction) : Identify – Discuss – Solve ; attaquer l'Issues List par priorité. Matrice d'Eisenhower (urgent × important) : bloquant=urgent+important, déléguer=urgent+pas-à-moi, priorité=important+pas-urgent→objectif, veille=ni l'un ni l'autre. Management par exception. Délégation ≠ abdication.$$,
  'fr', 1
);
