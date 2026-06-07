# Audit Pertinence Opérationnelle & Produit — SPA OMS

Auditeur : pertinence-ope-spa-oms. Scope : adéquation besoin↔fonction par persona, Vue Direction (mock vs réel), boucle de valeur synthèse IA / IDS / KPI, manques structurels. Lecture/observation seule. App invitation-only : analyse étayée par le code des écrans live et des hooks de données réellement câblés à Supabase.

---

### [P0] La vue de pilotage multi-spas (consolidation, tendances, comparaison) n'existe pas — seule subsiste une liste de cartes mono-période
Persona : Direction.
Écart besoin↔réalité : la Direction pilote PLUSIEURS spas et a besoin de comparer (entre spas et dans le temps) pour arbitrer. Or `DirectionOverview.tsx` (route live `/direction`) n'affiche qu'une liste de cartes spa, une par spa, sur le **dernier rapport uniquement** (`useDirectionData.ts:80` prend `latestReport`). Aucun consolidé : pas de CA total réseau, pas de moyenne NPS, pas de classement, pas de vue temporelle. Pire, les 3 KPI affichés sur chaque carte (CA / NPS / Responsabilités) sont **codés en dur à "—"** (`useDirectionData.ts:102` : `kpis: { ca: "—", nps: "—", responsabilites: "—" }`). La carte montre donc un nom de spa, un statut de rapport et une bannière d'alerte générique, rien de chiffré.
Conséquence opérationnelle : la Direction ne peut pas piloter depuis cet écran. Elle voit "qui a validé son rapport", pas "quel spa performe / décroche". Aucune décision multi-spas possible sans rouvrir chaque spa un par un.
Recommandation : bandeau consolidé en haut (CA réseau, NPS moyen, % spas dans le vert, top/flop), et brancher réellement les 3 KPI de carte (au minimum CA + NPS depuis `kpi_entries`/`kpi_definitions`). Levier Polypus : c'est LE livrable qui justifie un abonnement "Direction" — sans consolidé, l'outil n'est qu'un classeur de rapports.

### [P0] L'historique / comparaison de périodes (SpaHistory) est 100 % mock et inaccessible en nav
Persona : Spa Manager ET Direction.
Écart besoin↔réalité : suivre une tendance (KPI qui dérive, météo équipe qui baisse) est le cœur d'un OMS de réunions récurrentes. `SpaHistory.tsx` est le seul écran de tendances (graphes recharts, export CSV) mais ses données sont **entièrement codées en dur** (`spaData` ligne 26+, périodes figées Janvier→Mars 2026, `// Mock Data` ligne 9). Aucun branchement Supabase. De plus le lien de menu pointe vers `/historique` (`AppSidebar.tsx:61`) alors que la route déclarée est `/historique/:spa` (`App.tsx:81`) : le clic mène à du vide/404.
Conséquence opérationnelle : impossible de répondre à "est-ce que ça s'améliore depuis 3 mois ?". Chaque réunion repart de zéro ; la valeur d'un suivi récurrent (voir la trajectoire) est perdue. Les courbes affichées en démo sont trompeuses (fausses données présentées comme réelles).
Recommandation : démocker SpaHistory sur `reports`+`kpi_entries`+`checkins` (la structure de graphe existe déjà, seul le fetch manque) et corriger le lien nav vers le spa courant. Levier Polypus : la tendance multi-période est un argument de vente fort et le composant est déjà construit — c'est du branchement, pas du build.

