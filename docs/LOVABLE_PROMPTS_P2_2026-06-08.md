# Prompts Lovable — Suivi P2 (2026-06-08)

Lot de correctifs P2/P3 produit, à exécuter dans Lovable **dans l'ordre**, un par un, en attendant la confirmation "build vert" avant d'enchaîner. Le correctif **P1 sécurité** (RLS) n'est PAS dans ce lot — c'est du SQL à appliquer manuellement via Supabase Dashboard → SQL Editor (`AUDIT_SQL_FIXES_P2.sql`), conformément au workflow du projet.

---

## Prompt 1 — [P2] Afficher les 3 livrables IA manquants (kpi_synthesis, management_synthesis, ids_synthesis)

```
Projet SPA OMS (spa-flow-pilot). La synthèse IA post-réunion est générée par l'Edge Function generate-meeting-summary et stocke 5 champs dans la table meeting_summaries : executive_summary, kpi_synthesis, management_synthesis, ids_synthesis, key_actions (tous exposés via le hook useMeetingSummary / type MeetingSummaryRow).

PROBLÈME : seuls executive_summary et key_actions sont actuellement affichés dans src/pages/PostMeetingMode.tsx (lignes ~118-138, sections "Résumé exécutif" et "Décisions clés") et dans MeetingView.tsx (lignes ~193-206). Les 3 autres champs (kpi_synthesis, management_synthesis, ids_synthesis) sont générés par GPT-4o, payés en tokens, stockés en base… mais jamais montrés à personne.

MISSION (UNIQUEMENT PostMeetingMode.tsx, et le mode réunion live MeetingView.tsx si le pattern s'y prête) :
1. Ajouter 3 nouvelles sections d'affichage, sur EXACTEMENT le même modèle visuel que la section "Résumé exécutif" existante (même classes Tailwind : bg-card border border-border rounded-xl p-5 shadow-sm, même structure titre/texte) :
   - "Synthèse KPI" → affiche summaryRow?.kpi_synthesis
   - "Synthèse management" → affiche summaryRow?.management_synthesis
   - "Synthèse IDS" → affiche summaryRow?.ids_synthesis
2. Placer ces sections juste après "Résumé exécutif" et avant "Décisions clés", dans cet ordre : Résumé exécutif → Synthèse KPI → Synthèse management → Synthèse IDS → Décisions clés.
3. Chaque section ne doit s'afficher QUE si le champ correspondant n'est pas vide/null (même logique conditionnelle que pour decisionsFromAi).
4. Passer les 4 nouveaux titres ("Synthèse KPI", "Synthèse management", "Synthèse IDS") par i18next : ajouter les clés dans le namespace existant (cohérent avec celui de "Résumé exécutif"/"Décisions clés" — réutiliser ce namespace) dans les 3 fichiers src/i18n/{fr,en,es}.json.

RÈGLES :
- NE PAS toucher à la logique de récupération des données (useMeetingSummary), juste de l'affichage en plus.
- NE PAS modifier l'Edge Function generate-meeting-summary.
- Garder le skeleton de chargement (!aiReady) inchangé — il doit englober les nouvelles sections.
- Respecter scrupuleusement le style visuel existant (pas de nouvelle palette de couleurs).

RÉSULTAT ATTENDU : la Direction et le Spa Manager voient désormais les 5 livrables IA générés (executive_summary, kpi_synthesis, management_synthesis, ids_synthesis, key_actions), dans les 3 langues FR/EN/ES.
```

---

## Prompt 2 — [P3] Supprimer l'écran orphelin DirectionView.tsx + sa route morte

```
Projet SPA OMS (spa-flow-pilot). Un audit a confirmé que src/pages/DirectionView.tsx est un écran legacy en doublon, sans aucune navigation active vers lui dans l'application (recherche exhaustive : aucun lien/navigate() ne pointe vers la route /direction/:id). Il est un quasi-doublon fonctionnel de src/pages/DirectionSpaDetail.tsx (route /direction/spa/:id, elle bien utilisée par AppSidebar.tsx et DirectionOverview.tsx), réutilisant le même hook useDirectionSpaDetail.

MISSION :
1. Supprimer le fichier src/pages/DirectionView.tsx.
2. Retirer la route /direction/:id et son import dans src/App.tsx (actuellement lignes ~14 et ~97) — NE PAS toucher aux routes /direction (DirectionOverview) ni /direction/spa/:id (DirectionSpaDetail), qui restent le parcours réel.
3. Vérifier si src/data/directionMockData.ts ne sert plus QUE de réservoir de types TypeScript (SpaOverview, SpaDetail, SpaAlert, SpaKpiRow) utilisés par useDirectionData.ts / DirectionOverview.tsx / DirectionSpaDetail.tsx :
   - Si oui : NE PAS le supprimer (cassures d'imports), mais tu peux le signaler dans ta réponse pour un futur renommage/déplacement.
   - Si des données mock actives y subsistent encore et sont utilisées ailleurs que par DirectionView : laisse le fichier intact et signale-le.

RÈGLES :
- NE PAS toucher à DirectionOverview.tsx ni DirectionSpaDetail.tsx (ils sont la version maintenue et fonctionnelle).
- Vérifier qu'aucun autre fichier n'importe DirectionView avant suppression (grep).

RÉSULTAT ATTENDU : build et TypeScript verts, plus aucune route ni fichier mort référençant DirectionView ; le parcours Direction reste 100% fonctionnel via /direction et /direction/spa/:id.
```

---

## Note — CLAUDE.md à corriger après le Prompt 2

La ligne suivante dans `CLAUDE.md` est devenue obsolète et doit être retirée/corrigée une fois le Prompt 2 appliqué :
> ⚠️ `src/data/directionMockData.ts` — `DirectionView.tsx` est **encore en mock**, non branché Supabase

(en réalité `DirectionView.tsx` était déjà branché sur `useDirectionSpaDetail`/Supabase — seuls les *types* venaient de ce fichier ; et l'écran lui-même va disparaître).
