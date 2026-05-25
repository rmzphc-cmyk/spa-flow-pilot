/**
 * Seed de démo — Spa Riviera, Marie D. Spa Manager.
 *
 * Méthode EOS appliquée fidèlement :
 *   1. Check-in humain + météo équipe
 *   2. Revue KPI (spa + manager) avec contexte
 *   3. Responsabilités managériales (Excellent / Bon / Insuffisant + justif)
 *   4. To-do : actions héritées avec statut + commentaire de suivi
 *   5. Objectifs SMART mensuels
 *   6. IDS — Identifier / Discuter / Solutionner
 *   7. Engagements de clôture
 *
 * Storyline avril → mai 2026 :
 *   - W14 : démarrage lent, Camille en arrêt maladie, caisse Orchestra plante.
 *   - W15 : tensions planning congés, rupture Phytomer, NPS en baisse.
 *   - W16 : Camille revient, opération "Printemps" lancée, audit qualité.
 *   - W17 : fin de mois solide, formation up-sell faite par Léa.
 *   - Avril mensuel : recrutement CDD Maria validé, programme fidélité à lancer.
 *   - W18 : séminaire équipe (4 mai) très réussi, gamme été lancée.
 *   - W19 : affluence record, opération Fête des mères.
 *   - W20 : pont du 8 mai → annulations, rupture best-sellers boutique.
 *   - W21 + mensuel mai : brouillons à préparer.
 *
 * Règles :
 *   - Lit `kpi_config` et `resp_templates_v1` sans jamais écrire dessus.
 *   - Écrit dans `reports_data` via reportsStore.
 */
import {
  setReports,
  hasStoredReports,
  REPORTS_STORAGE_KEY,
  type ReportRecord,
  type ReportDetails,
  type TodoItem,
  type IdsItem,
  type KpiActual,
  type ObjectiveItem,
  type ResponsibilityScore,
  type Commitment,
} from "@/lib/reportsStore";

// ============================================================
// LECTURES SAFE (jamais d'écriture)
// ============================================================

interface KpiConfigItem {
  id: string;
  name: string;
  unit: string;
  category: string;
  monthly_targets: Record<string, { target: number; weekly_targets: Record<string, number> }>;
}

interface RespTemplate {
  id: string;
  name: string;
  category: string;
  frequency: string;
  active: boolean;
}

