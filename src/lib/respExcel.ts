// Round-trip Excel pour les Responsabilités managériales d'UN spa.
//
// Mêmes principes que kpiExcel (cf. en-tête de ce fichier) : mono-spa, MERGE
// (jamais de suppression), en-têtes FR fixes, ExcelJS lazy, déroulantes via
// plages de l'onglet « Listes ». Une seule table à round-tripper :
// `responsibility_templates` -> un seul onglet de données « Responsabilités ».
//
// Clé de jointure = UUID `responsibility_templates.id` (colonne « ID (ne pas
// modifier) »). Vide = nouvelle responsabilité (UUID généré côté client).

import type { RespTemplateFullRow } from "@/hooks/useResponsabilites";
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

// ----- onglets + colonnes (FR fixe) -----

const SHEET = { resp: "Responsabilités", lists: "Listes" } as const;
const COL_ID = "ID (ne pas modifier)";

const RESP_COL = {
  id: COL_ID,
  title: "Titre",
  titleEn: "Titre (EN)",
  titleEs: "Titre (ES)",
  description: "Description",
  category: "Catégorie",
  frequency: "Fréquence",
  count: "Quantité attendue",
  active: "Actif",
  order: "Ordre",
} as const;

const RESP_WIDTHS = [38, 28, 22, 22, 36, 16, 14, 16, 8, 8];

// Catégorie : stockée en base telle quelle (le label EST la valeur).
export type RespCategory =
  | "RH"
  | "Commercial"
  | "Opérationnel"
  | "Qualité"
  | "Formation"
  | "Administratif";
const CATEGORY_LABELS: Record<RespCategory, string> = {
  RH: "RH",
  Commercial: "Commercial",
  Opérationnel: "Opérationnel",
  Qualité: "Qualité",
  Formation: "Formation",
  Administratif: "Administratif",
};

export type RespFrequency = "daily" | "weekly" | "biweekly" | "monthly";
const FREQUENCY_LABELS: Record<RespFrequency, string> = {
  daily: "Journalier",
  weekly: "Hebdo",
  biweekly: "Bimensuel",
  monthly: "Mensuel",
};

// ============================================================
// EXPORT
// ============================================================

export interface ExportRespParams {
  templates: RespTemplateFullRow[];
  spaName: string;
}

export async function exportRespWorkbook(params: ExportRespParams): Promise<void> {
  const ExcelJS = await loadExcelJS();
  const { templates, spaName } = params;

  const wb = new ExcelJS.Workbook();
  wb.creator = "SPA OMS";
  wb.created = new Date();

  const range = buildListsSheet(wb, SHEET.lists, [
    { header: "Catégorie", values: Object.values(CATEGORY_LABELS) },
    { header: "Fréquence", values: Object.values(FREQUENCY_LABELS) },
    { header: "Actif", values: ["Oui", "Non"] },
  ]);

  const ws = wb.addWorksheet(SHEET.resp);
  ws.columns = (Object.values(RESP_COL) as string[]).map((h) => ({ header: h }));
  templates.forEach((tmpl) =>
    ws.addRow([
      tmpl.id,
      tmpl.title,
      (tmpl as { title_en?: string | null }).title_en ?? "",
      (tmpl as { title_es?: string | null }).title_es ?? "",
      tmpl.description ?? "",
      tmpl.category ?? "",
      FREQUENCY_LABELS[(tmpl.frequency ?? "monthly") as RespFrequency] ?? tmpl.frequency,
      tmpl.expected_count ?? 1,
      tmpl.is_active ? "Oui" : "Non",
      tmpl.display_order,
    ]),
  );
  styleSheet(ws, RESP_WIDTHS);
  {
    const last = lastRowFor(templates.length);
    addDropdown(ws, 6, range["Catégorie"], last); // F Catégorie
    addDropdown(ws, 7, range["Fréquence"], last); // G Fréquence
    addDropdown(ws, 9, range["Actif"], last); // I Actif
  }

  const safeName = (spaName || "spa").replace(/[^\w-]+/g, "_").slice(0, 40);
  await downloadWorkbook(wb, `Responsabilites_${safeName}.xlsx`);
}

// ============================================================
// IMPORT — parsing + validation (AUCUNE écriture ici)
// ============================================================

