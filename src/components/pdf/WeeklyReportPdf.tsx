import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type {
  WeeklyPdfData,
  WeeklyPdfResponsibility,
  WeeklyPdfTodoDone,
  WeeklyPdfTodoActive,
  WeeklyPdfTodoDeferred,
  WeeklyPdfObjective,
  WeeklyPdfProblem,
  WeeklyPdfCommitment,
} from "@/hooks/useWeeklyPdfData";

/* =========================================================================
 * CHARTE GRAPHIQUE — la couleur encode le SENS, pas la décoration.
 *  - Teal (marque)      = STRUCTURE / navigation (bandeaux de section).
 *  - Échelle de statut  = SENS (crit / warn / ok / neutral), partout pareille.
 *  - Neutres            = TEXTE & CATÉGORIES (rôle, type, fréquence…).
 *  - Encadré + barre teal = TEXTE NARRATIF (synthèse, notes), jamais de fond vif.
 * ========================================================================= */

// Marque / structure
const BRAND = "#0F766E"; // teal 700 — bandeaux de section, repères
const BRAND_DARK = "#115E59"; // teal 800 — header + footer
const BRAND_TINT = "#F0FDFA"; // teal 50 — fond sous-section
const BRAND_ACCENT = "#5EEAD4"; // teal 300 — bande déco

// Échelle de statut (bg + texte)
const CRIT_BG = "#FEE2E2";
const CRIT_TXT = "#B91C1C";
const WARN_BG = "#FEF3C7";
const WARN_TXT = "#B45309";
const OK_BG = "#DCFCE7";
const OK_TXT = "#15803D";
const NEU_BG = "#F3F4F6";
const NEU_TXT = "#6B7280";

// Neutres (texte & données)
const INK = "#111827";
const INK_SUB = "#6B7280";
const LINE = "#E5E7EB";
const ZEBRA = "#F9FAFB";
const WHITE = "#FFFFFF";

type StatusLevel = "crit" | "warn" | "ok" | "neutral";
const STATUS: Record<StatusLevel, { bg: string; text: string }> = {
  crit: { bg: CRIT_BG, text: CRIT_TXT },
  warn: { bg: WARN_BG, text: WARN_TXT },
  ok: { bg: OK_BG, text: OK_TXT },
  neutral: { bg: NEU_BG, text: NEU_TXT },
};

const VERDICT_META: Record<string, { label: string; level: StatusLevel }> = {
  red: { label: "ATTENTION REQUISE", level: "crit" },
  amber: { label: "VIGILANCE", level: "warn" },
  green: { label: "RAS — TOUT EST À JOUR", level: "ok" },
};

const SEVERITY_ORDER = ["bloquant", "deleguer", "priorite", "veille", "untriaged"] as const;
const SEVERITY_META: Record<string, { label: string; level: StatusLevel }> = {
  bloquant: { label: "Bloquant", level: "crit" },
  deleguer: { label: "À déléguer", level: "warn" },
  priorite: { label: "Priorité", level: "warn" },
  veille: { label: "Veille", level: "neutral" },
  untriaged: { label: "À trier", level: "neutral" },
};

const NIVEAU_ORDER = ["prioritaire", "secondaire", "autres"] as const;
const NIVEAU_LABEL: Record<string, string> = {
  prioritaire: "Principaux",
  secondaire: "Secondaires",
  autres: "Autres",
};
const niveauBucket = (n: string | null): string =>
  n === "prioritaire" ? "prioritaire" : n === "secondaire" ? "secondaire" : "autres";

const ROLE_LABEL: Record<string, string> = {
  spa_manager: "Manager",
  therapist: "Thérapeute",
  spa_concierge: "Concierge",
  ambassador: "Ambassadeur",
};

function kpiStatus(status: string): { level: StatusLevel; label: string } {
  switch (status) {
    case "excellent": return { level: "ok", label: "Excellent" };
    case "green": return { level: "ok", label: "Bien" };
    case "amber": return { level: "warn", label: "Correct" };
    case "red": return { level: "crit", label: "Insuffisant" };
    default: return { level: "neutral", label: "N/A" };
  }
}