### [P1] La richesse de la synthèse IA est produite puis jetée : seuls 2 champs sur 5 atteignent l'utilisateur
Persona : Spa Manager (post-réunion) et Direction.
Écart besoin↔réalité : `generate-meeting-summary` génère 5 livrables structurés — `executive_summary`, `kpi_synthesis`, `management_synthesis`, `ids_synthesis`, `key_actions` (index.ts:89, stockés ligne 192-204). Mais le post-réunion (`PostMeetingMode.tsx`) n'affiche QUE `executive_summary` + `key_actions` (lignes 121, 123-135). La vue Direction (`DirectionSpaDetail.tsx:158`) n'affiche QUE `executive_summary`. Les synthèses dédiées KPI / management / IDS — celles qui sont les plus actionnables par bloc — ne sont **jamais rendues nulle part**.
Conséquence opérationnelle : on paie des tokens GPT-4o pour 5 analyses, on en montre 2. La Direction reçoit un pavé exécutif générique au lieu des 3 angles décisionnels (où sont les KPI rouges, comment va l'équipe, quels problèmes ouverts).
Recommandation : afficher les 3 sous-synthèses (en accordéon Direction + post-réunion). Coût nul côté IA, gain de valeur immédiat.

### [P1] La synthèse n'est pas multilingue alors que les managers le sont (langue forcée "fr")
Persona : Spa Manager (resorts internationaux — i18n FR/EN/ES revendiqué).
Écart besoin↔réalité : la règle produit (CLAUDE.md) impose "sortie des agents IA dans la langue du manager". Or `generate-meeting-summary` met `language: "fr"` en dur (index.ts:201) et le prompt système est en français fixe. Un manager EN/ES reçoit une synthèse française.
Conséquence opérationnelle : friction d'adoption hors France ; la synthèse, censée faire gagner du temps, doit être retraduite mentalement. Bloque le déploiement réseau international (Sanagua = resorts).
Recommandation : passer la langue cible (depuis le profil manager / `report`) au prompt et au champ `language`.

### [P1] La synthèse IA peut silencieusement n'être qu'un template, sans signal à la Direction
Persona : Direction.
Écart besoin↔réalité : si OpenAI est indisponible/échoue, `buildFallback()` (index.ts:92-142) produit une synthèse purement gabarit ("X indicateurs suivis, Y au vert…", `model_used: "template-fallback"`). C'est sauvegardé comme une synthèse normale. Côté Direction, `DirectionSpaDetail.tsx:158` affiche le texte avec un `AiBadge` identique — aucune distinction. La Direction croit lire une analyse IA alors que c'est du remplissage mécanique.
Conséquence opérationnelle : confiance erronée dans une "analyse" qui ne fait que recompter des chiffres bruts. Décision potentiellement prise sur une synthèse vide de sens.
Recommandation : exposer `model_used` côté UI (badge "synthèse automatique simplifiée" si fallback) ou inviter à régénérer.

### [P2] La diffusion à la Direction est un ping générique non scopé, sans contenu actionnable ni relance
Persona : Direction.
Écart besoin↔réalité : à la validation, `validate-final-report` notifie **tous** les users `direction` (index.ts:101-106, filtre sur `app_metadata.role`, **sans** respect de `direction_spa_access` qui scope pourtant la lecture). Le message est figé : "Le rapport mensuel a été validé et est disponible" — pas de nom de spa, pas de chiffre clé, pas de signal d'alerte. Notification in-app uniquement (aucun email/digest dans le code). Aucune relance si la Direction ne consulte pas.
Conséquence opérationnelle : un directeur multi-spas reçoit N notifications interchangeables, doit ouvrir chaque rapport pour savoir lequel mérite attention. La "diffusion" n'apporte aucune information décisionnelle ; le risque qu'un rapport critique passe inaperçu est réel.
Recommandation : message enrichi (nom spa + 1 alerte clé : "2 KPI rouges"), scoper aux directeurs ayant accès au spa, ajouter un digest email. Levier Polypus : la diffusion intelligente "ce qui mérite votre attention" est un différenciateur produit.

### [P2] DirectionView (route /direction/:id) — écran orphelin et partiellement vide qui dégrade la lecture
Persona : Direction.
Écart besoin↔réalité : il existe DEUX écrans de détail spa : `DirectionSpaDetail.tsx` (route live `/direction/spa/:id`, lié depuis les cartes et le switcher) et `DirectionView.tsx` (route `/direction/:id`, atteignable par URL mais jamais liée en nav). DirectionView affiche un `checkinNote` en gros et en italique comme accroche principale (lignes 135-140) mais le hook ne le remplit jamais (`useDirectionData.ts:278` : `checkinNote: ""`), idem dans DirectionSpaDetail (ligne 214 : `"{lv.checkinNote}"` toujours vide). Bloc "objectifs" dépend de `description` parsé en JSON (`useDirectionData.ts:234`) — fragile si la saisie réelle n'est pas du JSON.
Conséquence opérationnelle : deux UX divergentes pour la même donnée, dont une (DirectionView) met en avant un champ structurellement vide. Confusion de maintenance et lecture dégradée.
Recommandation : supprimer/fusionner DirectionView, brancher réellement le check-in (table `checkins` existe et est lue par l'EF de synthèse) ou retirer le bloc.

### [P2] IDS et objectifs n'ont pas de continuité inter-réunions côté Direction — pas de "qu'est devenu le problème du mois dernier ?"
Persona : Direction et Spa Manager.
Écart besoin↔réalité : l'IDS vise à transformer un problème en décision suivie. La Direction voit les IDS du **dernier rapport seulement** (`useDirectionData.ts` borne tout sur `reportId` du dernier cycle). Le statut "Résolu/En cours" est déduit de façon approximative (`useDirectionData.ts:255` : "resolved" dès qu'une `proposed_solution` existe — une solution proposée n'est pas une résolution). Aucun fil de suivi d'un IDS d'un mois à l'autre, aucune vue des objectifs "à risque" récurrents.
Conséquence opérationnelle : l'IDS produit de la saisie en réunion mais pas de redevabilité dans la durée. La Direction ne peut pas challenger "ce problème traîne depuis 3 réunions".
Recommandation : statut IDS basé sur `converted_to_todo/objective` + clôture explicite ; vue "IDS ouverts toutes périodes" côté Direction.

### [P3] Aucun export PDF/partage du rapport mensuel — seul le Weekly a un PDF
Persona : Direction (reporting hors-app, CoDir).
Écart besoin↔réalité : `src/components/pdf/` ne contient que `WeeklyReportPdf.tsx`. Le rapport **mensuel** (celui diffusé à la Direction, le plus stratégique) n'a aucun rendu PDF ni export partageable hors-app. SpaHistory propose un export CSV mais sur données mock.
Conséquence opérationnelle : un directeur qui veut présenter un spa en CoDir ou archiver doit faire une capture d'écran. Frein à l'usage "remontée vers le haut".
Recommandation : générer un PDF mensuel (réutiliser l'archi `@react-pdf/renderer` existante). Levier Polypus : l'export brandé est un attendu standard d'un produit SaaS vendable.

---
Fin des findings.
