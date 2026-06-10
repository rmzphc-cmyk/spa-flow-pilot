// Round-trip Excel pour la configuration KPI d'UN spa.
//
// Principes (cf. décision produit) :
//  • Mono-spa : tout l'export/import porte sur le spa courant.
//  • Sémantique MERGE : on n'efface jamais ce qui manque dans le fichier
//    (les suppressions restent à faire dans l'UI). L'écriture est 100 % upsert.
//  • En-têtes/onglets en FRANÇAIS FIXE (pas i18n) pour un round-trip
//    déterministe — le fichier est un artefact ops interne. L'UI reste i18n.
//  • `exceljs` est chargé en dynamic import : il ne pèse pas sur le bundle
//    principal, seulement au clic export/import.
//  • Les champs à valeurs connues (unité, catégorie, groupe, sens, actif,
//    mode hebdo, rôle, niveau) reçoivent une LISTE DÉROULANTE Excel. Pour être
//    robuste à la locale (Excel FR attend « ; » comme séparateur de liste
//    « en dur »), les déroulantes pointent vers des PLAGES de l'onglet
//    « Listes » (`Listes!$B$2:$B$6`) plutôt que vers des littéraux.
//
// La clé de jointure entre les 3 onglets est l'UUID `kpi_definitions.id`,
// transporté dans une colonne « ID (ne pas modifier) ». Vide = nouveau KPI :
// on génère alors un UUID côté client pour que objectifs/responsabilités du
// même fichier puissent le référencer immédiatement (création en une passe).

import type { KpiDefinitionFull, KpiCategoryDb, ComparisonDirection } from "@/hooks/useKpiConfig";
import type { KpiMonthlyTarget, WeeklyMode } from "@/hooks/useKpiMonthlyTargets";
import {
  type KpiRoleAssignment,
  type KpiRole,
  type KpiNiveau,
  ROLE_LABELS,
  NIVEAU_LABELS,
} from "@/hooks/useKpiRoleAssignments";
import {
  type ImportIssue,
  loadExcelJS,
  readWorksheet,
  str,
  parseNumberCell,
  parseBoolCell,
  resolveEnum,
  buildListsSheet,
  addDropdown,
  styleSheet,
  lastRowFor,
  downloadWorkbook,
} from "@/lib/excelHelpers";

export type { ImportIssue };

// ----- noms d'onglets + colonnes (FR fixe) -----

// Onglet « Listes » : SANS accent ni espace, pour que les références de plage
// dans les formules de validation (Listes!$B$2:$B$6) ne nécessitent pas de
// guillemets et restent portables.
const SHEET = {
  kpi: "KPI",
  obj: "Objectifs",
  resp: "Responsabilités",
  lists: "Listes",
} as const;

const COL_ID = "ID (ne pas modifier)";

const UNIT_VALUES = ["€", "%", "nb", "/10", "j", "pts"] as const;

const KPI_COL = {
  id: COL_ID,
  name: "Nom",
  nameEn: "Nom (EN)",
  nameEs: "Nom (ES)",
  unit: "Unité",
  category: "Catégorie",
  group: "Groupe",
  order: "Ordre",
  active: "Actif",
  thExc: "Seuil excellent",
  thAmber: "Seuil ambre",
  thRed: "Seuil rouge",
  direction: "Sens",
  guidance: "Guidage commentaire (FR)",
} as const;

const OBJ_COL = {
  id: COL_ID,
  kpiName: "KPI",
  month: "Mois (AAAA-MM)",
  monthly: "Objectif mensuel",
  mode: "Mode hebdo",
  override: "Objectif hebdo (override)",
  actual: "Réel mensuel",
} as const;

const RESP_COL = {
  id: COL_ID,
  kpiName: "KPI",
  role: "Rôle",
  niveau: "Niveau",
} as const;

// ----- labels lisibles <-> valeurs d'enum -----

const CATEGORY_LABELS: Record<KpiCategoryDb, string> = {
  financial: "Financier",
  operational: "Opérationnel",
  customer: "Client",
  hr: "RH",
  custom: "Personnalisé",
};
const GROUP_LABELS: Record<"spa" | "manager", string> = {
  spa: "Spa",
  manager: "Manager",
};
const DIRECTION_LABELS: Record<ComparisonDirection, string> = {
  higher_is_better: "Plus haut = mieux",
  lower_is_better: "Plus bas = mieux",
};
const MODE_LABELS: Record<WeeklyMode, string> = {
  divide: "Diviser par 4",
  fixed: "Fixe",
};

// ============================================================
// EXPORT
// ============================================================