export interface RespInsertRow {
  id: string;
  spa_id: string;
  title: string;
  title_en: string | null;
  title_es: string | null;
  description: string | null;
  category: string | null;
  display_order: number;
  is_active: boolean;
  frequency: string;
  expected_count: number;
}
export interface RespUpdateRow {
  id: string;
  title: string;
  title_en: string | null;
  title_es: string | null;
  description: string | null;
  category: string | null;
  display_order: number;
  is_active: boolean;
  frequency: string;
  expected_count: number;
}

export interface RespImportPayload {
  newRows: RespInsertRow[];
  updRows: RespUpdateRow[];
}

export interface RespImportPreview {
  payload: RespImportPayload;
  errors: ImportIssue[];
  warnings: ImportIssue[];
  counts: { create: number; update: number };
}

export interface RespImportContext {
  spaId: string;
  existingIds: Set<string>;
}

export async function parseRespWorkbook(
  file: File,
  ctx: RespImportContext,
): Promise<RespImportPreview> {
  const ExcelJS = await loadExcelJS();
  const buf = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);

  const errors: ImportIssue[] = [];
  const warnings: ImportIssue[] = [];

  const ws = wb.getWorksheet(SHEET.resp);
  if (!ws) {
    errors.push({ sheet: SHEET.resp, row: 0, message: `Onglet « ${SHEET.resp} » introuvable.` });
    return { payload: { newRows: [], updRows: [] }, errors, warnings, counts: { create: 0, update: 0 } };
  }
  const rows = readWorksheet(ws);

  // Garde-fou : en-tête cassé/réordonné -> on abandonne proprement.
  if (rows.length > 0 && !(COL_ID in rows[0])) {
    errors.push({
      sheet: SHEET.resp,
      row: 1,
      message: `Colonne « ${COL_ID} » manquante — réexportez un modèle propre.`,
    });
    return { payload: { newRows: [], updRows: [] }, errors, warnings, counts: { create: 0, update: 0 } };
  }

  const newRows: RespInsertRow[] = [];
  const updRows: RespUpdateRow[] = [];

  rows.forEach((r, i) => {
    const excelRow = i + 2; // +1 en-tête, +1 base-1
    const title = str(r[RESP_COL.title]);
    const rawId = str(r[RESP_COL.id]);

    // Ligne entièrement vide (modèle non rempli) -> ignorée sans erreur.
    if (!title && !rawId) return;
    if (!title) {
      errors.push({ sheet: SHEET.resp, row: excelRow, message: "Titre vide." });
      return;
    }

    let id: string;
    let isNew: boolean;
    if (rawId) {
      if (!ctx.existingIds.has(rawId)) {
        errors.push({
          sheet: SHEET.resp,
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
    }

    const category = resolveEnum<RespCategory>(r[RESP_COL.category], CATEGORY_LABELS);
    if (r[RESP_COL.category] && !category) {
      errors.push({
        sheet: SHEET.resp,
        row: excelRow,
        message: `Catégorie invalide : « ${str(r[RESP_COL.category])} ».`,
      });
    }
    const frequency = resolveEnum<RespFrequency>(r[RESP_COL.frequency], FREQUENCY_LABELS);
    if (r[RESP_COL.frequency] && !frequency) {
      errors.push({
        sheet: SHEET.resp,
        row: excelRow,
        message: `Fréquence invalide : « ${str(r[RESP_COL.frequency])} ».`,
      });
    }

    const count = parseNumberCell(r[RESP_COL.count]);
    if (count.invalid) {
      errors.push({ sheet: SHEET.resp, row: excelRow, message: `Quantité attendue invalide.` });
    }
    const order = parseNumberCell(r[RESP_COL.order]);
    if (order.invalid) {
      errors.push({ sheet: SHEET.resp, row: excelRow, message: `Ordre invalide.` });
    }

    const common = {
      title: title.slice(0, 100),
      title_en: str(r[RESP_COL.titleEn]) || null,
      title_es: str(r[RESP_COL.titleEs]) || null,
      description: str(r[RESP_COL.description]).slice(0, 300) || null,
      category: category ?? null,
      display_order: order.value ?? i,
      is_active: parseBoolCell(r[RESP_COL.active], true),
      frequency: frequency ?? "monthly",
      expected_count: Math.max(1, count.value ?? 1),
    };

    if (isNew) newRows.push({ id, spa_id: ctx.spaId, ...common });
    else updRows.push({ id, ...common });
  });

  return {
    payload: { newRows, updRows },
    errors,
    warnings,
    counts: { create: newRows.length, update: updRows.length },
  };
}