function objStatus(s: string): { level: StatusLevel; label: string } {
  switch (s) {
    case "on_track": return { level: "ok", label: "En cours" };
    case "at_risk": return { level: "warn", label: "À risque" };
    case "behind": return { level: "crit", label: "En retard" };
    default: return { level: "neutral", label: "—" };
  }
}

function pctLevel(p: number | null): StatusLevel {
  if (p === null) return "neutral";
  return p >= 80 ? "ok" : p >= 50 ? "warn" : "crit";
}

function moodLabel(score: number): string {
  if (score <= 1) return "Tres bas";
  if (score === 2) return "Bas";
  if (score === 3) return "Moyen";
  if (score === 4) return "Bon";
  return "Excellent";
}

function formatDateFr(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 0,
    paddingBottom: 42,
    paddingHorizontal: 0,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: INK,
  },
  body: { paddingHorizontal: 30, paddingTop: 12 },

  // Header
  header: {
    backgroundColor: BRAND_DARK,
    padding: 20,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  headerTitle: { color: WHITE, fontSize: 18, fontFamily: "Helvetica-Bold" },
  headerSub: { color: WHITE, fontSize: 10, opacity: 0.85, marginTop: 2 },
  headerRight: { textAlign: "right" },
  headerLabel: { color: WHITE, fontSize: 14, fontFamily: "Helvetica-Bold" },
  decoBand: { height: 4, backgroundColor: BRAND_ACCENT },

  // Verdict
  verdictBand: {
    paddingVertical: 8,
    paddingHorizontal: 30,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  verdictLabel: { fontSize: 11, fontFamily: "Helvetica-Bold", letterSpacing: 0.5 },
  verdictCounts: { fontSize: 8.5, fontFamily: "Helvetica-Bold" },

  // Section (structure)
  section: { marginTop: 14 },
  sectionHeader: {
    backgroundColor: BRAND,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 3,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    color: WHITE,
    fontSize: 9.5,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sectionHint: { color: WHITE, fontSize: 7.5, opacity: 0.85 },

  // Sous-section (groupe : niveau KPI…)
  subHeader: {
    marginTop: 6,
    marginBottom: 2,
    paddingVertical: 3,
    paddingHorizontal: 8,
    backgroundColor: BRAND_TINT,
    borderLeftWidth: 3,
    borderLeftColor: BRAND,
    borderRadius: 2,
  },
  subHeaderText: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: BRAND,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },

  // Encadré narratif
  narr: {
    marginTop: 8,
    padding: 9,
    backgroundColor: ZEBRA,
    borderLeftWidth: 3,
    borderLeftColor: BRAND,
    borderRadius: 3,
  },
  narrLabel: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: BRAND,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  narrBody: { marginTop: 5, fontSize: 8.5, lineHeight: 1.4, color: INK },
  narrSubLabel: { marginTop: 6, fontSize: 7.5, fontFamily: "Helvetica-Bold", color: BRAND },
  narrItem: { fontSize: 7.5, color: INK, marginTop: 2 },

  // Chips
  chip: { paddingVertical: 2, paddingHorizontal: 6, borderRadius: 3, alignSelf: "flex-start" },
  chipText: { fontSize: 7, fontFamily: "Helvetica-Bold" },
  tag: {
    paddingVertical: 1,
    paddingHorizontal: 5,
    borderRadius: 8,
    backgroundColor: NEU_BG,
    marginLeft: 5,
  },
  tagText: { fontSize: 6.5, fontFamily: "Helvetica-Bold", color: NEU_TXT },

  rowFlex: { flexDirection: "row", alignItems: "center" },

  // Problèmes (page 1)
  sevGroup: { marginBottom: 3 },
  sevChipWrap: { marginTop: 4, marginBottom: 2 },
  sevRow: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 1.5, paddingLeft: 8 },
  sevText: { flex: 1, fontSize: 8.5, color: INK, lineHeight: 1.3 },
  sevAction: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: BRAND, marginLeft: 6 },
  sevActionNone: { fontSize: 7.5, fontFamily: "Helvetica-Oblique", color: INK_SUB, marginLeft: 6 },

  // Engagements (page 1)
  commitGroup: { borderRadius: 4, overflow: "hidden", marginTop: 5, borderWidth: 0.5, borderColor: LINE },
  commitGroupHeader: { paddingVertical: 4, paddingHorizontal: 8 },
  commitGroupTitle: { fontSize: 8.5, fontFamily: "Helvetica-Bold" },
  commitRow: { paddingVertical: 4, paddingHorizontal: 8, borderTopWidth: 0.5, borderTopColor: LINE },
  commitTitle: { flex: 1, fontSize: 8.5, color: INK },
  commitMeta: { fontSize: 7.5, color: INK_SUB, marginTop: 1 },
  commitLate: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: CRIT_TXT, marginTop: 1 },

  // Annexe
  annexe: { marginTop: 16 },
  annexeHeader: { borderTopWidth: 2, borderTopColor: BRAND, paddingTop: 8 },
  annexeTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: BRAND,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  annexeSub: { fontSize: 8, color: INK_SUB, marginTop: 2 },

  // Tables
  tableHeader: { flexDirection: "row", backgroundColor: ZEBRA, paddingVertical: 4, paddingHorizontal: 8, marginTop: 2 },
  th: { fontSize: 7, fontFamily: "Helvetica-Bold", color: INK_SUB, textTransform: "uppercase" },
  row: { flexDirection: "row", paddingVertical: 4, paddingHorizontal: 8, alignItems: "center", borderBottomWidth: 0.5, borderBottomColor: LINE },
  cellName: { flex: 3, fontSize: 8, color: INK },
  cellRole: { flex: 1.4, flexDirection: "row" },
  cellVal: { flex: 1, fontSize: 8, fontFamily: "Helvetica-Bold", color: INK },
  cellTarget: { flex: 1, fontSize: 8, color: INK_SUB },
  cellChip: { flex: 1.6, flexDirection: "row", alignItems: "center" },

  // Objectifs
  objRow: { flexDirection: "row", paddingVertical: 5, paddingHorizontal: 8, borderBottomWidth: 0.5, borderBottomColor: LINE, alignItems: "flex-start" },
  objLeft: { flex: 3 },
  objTitle: { fontSize: 8, fontFamily: "Helvetica-Bold", color: INK },
  objMeta: { fontSize: 7, color: INK_SUB, marginTop: 1 },
  objComment: { fontSize: 7, color: INK_SUB, fontFamily: "Helvetica-Oblique", marginTop: 2 },
  objProg: { flex: 2, flexDirection: "row", alignItems: "center", paddingTop: 1 },
  objBar: { flex: 1, height: 5, borderRadius: 3, backgroundColor: LINE, overflow: "hidden", marginRight: 4 },
  objPct: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: INK, width: 26, textAlign: "right" },
  objStatusWrap: { flex: 1.4, flexDirection: "row", justifyContent: "flex-end", paddingTop: 1 },

  // Responsabilités
  respRow: { flexDirection: "row", paddingVertical: 4, paddingHorizontal: 8, alignItems: "center", borderBottomWidth: 0.5, borderBottomColor: LINE },
  respTitle: { flex: 3, fontSize: 8, color: INK },
  respFreq: { flex: 1.2, flexDirection: "row" },
  respCount: { flex: 1.6, fontSize: 7.5, color: INK_SUB },
  respPct: { flex: 1, fontSize: 9, fontFamily: "Helvetica-Bold", textAlign: "right" },
  respEmpty: { fontSize: 8, color: INK_SUB, fontFamily: "Helvetica-Oblique", marginTop: 6, paddingHorizontal: 8 },

  // IDS (annexe)
  idsRow: { flexDirection: "row", alignItems: "center", paddingVertical: 3, paddingHorizontal: 8, borderBottomWidth: 0.5, borderBottomColor: LINE },
  idsText: { flex: 1, fontSize: 8, color: INK },

  // Équipe
  teamRow: { flexDirection: "row", alignItems: "center", marginTop: 2 },
  teamMeteo: { fontSize: 9, color: BRAND, fontFamily: "Helvetica-Bold" },
  teamScore: { fontSize: 9, fontFamily: "Helvetica-Bold", color: INK, marginLeft: 6 },

  // Suivi des actions
  actGroup: { marginTop: 5, borderRadius: 4, overflow: "hidden", borderWidth: 0.5, borderColor: LINE },
  actGroupHeader: { paddingVertical: 4, paddingHorizontal: 8 },
  actGroupTitle: { fontSize: 8, fontFamily: "Helvetica-Bold" },
  actItem: { paddingVertical: 4, paddingHorizontal: 8, borderTopWidth: 0.5, borderTopColor: LINE },
  actTitle: { fontSize: 8, color: INK },
  actMeta: { fontSize: 7, color: INK_SUB, marginTop: 1 },
  actReason: { fontSize: 7, color: INK_SUB, fontFamily: "Helvetica-Oblique", marginTop: 1 },

  emptyRow: { paddingVertical: 5, paddingHorizontal: 8 },
  emptyText: { fontSize: 8, color: INK_SUB, fontFamily: "Helvetica-Oblique" },

  // Footer
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: BRAND_DARK,
    paddingVertical: 8,
    paddingHorizontal: 30,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: { color: WHITE, fontSize: 7 },
});