export interface ExportParams {
  kpis: KpiDefinitionFull[];
  targets: KpiMonthlyTarget[]; // objectifs du mois affiché
  assignments: KpiRoleAssignment[];
  yearMonth: string;
  spaName: string;
}

// Largeurs de colonnes par onglet (ordre = ordre des colonnes).
const KPI_WIDTHS = [38, 24, 18, 18, 8, 14, 10, 8, 8, 14, 12, 12, 18, 30];
const OBJ_WIDTHS = [38, 24, 14, 16, 14, 20, 14];
const RESP_WIDTHS = [38, 24, 16, 14];

export async function exportKpiWorkbook(params: ExportParams): Promise<void> {
  const ExcelJS = await loadExcelJS();
  const { kpis, targets, assignments, yearMonth, spaName } = params;

  const targetByKpi = new Map(targets.map((t) => [t.kpi_definition_id, t]));
  const nameById = new Map(kpis.map((k) => [k.id, k.name]));

  const wb = new ExcelJS.Workbook();
  wb.creator = "SPA OMS";
  wb.created = new Date();

  // Onglet « Listes » : source des déroulantes (valeurs en colonnes).
  const range = buildListsSheet(wb, SHEET.lists, [
    { header: "Unité", values: UNIT_VALUES },
    { header: "Catégorie", values: Object.values(CATEGORY_LABELS) },
    { header: "Groupe", values: Object.values(GROUP_LABELS) },
    { header: "Sens", values: Object.values(DIRECTION_LABELS) },
    { header: "Actif", values: ["Oui", "Non"] },
    { header: "Mode hebdo", values: Object.values(MODE_LABELS) },
    { header: "Rôle", values: Object.values(ROLE_LABELS) },
    { header: "Niveau", values: Object.values(NIVEAU_LABELS) },
  ]);

  // --- Onglet KPI ---
  const kpiWs = wb.addWorksheet(SHEET.kpi);
  kpiWs.columns = (Object.values(KPI_COL) as string[]).map((h) => ({ header: h }));
  kpis.forEach((k) =>
    kpiWs.addRow([
      k.id,
      k.name,
      k.name_en ?? "",
      k.name_es ?? "",
      k.unit ?? "",
      CATEGORY_LABELS[k.category] ?? k.category,
      GROUP_LABELS[(k.kpi_group ?? "spa") as "spa" | "manager"],
      k.display_order,
      k.is_active ? "Oui" : "Non",
      k.threshold_excellent ?? "",
      k.threshold_amber ?? "",
      k.threshold_red ?? "",
      DIRECTION_LABELS[k.comparison_direction] ?? k.comparison_direction,
      k.comment_guidance_fr ?? "",
    ]),
  );
  styleSheet(kpiWs, KPI_WIDTHS);
  {
    const last = lastRowFor(kpis.length);
    addDropdown(kpiWs, 5, range["Unité"], last); // E Unité
    addDropdown(kpiWs, 6, range["Catégorie"], last); // F Catégorie
    addDropdown(kpiWs, 7, range["Groupe"], last); // G Groupe
    addDropdown(kpiWs, 9, range["Actif"], last); // I Actif
    addDropdown(kpiWs, 13, range["Sens"], last); // M Sens
  }

  // --- Onglet Objectifs (mois affiché) ---
  const objWs = wb.addWorksheet(SHEET.obj);
  objWs.columns = (Object.values(OBJ_COL) as string[]).map((h) => ({ header: h }));
  kpis.forEach((k) => {
    const t = targetByKpi.get(k.id);
    objWs.addRow([
      k.id,
      k.name,
      yearMonth,
      t?.monthly_value ?? "",
      MODE_LABELS[(t?.weekly_mode ?? "divide") as WeeklyMode],
      t?.weekly_override ?? "",
      t?.actual_monthly_value ?? "",
    ]);
  });
  styleSheet(objWs, OBJ_WIDTHS, [1, 3]); // ID + Mois en texte
  addDropdown(objWs, 5, range["Mode hebdo"], lastRowFor(kpis.length)); // E Mode hebdo

  // --- Onglet Responsabilités (une ligne par assignation) ---
  const respWs = wb.addWorksheet(SHEET.resp);
  respWs.columns = (Object.values(RESP_COL) as string[]).map((h) => ({ header: h }));
  assignments.forEach((a) =>
    respWs.addRow([
      a.kpi_definition_id,
      nameById.get(a.kpi_definition_id) ?? "",
      ROLE_LABELS[a.role] ?? a.role,
      NIVEAU_LABELS[a.niveau] ?? a.niveau,
    ]),
  );
  styleSheet(respWs, RESP_WIDTHS);
  {
    const last = lastRowFor(assignments.length);
    addDropdown(respWs, 3, range["Rôle"], last); // C Rôle
    addDropdown(respWs, 4, range["Niveau"], last); // D Niveau
  }

  const safeName = (spaName || "spa").replace(/[^\w-]+/g, "_").slice(0, 40);
  await downloadWorkbook(wb, `KPI_${safeName}_${yearMonth}.xlsx`);
}

