# SPA OMS — spa-flow-pilot

Logiciel de pilotage des réunions Spa Manager + Direction pour **Sanagua** (exploitant de spas en resorts hôteliers). Structure les réunions hebdo/mensuelles, génère une synthèse IA post-réunion, diffuse à la Direction. Produit potentiellement commercialisable via Polypus.

App live : https://spa-flow-pilot.lovable.app

## Stack (choix non-évidents)
- React 18 + TS + Vite, shadcn/ui + Tailwind
- TanStack Query v5 — **un hook par domaine** dans `src/hooks/` (toute lecture/écriture Supabase passe par là)
- Supabase : DB + Auth + RLS + Edge Functions (Deno)
- OpenAI GPT-4o — **uniquement dans les Edge Functions** (synthèses, structuration vocale)
- `@react-pdf/renderer` (rapports PDF), i18next (FR/EN/ES), recharts, react-hook-form + zod

## Commandes
- `npm run dev` — dev (Vite)
- `npm run build` — build prod
- `npm run lint` — ESLint
- `npm test` — tests unitaires (Vitest)
- `npx playwright test` — tests E2E

## Workflow Lovable ↔ GitHub ↔ VS Code — CRITIQUE
Le repo est édité **à la fois par Lovable et en local (VS Code)**. Lovable pousse des commits automatiques (messages `Changes`, `Ajouté…`) sur `main` et réimporte depuis GitHub.
- **ALWAYS** `git pull` avant de commencer une session locale — Lovable a pu pousser entre-temps.
- Pousser sur `main` après changements pour resynchroniser Lovable (**pas de branche** : Lovable travaille sur `main`).
- **NEVER** laisser diverger local et distant sans pull d'abord — risque d'écrasement par Lovable.

## Supabase
- Projet : `zvitfplilnkhbclgrtru`. Clés client dans `.env` (`VITE_*`) — **publiques par design**, la sécurité repose sur les RLS.
- **Migrations appliquées MANUELLEMENT** via Dashboard → SQL Editor. **PAS** de `supabase db push` / CLI. Les `.sql` sources vivent dans `~/Google Drive/Claude Dev/Sanagua OMS/`, pas tous dans `supabase/migrations/`.
- **Edge Functions déployées via Lovable/Supabase**, pas par push GitHub. 12 EF dans `supabase/functions/`.
- Rôles (RLS) : `admin` | `direction` | `spa_manager`.
- **NEVER** committer de `service_role` key ni de mot de passe.

## Fichiers importants
- `src/integrations/supabase/client.ts` — client Supabase
- `src/contexts/AuthContext.tsx` — session + rôle utilisateur
- `src/components/rapport/` — sections de rapport (weekly + monthly) + `MeetingView.tsx` (mode réunion plein écran)
- `src/components/pdf/WeeklyReportPdf.tsx` — rendu PDF
- `src/hooks/useReports.ts`, `useKpi*.ts`, `useIdsItems.ts` — accès données par domaine
- - `src/data/directionMockData.ts` — réservoir de types TypeScript (`SpaOverview`, `SpaDetail`, `SpaAlert`, `SpaKpiRow`) utilisés par `useDirectionData.ts` et `DirectionOverview.tsx`

## Règles métier
- **Rapport Monthly = mois PRÉCÉDANT la réunion.** Réunion le 2 juin → couvre mai (`period_start = 2026-05-01`).
- IDS = Issues/Decisions/Solutions capturés en réunion. `triage_mode` : `bloquant` 🔴 | `deleguer` 🔵 | `priorite` 🟡 | `veille` ⚫ | `NULL` = à trier.
- KPI : rôles `therapist|spa_concierge|spa_manager|ambassador` × niveaux `prioritaire|secondaire|suivi` (table `kpi_role_assignments`).

## Conventions
- **Langue de travail : français.** Tout texte UI passe par i18next (`t()`) — **jamais** de chaîne en dur ; sortie des agents IA dans la langue du manager.
- Conventions FR côté reporting (€, formules locale FR).
- shadcn/ui : primitives dans `src/components/ui/` — réutiliser, ne pas réécrire.