// --- Petits composants réutilisables (cohérence visuelle) ---
const Chip = ({ level, label }: { level: StatusLevel; label: string }) => (
  <View style={[styles.chip, { backgroundColor: STATUS[level].bg }]}>
    <Text style={[styles.chipText, { color: STATUS[level].text }]}>{label}</Text>
  </View>
);

const Tag = ({ label, first = false }: { label: string; first?: boolean }) => (
  <View style={[styles.tag, first ? { marginLeft: 0 } : {}]}>
    <Text style={styles.tagText}>{label}</Text>
  </View>
);

const SectionHeader = ({ title, hint }: { title: string; hint?: string }) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {hint ? <Text style={styles.sectionHint}>{hint}</Text> : null}
  </View>
);

interface Props {
  data: WeeklyPdfData;
}

export function WeeklyReportPdf({ data }: Props) {
  const verdict = VERDICT_META[data.verdict.level];
  const verdictColors = STATUS[verdict.level];
  const verdictParts: string[] = [];
  if (data.verdict.blocking > 0)
    verdictParts.push(data.verdict.blocking + " bloquant" + (data.verdict.blocking > 1 ? "s" : ""));
  if (data.verdict.overdue > 0)
    verdictParts.push(
      data.verdict.overdue + " engagement" + (data.verdict.overdue > 1 ? "s" : "") + " en retard",
    );
  if (data.verdict.atRisk > 0) verdictParts.push(data.verdict.atRisk + " à risque");
  const verdictCounts =
    verdictParts.length > 0
      ? verdictParts.join("    ·    ")
      : "Aucun bloquant, aucun engagement en retard";

  const hasActions =
    data.todosDone.length > 0 || data.todosActive.length > 0 || data.todosDeferred.length > 0;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* HEADER */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>SPA OMS</Text>
            <Text style={styles.headerSub}>{data.spaName}</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.headerLabel}>{data.reportLabel}</Text>
            <Text style={styles.headerSub}>{data.reportPeriod}</Text>
          </View>
        </View>
        <View style={styles.decoBand} />

        {/* VERDICT DE LA SEMAINE (scan rapide multi-spa) */}
        <View style={[styles.verdictBand, { backgroundColor: verdictColors.bg }]}>
          <Text style={[styles.verdictLabel, { color: verdictColors.text }]}>{verdict.label}</Text>
          <Text style={[styles.verdictCounts, { color: verdictColors.text }]}>{verdictCounts}</Text>
        </View>

        <View style={styles.body}>
          {/* ===================== PAGE 1 — SYNTHÈSE DIRECTION ===================== */}

          {/* Synthèse IA (narratif) */}
          {data.executiveSummary ? (
            <View style={styles.narr}>
              <Text style={styles.narrLabel}>Synthèse</Text>
              <Text style={styles.narrBody}>{data.executiveSummary}</Text>
              {data.keyActions.length > 0 ? (
                <>
                  <Text style={styles.narrSubLabel}>Actions clés :</Text>
                  {data.keyActions.map((a, i) => (
                    <Text key={i} style={styles.narrItem}>{"-> " + a}</Text>
                  ))}
                </>
              ) : null}
            </View>
          ) : null}

          {/* Problèmes de la semaine (par gravité) */}
          {data.problems.length > 0 ? (
            <View style={styles.section}>
              <SectionHeader
                title="Problèmes de la semaine"
                hint={data.problems.length + " signalé" + (data.problems.length > 1 ? "s" : "") + " · par gravité"}
              />
              {SEVERITY_ORDER.map((sev) => {
                const group = data.problems.filter((p) => p.severity === sev);
                if (group.length === 0) return null;
                const meta = SEVERITY_META[sev];
                return (
                  <View key={sev} style={styles.sevGroup}>
                    <View style={styles.sevChipWrap}>
                      <Chip level={meta.level} label={meta.label + " (" + group.length + ")"} />
                    </View>
                    {group.map((p: WeeklyPdfProblem, i: number) => (
                      <View key={i} style={styles.sevRow}>
                        <Text style={styles.sevText}>{"- " + p.text}</Text>
                        {p.action ? (
                          <Text style={styles.sevAction}>{"-> " + p.action}</Text>
                        ) : (
                          <Text style={styles.sevActionNone}>non qualifié</Text>
                        )}
                      </View>
                    ))}
                  </View>
                );
              })}
            </View>
          ) : null}

          {/* Engagements non tenus */}
          {data.commitmentsOverdue.length > 0 || data.commitmentsAtRisk.length > 0 ? (
            <View style={styles.section}>
              <SectionHeader title="Engagements non tenus" hint="à terminer d'ici cette semaine" />

              {data.commitmentsOverdue.length > 0 ? (
                <View style={styles.commitGroup}>
                  <View style={[styles.commitGroupHeader, { backgroundColor: CRIT_BG }]}>
                    <Text style={[styles.commitGroupTitle, { color: CRIT_TXT }]}>
                      {"En retard (" + data.commitmentsOverdue.length + ")"}
                    </Text>
                  </View>
                  {data.commitmentsOverdue.map((c: WeeklyPdfCommitment, i: number) => (
                    <View key={i} style={styles.commitRow}>
                      <View style={styles.rowFlex}>
                        <Tag label={c.kind === "objective" ? "OBJECTIF" : "TO-DO"} first />
                        <Text style={styles.commitTitle}>{c.title}</Text>
                        {c.deferredCount > 0 ? <Chip level="warn" label={"Reporté " + c.deferredCount + "x"} /> : null}
                      </View>
                      <Text style={styles.commitMeta}>
                        {(c.responsible ? c.responsible + " · " : "") + "prévu le " + c.dueLabel + (c.detail ? " · " + c.detail : "")}
                      </Text>
                      {c.lateDays > 0 ? (
                        <Text style={styles.commitLate}>
                          {"+ " + c.lateDays + " jour" + (c.lateDays > 1 ? "s" : "") + " de retard"}
                        </Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              ) : null}

              {data.commitmentsAtRisk.length > 0 ? (
                <View style={[styles.commitGroup, { marginTop: 6 }]}>
                  <View style={[styles.commitGroupHeader, { backgroundColor: WARN_BG }]}>
                    <Text style={[styles.commitGroupTitle, { color: WARN_TXT }]}>
                      {"À risque — à terminer cette semaine (" + data.commitmentsAtRisk.length + ")"}
                    </Text>
                  </View>
                  {data.commitmentsAtRisk.map((c: WeeklyPdfCommitment, i: number) => (
                    <View key={i} style={styles.commitRow}>
                      <View style={styles.rowFlex}>
                        <Tag label={c.kind === "objective" ? "OBJECTIF" : "TO-DO"} first />
                        <Text style={styles.commitTitle}>{c.title}</Text>
                        {c.deferredCount > 0 ? <Chip level="warn" label={"Reporté " + c.deferredCount + "x"} /> : null}
                      </View>
                      <Text style={styles.commitMeta}>
                        {(c.responsible ? c.responsible + " · " : "") + "échéance le " + c.dueLabel + (c.detail ? " · " + c.detail : "")}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}

          {/* ===================== ANNEXE — DÉTAIL OPÉRATIONNEL ===================== */}
          <View style={styles.annexe} break>
            <View style={styles.annexeHeader}>
              <Text style={styles.annexeTitle}>Annexe — détail opérationnel</Text>
              <Text style={styles.annexeSub}>
                Indicateurs (par priorité), responsabilités, équipe, objectifs et actions complètes
              </Text>
            </View>
          </View>

          {/* INDICATEURS — hiérarchisés par niveau */}
          <View style={styles.section}>
            <SectionHeader title="Indicateurs" hint="par priorité" />
            {data.kpis.length === 0 ? (
              <View style={styles.emptyRow}>
                <Text style={styles.emptyText}>Aucun KPI saisi.</Text>
              </View>
            ) : (
              NIVEAU_ORDER.map((niv) => {
                const group = data.kpis.filter((k) => niveauBucket(k.niveau) === niv);
                if (group.length === 0) return null;
                return (
                  <View key={niv}>
                    <View style={styles.subHeader}>
                      <Text style={styles.subHeaderText}>{NIVEAU_LABEL[niv]}</Text>
                    </View>
                    <View style={styles.tableHeader}>
                      <Text style={[styles.th, { flex: 3 }]}>KPI</Text>
                      <Text style={[styles.th, { flex: 1.4 }]}>Rôle</Text>
                      <Text style={[styles.th, { flex: 1 }]}>Valeur</Text>
                      <Text style={[styles.th, { flex: 1 }]}>Objectif</Text>
                      <Text style={[styles.th, { flex: 1.6 }]}>Palier</Text>
                    </View>
                    {group.map((k, i) => {
                      const st = kpiStatus(k.status);
                      return (
                        <View key={i} style={[styles.row, i % 2 === 1 ? { backgroundColor: ZEBRA } : {}]}>
                          <Text style={styles.cellName}>
                            {k.name}{k.unit ? " (" + k.unit + ")" : ""}
                          </Text>
                          <View style={styles.cellRole}>
                            {k.role ? <Tag label={ROLE_LABEL[k.role] ?? k.role} first /> : null}
                          </View>
                          <Text style={styles.cellVal}>{k.value !== null ? String(k.value) : "—"}</Text>
                          <Text style={styles.cellTarget}>{k.target !== null ? String(k.target) : "—"}</Text>
                          <View style={styles.cellChip}>
                            <Chip level={st.level} label={st.label} />
                          </View>
                        </View>
                      );
                    })}
                  </View>
                );
              })
            )}
          </View>

          {/* RESPONSABILITÉS */}
          {data.responsibilities.length > 0 ? (
            <View style={styles.section}>
              <SectionHeader title="Responsabilités" />
              <View style={styles.tableHeader}>
                <Text style={[styles.th, { flex: 3 }]}>Tâche</Text>
                <Text style={[styles.th, { flex: 1.2 }]}>Fréquence</Text>
                <Text style={[styles.th, { flex: 1.6 }]}>Réalisé</Text>
                <Text style={[styles.th, { flex: 1, textAlign: "right" }]}>Taux</Text>
              </View>
              {data.responsibilities.map((r: WeeklyPdfResponsibility, i: number) => (
                <View key={i} style={[styles.respRow, i % 2 === 1 ? { backgroundColor: ZEBRA } : {}]}>
                  <Text style={styles.respTitle}>{r.title}</Text>
                  <View style={styles.respFreq}>
                    <Tag label={r.frequency === "daily" ? "Journalier" : "Hebdo"} first />
                  </View>
                  <Text style={styles.respCount}>
                    {r.actualCount !== null ? `${r.actualCount} / ${r.weeklyExpected}` : `— / ${r.weeklyExpected}`} cette semaine
                  </Text>
                  <Text style={[styles.respPct, { color: STATUS[pctLevel(r.completionRate)].text }]}>
                    {r.completionRate !== null ? `${r.completionRate}%` : "—%"}
                  </Text>
                </View>
              ))}
              {data.responsibilities.every((r) => r.actualCount === null) ? (
                <Text style={styles.respEmpty}>Aucune donnée saisie cette semaine</Text>
              ) : null}
            </View>
          ) : null}

          {/* ÉQUIPE */}
          <View style={styles.section}>
            <SectionHeader title="Équipe" />
            <View style={styles.narr}>
              <View style={styles.teamRow}>
                <Text style={styles.teamMeteo}>Météo : {moodLabel(data.moodScore)}</Text>
                <Text style={styles.teamScore}>{data.moodScore} / 5</Text>
              </View>
              <Text style={styles.narrBody}>
                {data.teamNote || "Aucun commentaire cette semaine."}
              </Text>
            </View>
          </View>

          {/* PROBLÈMES IDENTIFIÉS (IDS) */}
          {data.ids.length > 0 ? (
            <View style={styles.section}>
              <SectionHeader
                title="Problèmes identifiés (IDS)"
                hint={data.ids.length + " capturé" + (data.ids.length > 1 ? "s" : "")}
              />
              {data.ids.map((it, i) => (
                <View key={i} style={[styles.idsRow, i % 2 === 1 ? { backgroundColor: ZEBRA } : {}]}>
                  <Text style={styles.idsText}>{"- " + it.text}</Text>
                  {it.convertedToTodo ? (
                    <Tag label="-> To-do" />
                  ) : it.convertedToObjectif ? (
                    <Tag label="-> Objectif" />
                  ) : (
                    <Chip level="neutral" label="À traiter" />
                  )}
                </View>
              ))}
            </View>
          ) : null}

          {/* OBJECTIFS (à la fin) */}
          {data.objectives.length > 0 ? (
            <View style={styles.section}>
              <SectionHeader
                title="Objectifs"
                hint={data.objectives.length + " actif" + (data.objectives.length > 1 ? "s" : "")}
              />
              {data.objectives.map((o: WeeklyPdfObjective, i: number) => {
                const st = objStatus(o.status_ui);
                const barLevel: StatusLevel = o.progress >= 100 ? "ok" : o.progress >= 70 ? "warn" : "crit";
                return (
                  <View key={i} style={[styles.objRow, i % 2 === 1 ? { backgroundColor: ZEBRA } : {}]}>
                    <View style={styles.objLeft}>
                      <Text style={styles.objTitle}>{o.title}</Text>
                      {o.metric ? (
                        <Text style={styles.objMeta}>
                          {o.metric}
                          {o.unit ? " (" + o.unit + ")" : ""}
                          {" — Cible : " + o.target + (o.unit ? " " + o.unit : "")}
                          {" — Actuel : " + o.current}
                          {o.targetDate ? " — Échéance : " + formatDateFr(o.targetDate) : ""}
                        </Text>
                      ) : null}
                      {o.comment ? <Text style={styles.objComment}>{o.comment}</Text> : null}
                    </View>
                    <View style={styles.objProg}>
                      <View style={styles.objBar}>
                        <View style={{ width: o.progress + "%", height: "100%", backgroundColor: STATUS[barLevel].text, borderRadius: 3 }} />
                      </View>
                      <Text style={styles.objPct}>{o.progress}%</Text>
                    </View>
                    <View style={styles.objStatusWrap}>
                      <Chip level={st.level} label={st.label} />
                    </View>
                  </View>
                );
              })}
            </View>
          ) : null}

          {/* SUIVI DES ACTIONS (à la fin) */}
          {hasActions ? (
            <View style={styles.section}>
              <SectionHeader title="Suivi des actions" />

              {data.todosDone.length > 0 ? (
                <View style={styles.actGroup}>
                  <View style={[styles.actGroupHeader, { backgroundColor: OK_BG }]}>
                    <Text style={[styles.actGroupTitle, { color: OK_TXT }]}>
                      {"Fait cette semaine (" + data.todosDone.length + ")"}
                    </Text>
                  </View>
                  {data.todosDone.map((t: WeeklyPdfTodoDone, i: number) => (
                    <View key={i} style={styles.actItem}>
                      <View style={styles.rowFlex}>
                        <Text style={styles.actTitle}>{t.title}</Text>
                        {t.source === "ids_conversion" ? <Tag label="IDS" /> : t.source === "ai_suggestion" ? <Tag label="IA" /> : null}
                      </View>
                      <Text style={styles.actMeta}>
                        {t.responsible}{t.deadline ? " · " + t.deadline : ""}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {data.todosActive.length > 0 ? (
                <View style={styles.actGroup}>
                  <View style={[styles.actGroupHeader, { backgroundColor: NEU_BG }]}>
                    <Text style={[styles.actGroupTitle, { color: INK }]}>
                      {"En cours / à traiter (" + data.todosActive.length + ")"}
                    </Text>
                  </View>
                  {data.todosActive.map((t: WeeklyPdfTodoActive, i: number) => (
                    <View key={i} style={styles.actItem}>
                      <View style={styles.rowFlex}>
                        <Text style={[styles.actTitle, t.isOverdue ? { color: CRIT_TXT } : {}]}>{t.title}</Text>
                        {t.status === "in_progress" ? <Tag label="En cours" /> : null}
                        {t.isOverdue ? <Chip level="crit" label="En retard" /> : null}
                        {t.source === "ids_conversion" ? <Tag label="IDS" /> : null}
                      </View>
                      <Text style={styles.actMeta}>
                        {t.responsible}{t.deadline ? " · échéance " + t.deadline : ""}
                      </Text>
                      {t.reason && t.reason.trim().length > 0 ? (
                        <Text style={styles.actReason}>{"Motif : " + t.reason}</Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              ) : null}

              {data.todosDeferred.length > 0 ? (
                <View style={styles.actGroup}>
                  <View style={[styles.actGroupHeader, { backgroundColor: WARN_BG }]}>
                    <Text style={[styles.actGroupTitle, { color: WARN_TXT }]}>
                      {"Reportées (" + data.todosDeferred.length + ")"}
                    </Text>
                  </View>
                  {data.todosDeferred.map((t: WeeklyPdfTodoDeferred, i: number) => (
                    <View key={i} style={styles.actItem}>
                      <View style={styles.rowFlex}>
                        <Text style={styles.actTitle}>{t.title}</Text>
                        <Chip level="warn" label={"Reporté " + t.deferredCount + "x"} />
                        {t.source === "ids_conversion" ? <Tag label="IDS" /> : null}
                      </View>
                      <Text style={styles.actMeta}>
                        {t.responsible}
                        {t.originalDeadline ? " · prévu " + t.originalDeadline : ""}
                        {t.newDeadline ? " -> reporté au " + t.newDeadline : ""}
                      </Text>
                      {t.reason && t.reason.trim().length > 0 ? (
                        <Text style={styles.actReason}>{"Raison : " + t.reason}</Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}

          {/* NOTES */}
          {data.freeNote && data.freeNote.trim().length > 0 ? (
            <View style={styles.section}>
              <SectionHeader title="Notes" />
              <View style={styles.narr}>
                <Text style={styles.narrBody}>{data.freeNote}</Text>
              </View>
            </View>
          ) : null}
        </View>

        {/* FOOTER */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Genere le {data.generatedAt}</Text>
          <Text style={[styles.footerText, { textAlign: "center" }]}>{data.managerName}</Text>
          <Text style={styles.footerText}>spa-flow-pilot.lovable.app</Text>
        </View>
      </Page>
    </Document>
  );
}