// ============================================================
// IMPORT — parsing + validation (AUCUNE écriture ici)
// ============================================================

// Payloads prêts pour l'écriture (cf. useKpiImport).
export interface KpiInsertRow {
  id: string;
  spa_id: string;
  created_by: string;
  name: string;
  name_en: string | null;
  name_es: string | null;
  unit: string | null;
  category: KpiCategoryDb;
  kpi_group: "spa" | "manager";
  display_order: number;
  is_active: boolean;
  threshold_excellent: number | null;
  threshold_amber: number | null;
  threshold_red: number | null;
  comparison_direction: ComparisonDirection;
  comment_guidance_fr: string | null;
}
export interface KpiUpdateRow {
  id: string;
  name: string;
  name_en: string | null;
  name_es: string | null;
  unit: string | null;
  category: KpiCategoryDb;
  kpi_group: "spa" | "manager";
  display_order: number;
  is_active: boolean;
  threshold_excellent: number | null;
  threshold_amber: number | null;
  threshold_red: number | null;
  comparison_direction: ComparisonDirection;
  comment_guidance_fr: string | null;
}
export interface ObjectiveRow {
  spa_id: string;
  kpi_definition_id: string;
  year_month: string;
  monthly_value: number | null;
  weekly_mode: WeeklyMode;
  weekly_override: number | null;
  actual_monthly_value: number | null;
}
export interface AssignmentRow {
  kpi_definition_id: string;
  role: KpiRole;
  niveau: KpiNiveau;
}

export interface KpiImportPayload {
  newKpis: KpiInsertRow[];
  updKpis: KpiUpdateRow[];
  objectives: ObjectiveRow[];
  assignments: AssignmentRow[];
}

export interface ImportPreview {
  payload: KpiImportPayload;
  errors: ImportIssue[];
  warnings: ImportIssue[];
  counts: { create: number; update: number; objectives: number; assignments: number };
}

