import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { WeeklyPdfData, WeeklyPdfTodoDone, WeeklyPdfTodoActive, WeeklyPdfTodoDeferred } from "@/hooks/useWeeklyPdfData";

const TEAL_DARK = "#006B6B";
const TEAL_LIGHT = "#E0F4F4";
const TEAL_FOOTER = "#004F4F";
const PURPLE_BG = "#EDE9FE";
const PURPLE_TEXT = "#7C3AED";
const YELLOW_BG = "#FEF9C3";
const YELLOW_TEXT = "#B45309";
const MINT_BG = "#DCFCE7";
const MINT_TEXT = "#16A34A";
const BLUE_BG = "#DBEAFE";
const BLUE_TEXT = "#1D4ED8";
const EXCELLENT = "#047857";
const BIEN = "#10B981";
const CORRECT = "#F59E0B";
const INSUFFISANT = "#EF4444";
const TEXT_DARK = "#111827";
const TEXT_MUTED = "#6B7280";
const WHITE = "#FFFFFF";
const AMBER_BG = "#FFF7ED";
const AMBER_TEXT = "#C2410C";

const styles = StyleSheet.create({
  page: {
    paddingTop: 0,
    paddingBottom: 40,
    paddingHorizontal: 0,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: TEXT_DARK,
  },
  body: { paddingHorizontal: 30, paddingTop: 12 },
  header: {
    backgroundColor: TEAL_DARK,
    padding: 20,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  headerTitle: { color: WHITE, fontSize: 18, fontFamily: "Helvetica-Bold" },
  headerSub: { color: WHITE, fontSize: 10, opacity: 0.85, marginTop: 2 },
  headerRight: { textAlign: "right" },
  headerLabel: { color: WHITE, fontSize: 14, fontFamily: "Helvetica-Bold" },
  decoBand: { height: 4, backgroundColor: "#00A3A3" },

  sectionWrap: { marginTop: 10 },
  sectionHeader: {
    backgroundColor: TEAL_DARK,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 4,
    marginBottom: 6,
  },
  sectionHeaderText: {
    color: WHITE,
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
  },

  synth: {
    marginTop: 10,
    padding: 10,
    backgroundColor: TEAL_LIGHT,
    borderLeftWidth: 4,
    borderLeftColor: TEAL_DARK,
    borderRadius: 4,
  },
  synthTitle: {
    fontSize: 8,
    color: TEAL_DARK,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
  },
  synthBody: { marginTop: 6, fontSize: 8.5, lineHeight: 1.4, color: TEXT_DARK },
  synthActionsTitle: { marginTop: 6, fontSize: 7.5, color: TEAL_DARK, fontFamily: "Helvetica-Bold" },
  synthAction: { fontSize: 7.5, color: TEXT_DARK, marginTop: 2 },

  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#F3F4F6",
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  tableHeaderCell: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: TEXT_MUTED,
    textTransform: "uppercase",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 6,
    alignItems: "center",
  },
  cellName: { flex: 3, fontSize: 8, color: TEXT_DARK },
  cellValue: { flex: 1, fontSize: 8, fontFamily: "Helvetica-Bold", color: TEXT_DARK },
  cellTarget: { flex: 1, fontSize: 8, color: TEXT_MUTED },
  cellBadge: { flex: 1.5, flexDirection: "row" },

  badge: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 10,
    alignSelf: "flex-start",
  },
  badgeText: { color: WHITE, fontSize: 7, fontFamily: "Helvetica-Bold" },

  teamBox: {
    marginTop: 8,
    backgroundColor: PURPLE_BG,
    padding: 10,
    borderRadius: 6,
  },
  teamRow: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  teamScore: { fontSize: 10, fontFamily: "Helvetica-Bold", color: PURPLE_TEXT, marginLeft: 6 },
  teamNote: { marginTop: 6, fontSize: 8, color: TEXT_DARK, lineHeight: 1.4 },

  idsBox: { marginTop: 8, backgroundColor: YELLOW_BG, padding: 10, borderRadius: 6 },
  idsRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  idsText: { flex: 1, fontSize: 8, color: TEXT_DARK },

  pill: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 10,
    marginLeft: 4,
  },
  pillText: { fontSize: 7, fontFamily: "Helvetica-Bold" },

  todoBox: { marginTop: 8, backgroundColor: MINT_BG, padding: 10, borderRadius: 6 },
  todoItem: { marginTop: 4 },
  todoTitle: { fontSize: 8, color: TEXT_DARK },
  todoMeta: { fontSize: 7, color: TEXT_MUTED, marginTop: 1 },

  notesBox: { marginTop: 8, backgroundColor: BLUE_BG, padding: 10, borderRadius: 6 },
  notesText: { marginTop: 6, fontSize: 8, color: TEXT_DARK, lineHeight: 1.4 },

  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: TEAL_FOOTER,
    paddingVertical: 8,
    paddingHorizontal: 30,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: { color: WHITE, fontSize: 7 },
  actionsWrap: {
    marginTop: 8,
    borderRadius: 6,
    overflow: "hidden",
  },
  actionsGroupHeader: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  actionsGroupTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    marginLeft: 4,
  },
  actionItem: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  actionTitle: { fontSize: 8, color: TEXT_DARK },
  actionMeta: { fontSize: 7, color: TEXT_MUTED, marginTop: 1 },
  actionReason: {
    fontSize: 7,
    color: AMBER_TEXT,
    fontFamily: "Helvetica-Oblique",
    marginTop: 1,
  },
  actionBadge: {
    paddingVertical: 1,
    paddingHorizontal: 4,
    borderRadius: 8,
    marginLeft: 4,
  },
  actionBadgeText: { fontSize: 6.5, fontFamily: "Helvetica-Bold" },
});

