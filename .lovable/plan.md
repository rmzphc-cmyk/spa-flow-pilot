## Objectif
Nettoyer la barre latérale du rôle **Direction** et stabiliser la navigation quand on ouvre Config KPI / Config Resp / Organisation.

## Constat
Dans `src/components/AppSidebar.tsx`, le bloc « Direction » s'affiche uniquement quand `location.pathname.startsWith("/direction")`. Dès qu'un compte direction clique sur `/admin/kpi`, `/admin/responsabilites` ou `/admin/organisation`, la variable `isDirection` devient `false` et la sidebar bascule sur le menu Manager (Dashboard, Mes rapports, Todos, Objectifs) — c'est ce que l'utilisateur veut supprimer.

## Modifications (uniquement `src/components/AppSidebar.tsx`)

1. **Détection du mode Direction par rôle, pas par URL**
   - Remplacer `const isDirection = location.pathname.startsWith("/direction")` par `const isDirection = userRole === "direction"`.
   - Effet : la sidebar Direction reste affichée sur `/direction`, `/direction/spa/:id`, `/admin/kpi`, `/admin/responsabilites`, `/admin/organisation`, `/parametres`.

2. **Sections conservées pour Direction (dans l'ordre)**
   - Vue d'ensemble → `/direction`
   - Liste des Spas (déjà en place, un item par spa → `/direction/spa/:id`)
   - Config KPI → `/admin/kpi`
   - Config Resp → `/admin/responsabilites`
   - Organisation → `/admin/organisation`
   
   Les 3 derniers restent dans le bloc bas déjà présent (footer avec séparateur). Aucun ajout de doublon.

3. **Sections supprimées pour Direction**
   - Le bloc `mainNavItems` (Dashboard, Mes rapports, Todos, Objectifs) ne doit jamais s'afficher pour un compte direction. C'est déjà garanti par la condition `!isDirection` du bloc — le fix #1 suffit à le masquer partout.

4. **État actif des liens KPI / Resp / Organisation**
   - Vérifier que le `NavLink` de chaque item du footer Direction met bien la classe active quand la route correspond (déjà le cas via `isActive` de `NavLink`). Pas de changement de layout, seul le style « actif » s'applique — l'utilisateur reste sur la même interface.

5. **Bouton « Retour Manager »**
   - Dans le footer Direction, ce lien renvoie vers `/`. Pour un compte direction pur, cela redirige vers `/direction` (via `RootRedirect`). Le laisser tel quel (aucune demande de suppression).

## Hors périmètre
- Aucun changement de routes (`src/App.tsx`), de logique métier, de RLS, ni d'autres composants.
- Aucune modification des traductions.

## Vérification
- Se connecter en Direction, cliquer successivement sur Vue d'ensemble, un Spa, Config KPI, Config Resp, Organisation : la sidebar doit rester identique (mêmes items, même ordre, item actif surligné), sans jamais afficher Dashboard/Mes rapports/Todos/Objectifs.