export interface ImportContext {
  spaId: string;
  userId: string;
  existingKpiIds: Set<string>;
}

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function parseKpiWorkbook(
  file: File,
  ctx: ImportContext,
): Promise<ImportPreview> {
  const ExcelJS = await loadExcelJS();
  const buf = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);

  const errors: ImportIssue[] = [];
  const warnings: ImportIssue[] = [];

  const kpiRaw = readWorksheet(wb.getWorksheet(SHEET.kpi));
  const objRaw = readWorksheet(wb.getWorksheet(SHEET.obj));
  const respRaw = readWorksheet(wb.getWorksheet(SHEET.resp));

  if (!wb.getWorksheet(SHEET.kpi)) {
    errors.push({ sheet: SHEET.kpi, row: 0, message: `Onglet « ${SHEET.kpi} » introuvable.` });
  }

  // Garde-fou : si l'onglet KPI existe mais n'a pas la colonne ID, c'est qu'on
  // a cassé/réordonné l'en-tête — on abandonne proprement.
  if (kpiRaw.length > 0 && !(COL_ID in kpiRaw[0])) {
    errors.push({
      sheet: SHEET.kpi,
      row: 1,
      message: `Colonne « ${COL_ID} » manquante — réexportez un modèle propre.`,
    });
    return { payload: emptyPayload(), errors, warnings, counts: zeroCounts() };
  }

  const newKpis: KpiInsertRow[] = [];
  const updKpis: KpiUpdateRow[] = [];

  // name(normalisé) -> id, pour relier objectifs/responsabilités par nom
  // quand l'ID est vide. On signale les noms ambigus.
  const idByName = new Map<string, string>();
  const ambiguousNames = new Set<string>();
  // Tous les ids valides connus après lecture de l'onglet KPI (existants + nouveaux du fichier)
  const knownIds = new Set<string>(ctx.existingKpiIds);

  kpiRaw.forEach((r, i) => {
    const excelRow = i + 2; // +1 en-tête, +1 base-1
    const name = str(r[KPI_COL.name]);
    const rawId = str(r[KPI_COL.id]);

    // Ligne entièrement vide (modèle non rempli) -> ignorée sans erreur.
    if (!name && !rawId) return;
    if (!name) {
      errors.push({ sheet: SHEET.kpi, row: excelRow, message: "Nom de KPI vide." });
      return;
    }

    let id: string;
    let isNew: boolean;
    if (rawId) {
      if (!ctx.existingKpiIds.has(rawId)) {
        errors.push({
          sheet: SHEET.kpi,
          row: excelRow,
          message: `ID inconnu pour ce spa : ${rawId.slice(0, 8)}… (ne pas modifier la colonne ID).`,
        });
        return;
      }
      id = rawId;
      isNew = false;
    } else {
      id = crypto.randomUUID();
      isNew = true;
      knownIds.add(id);
    }

    // index nom -> id
    const nk = name.toLowerCase();
    if (idByName.has(nk)) ambiguousNames.add(nk);
    else idByName.set(nk, id);

    const category = resolveEnum<KpiCategoryDb>(r[KPI_COL.category], CATEGORY_LABELS);
    if (r[KPI_COL.category] && !category) {
      errors.push({
        sheet: SHEET.kpi,
        row: excelRow,
        message: `Catégorie invalide : « ${str(r[KPI_COL.category])} ».`,
      });
    }
    const group = resolveEnum<"spa" | "manager">(r[KPI_COL.group], GROUP_LABELS);
    if (r[KPI_COL.group] && !group) {
      errors.push({
        sheet: SHEET.kpi,
        row: excelRow,
        message: `Groupe invalide : « ${str(r[KPI_COL.group])} ».`,
      });
    }
    const direction = resolveEnum<ComparisonDirection>(r[KPI_COL.direction], DIRECTION_LABELS);
    if (r[KPI_COL.direction] && !direction) {
      errors.push({
        sheet: SHEET.kpi,
        row: excelRow,
        message: `Sens invalide : « ${str(r[KPI_COL.direction])} ».`,
      });
    }

    const exc = parseNumberCell(r[KPI_COL.thExc]);
    const amb = parseNumberCell(r[KPI_COL.thAmber]);
    const red = parseNumberCell(r[KPI_COL.thRed]);
    const ord = parseNumberCell(r[KPI_COL.order]);
    for (const [field, p] of [
      [KPI_COL.thExc, exc],
      [KPI_COL.thAmber, amb],
      [KPI_COL.thRed, red],
      [KPI_COL.order, ord],
    ] as const) {
      if (p.invalid) {
        errors.push({ sheet: SHEET.kpi, row: excelRow, message: `Valeur numérique invalide en « ${field} ».` });
      }
    }

    const common = {
      name,
      name_en: str(r[KPI_COL.nameEn]) || null,
      name_es: str(r[KPI_COL.nameEs]) || null,
      unit: str(r[KPI_COL.unit]) || null,
      category: category ?? "custom",
      kpi_group: group ?? "spa",
      display_order: ord.value ?? 1000 + i,
      is_active: parseBoolCell(r[KPI_COL.active], true),
      threshold_excellent: exc.value,
      threshold_amber: amb.value,
      threshold_red: red.value,
      comparison_direction: direction ?? "higher_is_better",
      comment_guidance_fr: str(r[KPI_COL.guidance]) || null,
    };

    if (isNew) {
      newKpis.push({ id, spa_id: ctx.spaId, created_by: ctx.userId, ...common });
    } else {
      updKpis.push({ id, ...common });
    }
  });

  // Résout l'id KPI d'une ligne enfant (objectif/responsabilité) :
  // priorité à l'ID, repli sur le nom. Renvoie null + pousse l'erreur.
  const resolveKpiId = (
    r: Record<string, unknown>,
    sheet: string,
    excelRow: number,
  ): string | null => {
    const rawId = str(r[COL_ID]);
    if (rawId) {
      if (UUID_RE.test(rawId) && knownIds.has(rawId)) return rawId;
      errors.push({ sheet, row: excelRow, message: `ID KPI inconnu : ${rawId.slice(0, 8)}…` });
      return null;
    }
    const nm = str(r[OBJ_COL.kpiName]).toLowerCase();
    if (!nm) {
      errors.push({ sheet, row: excelRow, message: "Ni ID ni nom de KPI — ligne ignorable." });
      return null;
    }
    if (ambiguousNames.has(nm)) {
      errors.push({ sheet, row: excelRow, message: `Nom de KPI ambigu (doublon) : « ${str(r[OBJ_COL.kpiName])} ».` });
      return null;
    }
    const id = idByName.get(nm);
    if (!id) {
      errors.push({ sheet, row: excelRow, message: `KPI introuvable : « ${str(r[OBJ_COL.kpiName])} ».` });
      return null;
    }
    return id;
  };

  // Objectifs
  const objectives: ObjectiveRow[] = [];
  objRaw.forEach((r, i) => {
    const excelRow = i + 2;
    // Ligne entièrement vide -> on saute sans bruit
    if (!str(r[OBJ_COL.id]) && !str(r[OBJ_COL.kpiName])) return;
    const kpiId = resolveKpiId(r, SHEET.obj, excelRow);
    if (!kpiId) return;

    // Excel peut auto-convertir « 2026-05 » en date : on reformate alors en AAAA-MM.
    const monthRaw = r[OBJ_COL.month];
    const month =
      monthRaw instanceof Date
        ? `${monthRaw.getFullYear()}-${String(monthRaw.getMonth() + 1).padStart(2, "0")}`
        : str(monthRaw);
    if (!MONTH_RE.test(month)) {
      errors.push({ sheet: SHEET.obj, row: excelRow, message: `Mois invalide (attendu AAAA-MM) : « ${month} ».` });
      return;
    }
    const monthly = parseNumberCell(r[OBJ_COL.monthly]);
    const override = parseNumberCell(r[OBJ_COL.override]);
    const actual = parseNumberCell(r[OBJ_COL.actual]);
    for (const [field, p] of [
      [OBJ_COL.monthly, monthly],
      [OBJ_COL.override, override],
      [OBJ_COL.actual, actual],
    ] as const) {
      if (p.invalid) errors.push({ sheet: SHEET.obj, row: excelRow, message: `Valeur numérique invalide en « ${field} ».` });
    }
    const mode = resolveEnum<WeeklyMode>(r[OBJ_COL.mode], MODE_LABELS) ?? "divide";

    objectives.push({
      spa_id: ctx.spaId,
      kpi_definition_id: kpiId,
      year_month: month,
      monthly_value: monthly.value,
      weekly_mode: mode,
      weekly_override: override.value,
      actual_monthly_value: actual.value,
    });
  });

  // Responsabilités
  const assignments: AssignmentRow[] = [];
  const seenAssign = new Set<string>(); // kpiId|role : dédoublonne dans le fichier
  respRaw.forEach((r, i) => {
    const excelRow = i + 2;
    if (!str(r[RESP_COL.id]) && !str(r[RESP_COL.kpiName]) && !str(r[RESP_COL.role])) return;
    const kpiId = resolveKpiId(r, SHEET.resp, excelRow);
    if (!kpiId) return;

    const role = resolveEnum<KpiRole>(r[RESP_COL.role], ROLE_LABELS);
    if (!role) {
      errors.push({ sheet: SHEET.resp, row: excelRow, message: `Rôle invalide : « ${str(r[RESP_COL.role])} ».` });
      return;
    }
    const niveau = resolveEnum<KpiNiveau>(r[RESP_COL.niveau], NIVEAU_LABELS);
    if (!niveau) {
      errors.push({ sheet: SHEET.resp, row: excelRow, message: `Niveau invalide : « ${str(r[RESP_COL.niveau])} ».` });
      return;
    }
    const key = `${kpiId}|${role}`;
    if (seenAssign.has(key)) {
      warnings.push({ sheet: SHEET.resp, row: excelRow, message: `Doublon KPI+rôle ignoré (dernier conservé).` });
    }
    seenAssign.add(key);
    // upsert onConflict kpi_definition_id,role -> on garde le dernier : on
    // remplace l'éventuel précédent du même couple.
    const existingIdx = assignments.findIndex((a) => a.kpi_definition_id === kpiId && a.role === role);
    if (existingIdx >= 0) assignments[existingIdx] = { kpi_definition_id: kpiId, role, niveau };
    else assignments.push({ kpi_definition_id: kpiId, role, niveau });
  });

  if (ambiguousNames.size > 0) {
    warnings.push({
      sheet: SHEET.kpi,
      row: 0,
      message: `${ambiguousNames.size} nom(s) de KPI en doublon : les lignes liées par nom seront rejetées.`,
    });
  }

  return {
    payload: { newKpis, updKpis, objectives, assignments },
    errors,
    warnings,
    counts: {
      create: newKpis.length,
      update: updKpis.length,
      objectives: objectives.length,
      assignments: assignments.length,
    },
  };
}

function emptyPayload(): KpiImportPayload {
  return { newKpis: [], updKpis: [], objectives: [], assignments: [] };
}
function zeroCounts() {
  return { create: 0, update: 0, objectives: 0, assignments: 0 };
}