function statusBadgeColor(status: string): { bg: string; label: string } {
  switch (status) {
    case "excellent":
      return { bg: EXCELLENT, label: "Excellent" };
    case "green":
      return { bg: BIEN, label: "Bien" };
    case "amber":
      return { bg: CORRECT, label: "Correct" };
    case "red":
      return { bg: INSUFFISANT, label: "Insuffisant" };
    default:
      return { bg: "#9CA3AF", label: "N/A" };
  }
}

function moodEmoji(score: number): string {
  if (score <= 1) return "Tres bas";
  if (score === 2) return "Bas";
  if (score === 3) return "Moyen";
  if (score === 4) return "Bon";
  return "Excellent";
}

interface Props {
  data: WeeklyPdfData;
}

export function WeeklyReportPdf({ data }: Props) {
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

        <View style={styles.body}>
          {/* SYNTHESE IA */}
          {data.executiveSummary && (
            <View style={styles.synth}>
              <Text style={styles.synthTitle}>SYNTHESE</Text>
              <Text style={styles.synthBody}>{data.executiveSummary}</Text>
              {data.keyActions.length > 0 && (
                <>
                  <Text style={styles.synthActionsTitle}>Actions cles :</Text>
                  {data.keyActions.map((a, i) => (
                    <Text key={i} style={styles.synthAction}>
                      {"-> " + a}
                    </Text>
                  ))}
                </>
              )}
            </View>
          )}

          {/* KPI */}
          <View style={styles.sectionWrap}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>INDICATEURS</Text>
            </View>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, { flex: 3 }]}>KPI</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Valeur</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Objectif</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>Palier</Text>
            </View>
            {data.kpis.map((k, i) => {
              const sb = statusBadgeColor(k.status);
              return (
                <View
                  key={i}
                  style={[
                    styles.tableRow,
                    { backgroundColor: i % 2 === 0 ? WHITE : "#F8FFFE" },
                  ]}
                >
                  <Text style={styles.cellName}>
                    {k.name}
                    {k.unit ? " (" + k.unit + ")" : ""}
                  </Text>
                  <Text style={styles.cellValue}>
                    {k.value !== null ? String(k.value) : "—"}
                  </Text>
                  <Text style={styles.cellTarget}>
                    {k.target !== null ? String(k.target) : "—"}
                  </Text>
                  <View style={styles.cellBadge}>
                    <View style={[styles.badge, { backgroundColor: sb.bg }]}>
                      <Text style={styles.badgeText}>{sb.label}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
            {data.kpis.length === 0 && (
              <View style={styles.tableRow}>
                <Text style={[styles.cellName, { color: TEXT_MUTED }]}>
                  Aucun KPI saisi.
                </Text>
              </View>
            )}
          </View>

          {/* EQUIPE */}
          <View style={styles.teamBox}>
            <View
              style={[
                styles.sectionHeader,
                { backgroundColor: PURPLE_BG, marginBottom: 0, padding: 0 },
              ]}
            >
              <Text style={[styles.sectionHeaderText, { color: PURPLE_TEXT }]}>EQUIPE</Text>
            </View>
            <View style={styles.teamRow}>
              <Text style={{ fontSize: 9, color: PURPLE_TEXT }}>
                Meteo : {moodEmoji(data.moodScore)}
              </Text>
              <Text style={styles.teamScore}>{data.moodScore} / 5</Text>
            </View>
            <Text style={styles.teamNote}>
              {data.teamNote || "Aucun commentaire cette semaine."}
            </Text>
          </View>

          {/* IDS */}
          {data.ids.length > 0 && (
            <View style={styles.idsBox}>
              <View
                style={[
                  styles.sectionHeader,
                  { backgroundColor: YELLOW_BG, marginBottom: 0, padding: 0 },
                ]}
              >
                <Text style={[styles.sectionHeaderText, { color: YELLOW_TEXT }]}>
                  PROBLEMES IDENTIFIES
                </Text>
              </View>
              {data.ids.map((it, i) => (
                <View key={i} style={styles.idsRow}>
                  <Text style={styles.idsText}>{"- " + it.text}</Text>
                  {it.convertedToTodo && (
                    <View style={[styles.pill, { backgroundColor: MINT_BG }]}>
                      <Text style={[styles.pillText, { color: MINT_TEXT }]}>{"-> To-do"}</Text>
                    </View>
                  )}
                  {it.convertedToObjectif && (
                    <View style={[styles.pill, { backgroundColor: BLUE_BG }]}>
                      <Text style={[styles.pillText, { color: BLUE_TEXT }]}>{"-> Objectif"}</Text>
                    </View>
                  )}
                  {!it.convertedToTodo && !it.convertedToObjectif && (
                    <View style={[styles.pill, { backgroundColor: "#E5E7EB" }]}>
                      <Text style={[styles.pillText, { color: TEXT_MUTED }]}>A traiter</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* ACTIONS EN COURS */}
          {data.todos.length > 0 && (
            <View style={styles.todoBox}>
              <View
                style={[
                  styles.sectionHeader,
                  { backgroundColor: MINT_BG, marginBottom: 0, padding: 0 },
                ]}
              >
                <Text style={[styles.sectionHeaderText, { color: MINT_TEXT }]}>
                  ACTIONS EN COURS
                </Text>
              </View>
              {data.todos.map((t, i) => (
                <View key={i} style={styles.todoItem}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Text style={styles.todoTitle}>{"[ ] " + t.title}</Text>
                    {t.source === "ids_conversion" && (
                      <View style={[styles.pill, { backgroundColor: PURPLE_BG }]}>
                        <Text style={[styles.pillText, { color: PURPLE_TEXT }]}>IDS</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.todoMeta}>
                    {t.responsible} {t.deadline ? " - " + t.deadline : ""}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* NOTES LIBRES */}
          {data.freeNote && data.freeNote.trim().length > 0 && (
            <View style={styles.notesBox}>
              <View
                style={[
                  styles.sectionHeader,
                  { backgroundColor: BLUE_BG, marginBottom: 0, padding: 0 },
                ]}
              >
                <Text style={[styles.sectionHeaderText, { color: BLUE_TEXT }]}>NOTES</Text>
              </View>
              <Text style={styles.notesText}>{data.freeNote}</Text>
            </View>
          )}
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