function readKpiConfig(): KpiConfigItem[] {
  try {
    const raw = localStorage.getItem("kpi_config");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readRespTemplates(): RespTemplate[] {
  try {
    const raw = localStorage.getItem("resp_templates_v1");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ============================================================
// FALLBACK KPI si config vide (Spa KPI + Manager KPI)
// ============================================================

const FALLBACK_KPIS: KpiConfigItem[] = [
  { id: "ca", name: "CA global du mois", unit: "€", category: "spa", monthly_targets: {} },
  { id: "occ", name: "Taux d'occupation cabines", unit: "%", category: "spa", monthly_targets: {} },
  { id: "panier", name: "Panier moyen", unit: "€", category: "spa", monthly_targets: {} },
  { id: "nps", name: "NPS clients", unit: "/10", category: "spa", monthly_targets: {} },
  { id: "retail", name: "CA retail boutique", unit: "€", category: "spa", monthly_targets: {} },
  { id: "noshow", name: "Taux de no-show", unit: "%", category: "manager", monthly_targets: {} },
  { id: "rebooking", name: "Taux de rebooking", unit: "%", category: "manager", monthly_targets: {} },
];

const DEFAULT_MONTHLY_TARGETS: Record<string, number> = {
  ca: 85000,
  occ: 72,
  panier: 95,
  nps: 8.5,
  retail: 14000,
  noshow: 6,
  rebooking: 35,
};

function getTarget(item: KpiConfigItem, monthKey: string, weekKey?: string): number {
  const m = item.monthly_targets?.[monthKey];
  if (weekKey && m?.weekly_targets?.[weekKey] != null) return m.weekly_targets[weekKey];
  if (m?.target != null) return weekKey ? m.target / 4 : m.target;
  const fb = DEFAULT_MONTHLY_TARGETS[item.id] ?? 100;
  return weekKey ? fb / 4 : fb;
}

function round(n: number, unit: string): number {
  if (unit === "%" || unit === "/10") return Math.round(n * 10) / 10;
  if (unit === "€") return Math.round(n);
  return Math.round(n * 10) / 10;
}

function withDelta(target: number, pct: number, unit: string): number {
  return round(target * (1 + pct / 100), unit);
}

// ============================================================
// STORYLINE — pourcentages d'écart + commentaires contextuels
// ============================================================
// Convention : un % négatif est "en-dessous de l'objectif".
// Pour noshow on inverse : positif = mauvais.

interface KpiStory {
  delta: Record<string, number>;
  comments: Record<string, string>;
}

const STORY: Record<string, KpiStory> = {
  W14: {
    delta: { ca: -18, occ: -15, panier: -8, nps: -4, retail: -16, noshow: +35, rebooking: -10 },
    comments: {
      ca: "Démarrage lent : Camille en arrêt depuis le 30/03, météo pluvieuse, -2 jours sur la haute saison",
      occ: "Cabine 2 fermée 3 jours (Camille absente), pas de remplacement trouvé à temps",
      panier: "Moins d'add-on vendus, équipe en sous-effectif n'a pas eu le temps de proposer le rituel",
      nps: "2 avis 6/10 sur la disponibilité des créneaux, lié au sous-effectif",
      retail: "Boutique peu poussée cette semaine, focus sur les cabines",
      noshow: "Pic de no-shows liés aux annulations météo (orages mardi-mercredi)",
      rebooking: "Pas de relances rebooking faites cette semaine — process à reprendre",
    },
  },
  W15: {
    delta: { ca: -14, occ: -12, panier: -10, nps: -8, retail: -13, noshow: +25, rebooking: -8 },
    comments: {
      ca: "CA toujours en retrait, mix soins courts dominant. Camille toujours absente, prolongation jusqu'au 14/04",
      occ: "Planning serré, plusieurs demandes congés en mai à arbitrer ont mobilisé du temps managérial",
      panier: "Rupture Phytomer corps depuis lundi → impossible de proposer le rituel signature",
      nps: "Une cliente fidèle a laissé 5/10 : 'manque de personnalisation, équipe stressée'. Recadrage fait jeudi",
      retail: "Stocks Phytomer non réassortis, impossible de pousser la gamme",
      noshow: "8 no-shows cette semaine, surtout sur créneaux 18h. Tester SMS de rappel 24h avant",
      rebooking: "Toujours pas de relance — process formalisé pour W16",
    },
  },
  W16: {
    delta: { ca: -4, occ: -3, panier: -2, nps: +2, retail: -5, noshow: -10, rebooking: +5 },
    comments: {
      ca: "Reprise : Camille de retour mardi, opération 'Printemps' lancée jeudi (-15% sur soins visage)",
      occ: "Weekend complet samedi & dimanche, cabines 1-2-3 saturées",
      panier: "Up-sell rituel printemps fonctionne (+18€ moyen quand proposé)",
      nps: "8.6/10, retours positifs sur l'opération Printemps. Équipe ressoudée",
      retail: "Phytomer réassorti mercredi mais on rattrape doucement",
      noshow: "SMS rappel 24h testé sur 3 jours : -2 no-shows vs W15. À généraliser",
      rebooking: "Léa a relancé 12 clientes du mois dernier, 5 ont rebooké",
    },
  },
  W17: {
    delta: { ca: +6, occ: +5, panier: +4, nps: +3, retail: +7, noshow: -25, rebooking: +12 },
    comments: {
      ca: "Très bonne fin de mois, opération Printemps prolongée d'une semaine sur décision direction",
      occ: "Cabines pleines tous les jours, seul mercredi matin un peu creux",
      panier: "Rituels duo cartonnent (couples qui préparent la fête des mères), panier +12€",
      nps: "8.8/10 — formation accueil de Gaëlle porte ses fruits, plusieurs retours sur 'l'écoute exceptionnelle'",
      retail: "Mise en avant gamme corps en boutique = +18% vs semaine précédente",
      noshow: "SMS rappel généralisé lundi : seulement 3 no-shows cette semaine (vs 8 en W15)",
      rebooking: "Process rebooking formalisé avec Sophie : 22% de rebook sur les soins de cette semaine",
    },
  },
  W18: {
    delta: { ca: +12, occ: +10, panier: +8, nps: +6, retail: +14, noshow: -30, rebooking: +18 },
    comments: {
      ca: "Excellent démarrage, séminaire équipe du 4 mai a vraiment soudé tout le monde",
      occ: "Affluence forte, weekends saturés, 2 walk-ins refusés (à analyser)",
      panier: "Packages 'Bien-être Printemps' lancés, panier moyen +22€ vs avril",
      nps: "9.1/10 — meilleure semaine depuis février, retours sur 'ambiance chaleureuse'",
      retail: "Gamme été lancée lundi, ventes au-dessus des prévisions",
      noshow: "SMS rappel + rappel J-1 par Gaëlle = 1 seul no-show cette semaine",
      rebooking: "Programme fidélité VIP testé sur 20 clientes : 8 ont rebooké en 48h",
    },
  },
  W19: {
    delta: { ca: +15, occ: +12, panier: +9, nps: +7, retail: +17, noshow: -35, rebooking: +20 },
    comments: {
      ca: "Activité record, fête des mères stimule les soins duo et coffrets cadeaux",
      occ: "Occupation 86%, on a dû ouvrir un créneau supplémentaire le samedi (Maria en renfort)",
      panier: "Coffrets cadeaux fête des mères : panier moyen sur ces ventes = 145€",
      nps: "9.2/10, plusieurs recommandations spontanées sur Google",
      retail: "Coffrets cadeaux explosent les ventes, rupture déjà sur 2 références",
      noshow: "Process verrouillé : SMS J-1 + rappel téléphone si VIP",
      rebooking: "Phase 2 fidélité VIP confirmée, 25% des soins de cette semaine ont un rebook",
    },
  },
  W20: {
    delta: { ca: -6, occ: -5, panier: -4, nps: -2, retail: -7, noshow: +15, rebooking: -3 },
    comments: {
      ca: "Pont du 8 mai → -3 jours d'activité réelle. Annulations en cascade mardi-mercredi",
      occ: "Beaucoup d'annulations dues aux ponts, mais le weekend a sauvé la semaine",
      panier: "Panier stable malgré moins de flux, les clientes présentes ont consommé",
      nps: "Stable malgré la baisse d'affluence, équipe a bien géré le stress des ponts",
      retail: "Rupture totale sur 4 best-sellers boutique, manque à gagner estimé 1 200€",
      noshow: "Hausse normale en période de pont, à anticiper pour Ascension/Pentecôte",
      rebooking: "Léa absente jeudi-vendredi, moins de relances faites",
    },
  },
};

// ============================================================
// CHECK-IN HUMAIN (manager + équipe)
// ============================================================

const CHECKIN: Record<string, { mood: number; note: string; teamWeather: string }> = {
  W14: {
    mood: 6,
    note: "Fatiguée mais focus. Camille absente pèse, je gère beaucoup d'opérationnel",
    teamWeather: "🌧️ Pluie sur Sophie et Gaëlle — moral en baisse à cause du sous-effectif",
  },
  W15: {
    mood: 6,
    note: "Tendue. Arbitrage congés mai difficile, 3 demandes simultanées sur la même semaine",
    teamWeather: "⛅ Ciel voilé. Tensions planning, échanges un peu vifs en briefing",
  },
  W16: {
    mood: 8,
    note: "Soulagée du retour de Camille. Énergie remontée grâce à l'opération Printemps",
    teamWeather: "⛅ Éclaircie. Équipe ressoudée autour de l'opération, Gaëlle très impliquée",
  },
  W17: {
    mood: 8,
    note: "Boostée. Fin de mois solide, sentiment d'avoir bien rebondi",
    teamWeather: "🌞 Soleil. Équipe fière des résultats, plusieurs félicitations spontanées",
  },
  W18: {
    mood: 9,
    note: "Excellente forme. Séminaire du 4 mai a vraiment refait le groupe",
    teamWeather: "🌞 Grand soleil. Énergie au top, cohésion visible dès le briefing du lundi",
  },
  W19: {
    mood: 9,
    note: "Très motivée. Activité dense mais maîtrisée, on est dans le flow",
    teamWeather: "🌞 Soleil. Équipe en pleine confiance, Maria s'intègre très bien",
  },
  W20: {
    mood: 7,
    note: "Un peu fatiguée par les ponts, mais l'équipe a tenu. Vigilance sur les stocks",
    teamWeather: "⛅ Stable. Légère fatigue des ponts, mais ambiance positive maintenue",
  },
};

// ============================================================
// TO-DO — Storyline réelle avec carryover entre semaines
// ============================================================
// Chaque action a un id stable. On la fait évoluer de semaine en semaine
// avec status + note de suivi explicite.

interface TodoState {
  id: string;
  label: string;
  status: TodoItem["status"];
  owner: string;
  note?: string;
  origin?: string;
  dueDate?: string;
}

const TODOS_BY_WEEK: Record<string, TodoState[]> = {
  W14: [
    { id: "td-caisse", label: "Contacter support Orchestra — bug clôture caisse", owner: "Marie D.", status: "todo", dueDate: "8 avr", origin: "IDS W14" },
    { id: "td-phytomer", label: "Relancer Phytomer pour réassort gamme corps", owner: "Marie D.", status: "todo", dueDate: "9 avr" },
    { id: "td-conges", label: "Préparer arbitrage planning congés mai", owner: "Marie D.", status: "in_progress", dueDate: "11 avr", note: "Réunion équipe lundi prochain" },
    { id: "td-remplacement", label: "Trouver remplacement praticienne pour absence Camille", owner: "Sophie M.", status: "in_progress", dueDate: "10 avr", note: "2 candidates contactées via réseau" },
  ],
  W15: [
    { id: "td-caisse", label: "Contacter support Orchestra — bug clôture caisse", owner: "Marie D.", status: "in_progress", note: "Ticket #4521 ouvert lundi, patch annoncé pour W16", origin: "IDS W14", dueDate: "15 avr" },
    { id: "td-phytomer", label: "Relancer Phytomer pour réassort gamme corps", owner: "Marie D.", status: "postponed", note: "Fournisseur en rupture nationale, livraison repoussée au 16/04", dueDate: "16 avr" },
    { id: "td-conges", label: "Préparer arbitrage planning congés mai", owner: "Marie D.", status: "done", note: "Fait lundi 8/04, arbitrage validé en équipe avec compensation jours fériés" },
    { id: "td-remplacement", label: "Trouver remplacement praticienne", owner: "Sophie M.", status: "done", note: "Maria (CDD 2 semaines) commence W16, recommandée par Camille" },
    { id: "td-audit-humidite", label: "Auditer cabines 2 & 3 — problème humidité signalé", owner: "Karim T.", status: "todo", dueDate: "17 avr", origin: "IDS W15" },
    { id: "td-sms-noshow", label: "Tester SMS de rappel J-1 pour réduire no-shows", owner: "Gaëlle R.", status: "todo", dueDate: "16 avr" },
  ],
  W16: [
    { id: "td-caisse", label: "Bug caisse Orchestra", owner: "Marie D.", status: "done", note: "Patch v3.2.1 installé jeudi 16/04, plus aucun plantage depuis", origin: "IDS W14" },
    { id: "td-phytomer", label: "Réassort Phytomer gamme corps", owner: "Marie D.", status: "done", note: "Livré mercredi 15/04, mise en cabine le jour même" },
    { id: "td-audit-humidite", label: "Auditer cabines 2 & 3 — humidité", owner: "Karim T.", status: "in_progress", note: "Audit fait, problème confirmé sur cabine 3 (joint à remplacer)", origin: "IDS W15", dueDate: "24 avr" },
    { id: "td-sms-noshow", label: "SMS rappel J-1 anti no-show", owner: "Gaëlle R.", status: "in_progress", note: "Testé 3 jours : -2 no-shows. À généraliser semaine prochaine" },
    { id: "td-formation-upsell", label: "Former Léa sur l'up-sell rituel printemps", owner: "Marie D.", status: "todo", dueDate: "22 avr" },
    { id: "td-process-rebook", label: "Formaliser process rebooking avec Sophie", owner: "Sophie M.", status: "in_progress", note: "Draft prêt, à tester sur 1 semaine" },
  ],
  W17: [
    { id: "td-audit-humidite", label: "Réparer cabine 3 (joint humidité)", owner: "Karim T.", status: "done", note: "Joint changé mardi, hygrométrie revenue à 55% (norme)", origin: "IDS W15" },
    { id: "td-sms-noshow", label: "Généraliser SMS rappel J-1", owner: "Gaëlle R.", status: "done", note: "Généralisé lundi, 3 no-shows cette semaine vs 8 en W15. Validé !" },
    { id: "td-formation-upsell", label: "Former Léa sur l'up-sell", owner: "Marie D.", status: "done", note: "Formation 2h faite mardi, Léa a déjà placé 4 up-sell jeudi-vendredi" },
    { id: "td-process-rebook", label: "Process rebooking", owner: "Sophie M.", status: "done", note: "22% de rebook cette semaine vs 8% en W15, process validé" },
    { id: "td-seminaire", label: "Organiser séminaire équipe 4 mai", owner: "Marie D.", status: "in_progress", dueDate: "30 avr", note: "Lieu réservé (La Bergerie), programme en cours de finalisation" },
    { id: "td-fidelite", label: "Préparer phase 2 programme fidélité VIP", owner: "Marie D.", status: "todo", dueDate: "5 mai", origin: "Bilan W16" },
  ],
  W18: [
    { id: "td-seminaire", label: "Séminaire équipe 4 mai", owner: "Marie D.", status: "done", note: "Excellente journée, retours unanimes positifs. Compte-rendu envoyé à la direction" },
    { id: "td-fidelite", label: "Lancer phase 2 programme fidélité VIP", owner: "Marie D.", status: "in_progress", note: "Lancé mardi sur 20 clientes pilotes, 8 ont déjà rebooké en 48h", dueDate: "31 mai" },
    { id: "td-gamme-ete", label: "Lancer gamme été en boutique + cabines", owner: "Léa P.", status: "done", note: "Lancement lundi, ventes au-dessus des prévisions" },
    { id: "td-walkins", label: "Analyser refus 2 walk-ins du weekend", owner: "Sophie M.", status: "todo", dueDate: "13 mai", origin: "IDS W18" },
    { id: "td-fetemeres", label: "Préparer opération Fête des mères (coffrets + duos)", owner: "Marie D.", status: "in_progress", note: "Coffrets reçus, mise en scène boutique faite jeudi", dueDate: "20 mai" },
  ],
  W19: [
    { id: "td-fidelite", label: "Phase 2 programme fidélité VIP", owner: "Marie D.", status: "in_progress", note: "Étendu à 50 clientes, 25% de rebook constaté", dueDate: "31 mai" },
    { id: "td-walkins", label: "Analyser refus walk-ins", owner: "Sophie M.", status: "done", note: "Analyse faite : créneaux 11h-13h surchargés. Proposition d'ouvrir cabine 4 le samedi matin" },
    { id: "td-fetemeres", label: "Opération Fête des mères", owner: "Marie D.", status: "done", note: "Très belle performance, coffrets en rupture sur 2 réfs dès vendredi" },
    { id: "td-stock-coffrets", label: "Recommander coffrets cadeaux en urgence", owner: "Léa P.", status: "todo", dueDate: "22 mai", origin: "IDS W19" },
    { id: "td-cabine4", label: "Étudier ouverture cabine 4 le samedi matin", owner: "Marie D.", status: "todo", dueDate: "27 mai" },
  ],
  W20: [
    { id: "td-fidelite", label: "Phase 2 programme fidélité VIP", owner: "Marie D.", status: "in_progress", note: "65 clientes inscrites, bilan complet à présenter en monthly mai", dueDate: "31 mai" },
    { id: "td-stock-coffrets", label: "Réapprovisionner coffrets best-sellers", owner: "Léa P.", status: "in_progress", note: "Commande express passée mardi, livraison annoncée pour 27/05", origin: "IDS W19", dueDate: "28 mai" },
    { id: "td-cabine4", label: "Étudier ouverture cabine 4 samedi matin", owner: "Marie D.", status: "in_progress", note: "Maria d'accord pour prolonger CDD, à valider avec direction" },
    { id: "td-previsions-juin", label: "Réviser prévisions ventes juin (post Fête des mères)", owner: "Marie D.", status: "todo", dueDate: "28 mai", origin: "IDS W20" },
    { id: "td-ponts-pentecote", label: "Anticiper planning pont Pentecôte (anti no-show)", owner: "Gaëlle R.", status: "todo", dueDate: "27 mai" },
  ],
};

function todosFor(weekKey: string): TodoItem[] {
  const list = TODOS_BY_WEEK[weekKey] ?? [];
  return list.map((t) => ({ ...t }));
}

// ============================================================
// IDS — Identifier / Discuter / Solutionner (3-5 par semaine)
// ============================================================

const IDS_BY_WEEK: Record<string, IdsItem[]> = {
  W14: [
    { id: "ids-w14-1", issue: "Logiciel de caisse Orchestra plante en fin de journée", discussion: "Affecte la clôture, perte de 30 min/jour. Probablement lié à la dernière mise à jour du 28/03", solution: "Marie contacte le support éditeur lundi matin, demande patch prioritaire", resolved: false },
    { id: "ids-w14-2", issue: "Absence prolongée de Camille — cabine 2 fermée 3 jours", discussion: "Pas de remplacement trouvé via les canaux habituels, équipe sous tension", solution: "Sophie active son réseau personnel, on contacte aussi l'école Silvya Terrade", resolved: false },
    { id: "ids-w14-3", issue: "Pic de no-shows liés à la météo (orages mardi)", discussion: "5 no-shows sur 2 jours, manque à gagner ~600€", solution: "Tester SMS de rappel J-1 dès qu'on a un créneau pour le mettre en place", resolved: false },
  ],
  W15: [
    { id: "ids-w15-1", issue: "Tensions planning congés mai", discussion: "3 demandes simultanées sur la semaine 19, impossible de toutes les accorder", solution: "Réunion d'arbitrage lundi 14/04, proposer compensation jours fériés", resolved: true },
    { id: "ids-w15-2", issue: "Rupture Phytomer gamme corps", discussion: "Plus de stock depuis lundi, impossible de proposer le rituel signature", solution: "Marie relance le commercial, escalade niveau 2 si pas de réponse sous 48h", resolved: false },
    { id: "ids-w15-3", issue: "Humidité anormale cabines 2 & 3", discussion: "Praticiennes signalent un inconfort, possible problème de joints VMC", solution: "Karim fait un audit complet la semaine prochaine", resolved: false },
    { id: "ids-w15-4", issue: "Avis 5/10 d'une cliente fidèle (Mme L.)", discussion: "Plainte sur manque de personnalisation, équipe perçue comme stressée", solution: "Marie l'a appelée jeudi pour échanger, geste commercial proposé (un soin offert)", resolved: true },
  ],
  W16: [
    { id: "ids-w16-1", issue: "Audit cabine 3 confirme problème joint humidité", discussion: "Hygrométrie à 72%, hors norme. Risque inconfort + dégradation mobilier", solution: "Karim commande joint mardi, intervention prévue 22/04", resolved: false },
    { id: "ids-w16-2", issue: "Léa demande formation up-sell formelle", discussion: "Elle a du mal à proposer naturellement les add-on rituels", solution: "Marie organise 2h de coaching mardi 22/04", resolved: true },
  ],
  W17: [
    { id: "ids-w17-1", issue: "Bookings en ligne — double réservation occasionnelle", discussion: "2 cas cette semaine, le module ne synchronise pas instantanément", solution: "Ticket prio ouvert chez le prestataire booking, fix annoncé semaine prochaine", resolved: false },
    { id: "ids-w17-2", issue: "Programme fidélité actuel peu différenciant", discussion: "Bilan : seulement 12% des clientes l'utilisent. Direction valide phase 2 VIP", solution: "Marie conçoit le programme VIP pour mai (avantages exclusifs, cadeaux annivers.)", resolved: true },
  ],
  W18: [
    { id: "ids-w18-1", issue: "Affluence séminaire dépasse capacité d'accueil", discussion: "Bonne nouvelle commerciale mais 2 walk-ins refusés samedi", solution: "Maria prolonge son CDD jusqu'au 31/05 en renfort week-end", resolved: true },
    { id: "ids-w18-2", issue: "Coordination équipe x boutique perfectible", discussion: "Praticiennes oublient parfois de pousser la boutique en sortie de soin", solution: "Léa fait un mini-brief de 5 min chaque lundi sur les nouveautés boutique", resolved: true },
  ],
  W19: [
    { id: "ids-w19-1", issue: "Rupture stock coffrets cadeaux fête des mères", discussion: "Demande largement sous-estimée, 2 réfs en rupture dès vendredi", solution: "Léa passe commande express, revoir totalement les prévisions juin", resolved: false },
    { id: "ids-w19-2", issue: "Refus walk-ins créneau 11h-13h", discussion: "Récurrent : tranche horaire surchargée chaque samedi", solution: "Ouvrir cabine 4 le samedi matin si Maria prolonge — à valider en monthly", resolved: false },
  ],
  W20: [
    { id: "ids-w20-1", issue: "Stock coffrets toujours sous tension", discussion: "Livraison express prévue 27/05 mais on a perdu ~1 200€ de ventes potentielles", solution: "Marie révise les prévisions juin avec Léa avant la monthly", resolved: false },
    { id: "ids-w20-2", issue: "No-shows en hausse pendant les ponts", discussion: "Phénomène récurrent, à anticiper pour Ascension et Pentecôte", solution: "Gaëlle prépare un protocole spécifique 'période pont' avant fin mai", resolved: false },
    { id: "ids-w20-3", issue: "Léa absente 2 jours imprévus (arrêt maladie)", discussion: "Impact direct sur relances rebooking et boutique", solution: "Former Gaëlle en backup sur les relances rebook", resolved: false },
  ],
};

function idsFor(weekKey: string): IdsItem[] {
  return (IDS_BY_WEEK[weekKey] ?? []).map((i) => ({ ...i }));
}

// ============================================================
// RESPONSABILITÉS MANAGÉRIALES — justifications concrètes
// ============================================================

const RESP_BY_WEEK: Record<string, ResponsibilityScore[]> = {
  W14: [
    { axis: "Qualité & expérience client", score: "Bon", justification: "NPS en retrait mais retours globalement bons. Avis négatif géré rapidement" },
    { axis: "Suivi RH / administratif", score: "Insuffisant", justification: "Pas anticipé le remplacement de Camille assez tôt — leçon retenue" },
    { axis: "Pilotage commercial", score: "Bon", justification: "CA en baisse mais lié à des facteurs externes (météo, absence)" },
    { axis: "Technique / maintenance", score: "Bon", justification: "RAS cette semaine, audit cabines à programmer" },
    { axis: "Évaluation d'équipe", score: "Bon", justification: "Briefing quotidien tenu malgré la pression" },
  ],
  W15: [
    { axis: "Qualité & expérience client", score: "Insuffisant", justification: "NPS à 7.8/10, plainte cliente fidèle. Plan de redressement en cours" },
    { axis: "Suivi RH / administratif", score: "Bon", justification: "Arbitrage congés mai bouclé, remplacement Camille trouvé (Maria)" },
    { axis: "Pilotage commercial", score: "Bon", justification: "Rupture Phytomer freine les ventes mais hors de mon contrôle direct" },
    { axis: "Technique / maintenance", score: "Bon", justification: "Audit humidité cabines lancé suite signalements" },
    { axis: "Évaluation d'équipe", score: "Bon", justification: "Entretien individuel avec Gaëlle suite tensions, désamorcé" },
  ],
  W16: [
    { axis: "Qualité & expérience client", score: "Excellent", justification: "Opération Printemps très bien accueillie, NPS remonte à 8.6/10" },
    { axis: "Suivi RH / administratif", score: "Excellent", justification: "Maria intégrée en 2 jours, planning mai stabilisé" },
    { axis: "Pilotage commercial", score: "Bon", justification: "Reprise nette, opération Printemps performante" },
    { axis: "Technique / maintenance", score: "Bon", justification: "Audit cabines terminé, intervention planifiée" },
    { axis: "Évaluation d'équipe", score: "Excellent", justification: "Équipe ressoudée, retours positifs sur le management de crise" },
  ],
  W17: [
    { axis: "Qualité & expérience client", score: "Excellent", justification: "NPS 8.8/10, plusieurs retours sur l'écoute exceptionnelle de Gaëlle" },
    { axis: "Suivi RH / administratif", score: "Excellent", justification: "Formation Léa up-sell faite, process rebooking formalisé" },
    { axis: "Pilotage commercial", score: "Excellent", justification: "Fin de mois solide, opération Printemps prolongée par la direction" },
    { axis: "Technique / maintenance", score: "Excellent", justification: "Cabine 3 réparée, hygrométrie revenue à la norme" },
    { axis: "Évaluation d'équipe", score: "Bon", justification: "Bilan de mois fait, prépa séminaire en cours" },
  ],
  W18: [
    { axis: "Qualité & expérience client", score: "Excellent", justification: "NPS 9.1/10, meilleure semaine depuis février" },
    { axis: "Suivi RH / administratif", score: "Excellent", justification: "Séminaire équipe réussi, retours unanimes positifs" },
    { axis: "Pilotage commercial", score: "Excellent", justification: "Démarrage mai au-dessus des objectifs sur tous les KPI" },
    { axis: "Technique / maintenance", score: "Bon", justification: "RAS, maintenance préventive à jour" },
    { axis: "Évaluation d'équipe", score: "Excellent", justification: "Cohésion visible, Maria parfaitement intégrée" },
  ],
  W19: [
    { axis: "Qualité & expérience client", score: "Excellent", justification: "NPS 9.2/10, recommandations Google spontanées en hausse" },
    { axis: "Suivi RH / administratif", score: "Bon", justification: "Maria en renfort weekend, prolongation CDD à valider" },
    { axis: "Pilotage commercial", score: "Excellent", justification: "Fête des mères très performante, panier moyen +22€" },
    { axis: "Technique / maintenance", score: "Bon", justification: "Surveillance accrue avec l'affluence, RAS" },
    { axis: "Évaluation d'équipe", score: "Excellent", justification: "Équipe en pleine confiance, fierté collective" },
  ],
  W20: [
    { axis: "Qualité & expérience client", score: "Bon", justification: "NPS stable malgré la baisse d'affluence et le stress des ponts" },
    { axis: "Suivi RH / administratif", score: "Bon", justification: "Léa absente 2j imprévus, backup à prévoir" },
    { axis: "Pilotage commercial", score: "Insuffisant", justification: "Prévisions coffrets très sous-estimées, manque à gagner 1 200€. À corriger pour juin" },
    { axis: "Technique / maintenance", score: "Bon", justification: "Stocks à surveiller mais pas de souci équipement" },
    { axis: "Évaluation d'équipe", score: "Bon", justification: "Équipe a tenu malgré les ponts, fatigue légère à surveiller" },
  ],
};

function respFor(weekKey: string, templates: RespTemplate[]): ResponsibilityScore[] {
  const base = RESP_BY_WEEK[weekKey] ?? [];
  if (templates.length === 0) return base.map((r) => ({ ...r }));
  // Aligne sur les templates actifs si disponibles
  const active = templates.filter((t) => t.active).slice(0, base.length);
  if (active.length === 0) return base.map((r) => ({ ...r }));
  return active.map((t, i) => ({
    axis: t.name,
    score: base[i % base.length].score,
    justification: base[i % base.length].justification,
  }));
}

// ============================================================
// OBJECTIFS SMART mensuels
// ============================================================

const APRIL_OBJECTIVES: Array<Omit<ObjectiveItem, "progress"> & { progressByWeek: number[] }> = [
  { id: "obj-apr-1", label: "Réduire le taux de no-show de 15% d'ici fin avril", note: "Responsable : Gaëlle", progressByWeek: [10, 20, 60, 100] },
  { id: "obj-apr-2", label: "Augmenter ventes produits de 10% vs mars", note: "Responsable : Léa", progressByWeek: [5, 15, 45, 95] },
  { id: "obj-apr-3", label: "Former 100% de l'équipe sur nouvelle gamme Phytomer", note: "Responsable : Marie", progressByWeek: [25, 40, 70, 100] },
];

const MAY_OBJECTIVES: Array<Omit<ObjectiveItem, "progress"> & { progressByWeek: number[] }> = [
  { id: "obj-may-1", label: "Atteindre 80% d'occupation moyenne en mai", note: "Responsable : Marie", progressByWeek: [30, 65, 80] },
  { id: "obj-may-2", label: "Lancer programme fidélité VIP avant le 31 mai", note: "Responsable : Marie", progressByWeek: [40, 75, 85] },
  { id: "obj-may-3", label: "Réussir opération Fête des mères (+20% retail vs mai 2025)", note: "Responsable : Léa", progressByWeek: [20, 100, 100] },
];

function aprilObjectivesAt(weekIdx: number): ObjectiveItem[] {
  return APRIL_OBJECTIVES.map((o) => ({
    id: o.id,
    label: o.label,
    note: o.note,
    progress: o.progressByWeek[weekIdx] ?? 0,
  }));
}

function mayObjectivesAt(weekIdx: number): ObjectiveItem[] {
  return MAY_OBJECTIVES.map((o) => ({
    id: o.id,
    label: o.label,
    note: o.note,
    progress: o.progressByWeek[weekIdx] ?? 0,
  }));
}

// ============================================================
// ENGAGEMENTS DE CLÔTURE (qui fait quoi, pour quand)
// ============================================================

const COMMITMENTS_BY_WEEK: Record<string, Commitment[]> = {
  W14: [
    { id: "cm-w14-1", decision: "Marie contacte support Orchestra lundi pour patch caisse", owner: "Marie D." },
    { id: "cm-w14-2", decision: "Sophie active son réseau pour trouver remplacement Camille d'ici W15", owner: "Sophie M." },
    { id: "cm-w14-3", decision: "Gaëlle prépare un test SMS rappel J-1 pour W15", owner: "Gaëlle R." },
  ],
  W15: [
    { id: "cm-w15-1", decision: "Arbitrage congés mai validé en équipe lundi 14/04", owner: "Marie D." },
    { id: "cm-w15-2", decision: "Maria (CDD) commence W16, accueil par Sophie", owner: "Sophie M." },
    { id: "cm-w15-3", decision: "Karim audite cabines 2 & 3 (humidité) en W16", owner: "Karim T." },
  ],
  W16: [
    { id: "cm-w16-1", decision: "Cabine 3 réparée avant le 24/04 (commande joint)", owner: "Karim T." },
    { id: "cm-w16-2", decision: "Formation up-sell de Léa programmée mardi 22/04", owner: "Marie D." },
    { id: "cm-w16-3", decision: "Process rebooking testé sur 1 semaine, bilan en W17", owner: "Sophie M." },
  ],
  W17: [
    { id: "cm-w17-1", decision: "Bilan mois d'avril présenté en monthly 30/04", owner: "Marie D." },
    { id: "cm-w17-2", decision: "Programme fidélité VIP conçu pour lancement W18", owner: "Marie D." },
    { id: "cm-w17-3", decision: "Séminaire équipe confirmé pour le 4 mai à La Bergerie", owner: "Marie D." },
  ],
  W18: [
    { id: "cm-w18-1", decision: "Programme VIP étendu à 50 clientes en W19 si traction confirmée", owner: "Marie D." },
    { id: "cm-w18-2", decision: "Maria prolonge son CDD jusqu'au 31/05 (validation direction)", owner: "Marie D." },
    { id: "cm-w18-3", decision: "Léa briefe l'équipe sur les nouveautés boutique chaque lundi", owner: "Léa P." },
  ],
  W19: [
    { id: "cm-w19-1", decision: "Léa passe commande express coffrets cadeaux dès lundi", owner: "Léa P." },
    { id: "cm-w19-2", decision: "Étude ouverture cabine 4 le samedi matin présentée en monthly", owner: "Marie D." },
    { id: "cm-w19-3", decision: "Bilan complet phase 2 fidélité VIP en monthly mai", owner: "Marie D." },
  ],
  W20: [
    { id: "cm-w20-1", decision: "Prévisions ventes juin révisées avec Léa avant le 28/05", owner: "Marie D." },
    { id: "cm-w20-2", decision: "Protocole 'période pont' anti no-show prêt avant Pentecôte", owner: "Gaëlle R." },
    { id: "cm-w20-3", decision: "Gaëlle formée en backup rebooking pour pallier absences Léa", owner: "Sophie M." },
  ],
};

function commitmentsFor(weekKey: string): Commitment[] {
  return (COMMITMENTS_BY_WEEK[weekKey] ?? []).map((c) => ({ ...c }));
}

// ============================================================
// GÉNÉRATION KPI à partir de la storyline
// ============================================================

function kpiActualsFor(
  kpiCfg: KpiConfigItem[],
  monthKey: string,
  weekKey: string,
): KpiActual[] {
  const story = STORY[weekKey];
  if (!story) return [];

  return kpiCfg.map((k) => {
    const delta = story.delta[k.id] ?? 0;
    const target = getTarget(k, monthKey, `2026-${weekKey}`);
    const actual = withDelta(target, delta, k.unit);
    const comment = story.comments[k.id] ?? "";
    return {
      kpiId: k.id,
      name: k.name,
      unit: k.unit,
      target: round(target, k.unit),
      actual,
      comment,
    };
  });
}

function kpiActualsForMonth(
  kpiCfg: KpiConfigItem[],
  monthKey: string,
  weekKeys: string[],
): KpiActual[] {
  // Agrège la moyenne des deltas sur les semaines du mois
  return kpiCfg.map((k) => {
    const target = getTarget(k, monthKey);
    const deltas = weekKeys.map((w) => STORY[w]?.delta[k.id] ?? 0);
    const avgDelta = deltas.reduce((a, b) => a + b, 0) / Math.max(1, deltas.length);
    // Pour le CA mensuel, on somme plutôt qu'on moyenne — mais on garde la cohérence simple
    const actual = withDelta(target, avgDelta, k.unit);
    return {
      kpiId: k.id,
      name: k.name,
      unit: k.unit,
      target: round(target, k.unit),
      actual,
      comment: "",
    };
  });
}

// ============================================================
// EMPTY DETAILS (drafts)
// ============================================================

function emptyDetails(): ReportDetails {
  return {
    kpis: [],
    checkin: { mood: 0, note: "", teamWeather: "" },
    todos: [],
    objectives: [],
    responsibilities: [],
    ids: [],
    commitments: [],
  };
}

// ============================================================
// MAIN BUILDER
// ============================================================

const APRIL_WEEKS = [
  { key: "W14", label: "Weekly — Semaine 14", period: "1 → 7 avr 2026", meeting: "2 avr 2026" },
  { key: "W15", label: "Weekly — Semaine 15", period: "8 → 14 avr 2026", meeting: "9 avr 2026" },
  { key: "W16", label: "Weekly — Semaine 16", period: "15 → 21 avr 2026", meeting: "16 avr 2026" },
  { key: "W17", label: "Weekly — Semaine 17", period: "22 → 28 avr 2026", meeting: "23 avr 2026" },
];
const MAY_WEEKS = [
  { key: "W18", label: "Weekly — Semaine 18", period: "6 → 12 mai 2026", meeting: "7 mai 2026" },
  { key: "W19", label: "Weekly — Semaine 19", period: "13 → 19 mai 2026", meeting: "14 mai 2026" },
  { key: "W20", label: "Weekly — Semaine 20", period: "20 → 26 mai 2026", meeting: "21 mai 2026" },
];

export function buildDemoReports(): ReportRecord[] {
  const kpiRaw = readKpiConfig();
  const kpiCfg = kpiRaw.length > 0 ? kpiRaw : FALLBACK_KPIS;
  const templates = readRespTemplates();
  const reports: ReportRecord[] = [];

  // ── Avril hebdo (validés) ──
  APRIL_WEEKS.forEach((w, i) => {
    reports.push({
      id: `demo-${w.key.toLowerCase()}`,
      type: "weekly",
      label: w.label,
      period: w.period,
      state: "validated",
      updatedAt: w.meeting,
      meetingDate: w.meeting,
      completion: 100,
      details: {
        kpis: kpiActualsFor(kpiCfg, "2026-04", w.key),
        checkin: { ...CHECKIN[w.key] },
        todos: todosFor(w.key),
        objectives: aprilObjectivesAt(i),
        responsibilities: respFor(w.key, templates),
        ids: idsFor(w.key),
        commitments: commitmentsFor(w.key),
        nextMeeting: APRIL_WEEKS[i + 1]?.meeting ?? "30 avr 2026",
      },
    });
  });

  // ── Avril mensuel (validé) ──
  reports.push({
    id: "demo-monthly-april",
    type: "monthly",
    label: "Monthly — Avril 2026",
    period: "1 → 30 avr 2026",
    state: "validated",
    updatedAt: "30 avr 2026",
    meetingDate: "30 avr 2026",
    completion: 100,
    details: {
      kpis: kpiActualsForMonth(kpiCfg, "2026-04", ["W14", "W15", "W16", "W17"]),
      checkin: {
        mood: 8,
        note: "Mois finalement bien rattrapé. Premier vrai test de gestion de crise avec absence Camille, équipe a tenu",
        teamWeather: "🌞 Sortie de mois soleil. Bilan positif partagé en équipe, fierté collective",
      },
      todos: [
        { id: "td-recap-apr-1", label: "Valider lancement programme fidélité VIP", owner: "Marie D.", status: "done", note: "Validé par direction le 28/04, lancement prévu W18" },
        { id: "td-recap-apr-2", label: "Acter prolongation CDD Maria sur mai", owner: "Marie D.", status: "in_progress", note: "Accord verbal direction, contrat à signer début mai" },
        { id: "td-recap-apr-3", label: "Investir dans nouveau matériel cabine 3", owner: "Karim T.", status: "todo", dueDate: "31 mai", note: "Devis à présenter pour table de soin remplacement" },
      ],
      objectives: APRIL_OBJECTIVES.map((o) => ({
        id: o.id,
        label: o.label,
        note: "Objectif atteint — voir détail dans hebdos",
        progress: o.progressByWeek[3] ?? 100,
      })),
      responsibilities: respFor("W17", templates),
      ids: [
        { id: "ids-mensuel-apr-1", issue: "Mise en place programme fidélité VIP", discussion: "Phase 1 actuelle trop peu différenciante (12% d'usage). Phase 2 VIP prête", solution: "Lancement mardi 5/05 sur 20 clientes pilotes", resolved: true },
      ],
      commitments: [
        { id: "cm-mensuel-apr-1", decision: "Lancement officiel programme VIP le 5 mai", owner: "Marie D." },
        { id: "cm-mensuel-apr-2", decision: "Recrutement CDD Maria prolongé jusqu'au 31/05", owner: "Marie D." },
        { id: "cm-mensuel-apr-3", decision: "Investissement table de soin cabine 3 à étudier", owner: "Karim T." },
      ],
      nextMeeting: "7 mai 2026",
    },
  });

  // ── Mai hebdo W18-W20 (validés) ──
  MAY_WEEKS.forEach((w, i) => {
    reports.push({
      id: `demo-${w.key.toLowerCase()}`,
      type: "weekly",
      label: w.label,
      period: w.period,
      state: "validated",
      updatedAt: w.meeting,
      meetingDate: w.meeting,
      completion: 100,
      details: {
        kpis: kpiActualsFor(kpiCfg, "2026-05", w.key),
        checkin: { ...CHECKIN[w.key] },
        todos: todosFor(w.key),
        objectives: mayObjectivesAt(i),
        responsibilities: respFor(w.key, templates),
        ids: idsFor(w.key),
        commitments: commitmentsFor(w.key),
        nextMeeting: MAY_WEEKS[i + 1]?.meeting ?? "28 mai 2026",
      },
    });
  });

  // ── W21 (brouillon) ──
  reports.push({
    id: "demo-w21",
    type: "weekly",
    label: "Weekly — Semaine 21",
    period: "27 mai → 2 juin 2026",
    state: "draft_preparation",
    updatedAt: "Aujourd'hui",
    meetingDate: "28 mai 2026",
    completion: 0,
    details: emptyDetails(),
  });

  // ── Monthly mai (brouillon) ──
  reports.push({
    id: "demo-monthly-may",
    type: "monthly",
    label: "Monthly — Mai 2026",
    period: "1 → 31 mai 2026",
    state: "draft_preparation",
    updatedAt: "Aujourd'hui",
    meetingDate: "29 mai 2026",
    completion: 0,
    details: emptyDetails(),
  });

  return reports;
}

export function hasExistingReportsData(): boolean {
  return hasStoredReports();
}

export function seedDemoData(): void {
  setReports(buildDemoReports());
}

export { REPORTS_STORAGE_KEY };
