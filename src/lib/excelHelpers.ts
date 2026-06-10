// Primitives Excel partagées par les round-trips de config (KPI, responsabilités…).
//
// ExcelJS est chargé en dynamic import → chunk lazy, hors bundle principal.
// Les déroulantes pointent vers des PLAGES d'un onglet « Listes » (robuste à la
// locale FR, qui attend « ; » comme séparateur de liste « en dur »).

export interface ImportIssue {
  sheet: string;
  row: number; // numéro de ligne Excel (1 = en-têtes)
  message: string;
}

// Charge ExcelJS (gère default vs namespace selon le build).
export async function loadExcelJS(): Promise<typeof import("exceljs")> {
  const mod = await import("exceljs");
  return ((mod as unknown as { default?: typeof import("exceljs") }).default ??
    mod) as typeof import("exceljs");
}

// Numéro de colonne (1-based) -> lettre Excel (1->A, 27->AA).
export function colLetter(n: number): string {
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// Extrait la valeur exploitable d'une cellule ExcelJS (formule, lien, texte
// riche, date) -> string | number | Date.
export function cellValue(cell: import("exceljs").Cell): unknown {
  const v = cell.value as unknown;
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    if (v instanceof Date) return v;
    const o = v as Record<string, unknown>;
    if ("result" in o) return o.result; // formule
    if ("text" in o) return o.text; // lien hypertexte
    if ("richText" in o)
      return (o.richText as { text: string }[]).map((t) => t.text).join("");
    return String(v);
  }
  return v;
}

// Lit une feuille en objets keyés par en-tête (ligne 1). Ignore les lignes
// entièrement vides.
export function readWorksheet(
  ws: import("exceljs").Worksheet | undefined,
): Record<string, unknown>[] {
  if (!ws) return [];
  const headers: Record<number, string> = {};
  ws.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => {
    const h = String(cellValue(cell) ?? "").trim();
    if (h) headers[col] = h;
  });
  const out: Record<string, unknown>[] = [];
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const obj: Record<string, unknown> = {};
    let hasValue = false;
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      const h = headers[col];
      if (!h) return;
      const val = cellValue(cell);
      obj[h] = val;
      if (val !== "" && val !== null && val !== undefined) hasValue = true;
    });
    if (hasValue) out.push(obj);
  });
  return out;
}

export function str(v: unknown): string {
  return v === null || v === undefined ? "" : String(v).trim();
}

// Nombre tolérant aux conventions FR : « 1 200,50 ». {value:null} si vide,
// {invalid:true} si non parsable.
export function parseNumberCell(v: unknown): { value: number | null; invalid: boolean } {
  if (v === "" || v === null || v === undefined) return { value: null, invalid: false };
  if (typeof v === "number") return { value: isNaN(v) ? null : v, invalid: isNaN(v) };
  const s = String(v).replace(/\s/g, "").replace(",", ".");
  if (s === "") return { value: null, invalid: false };
  const n = Number(s);
  return isNaN(n) ? { value: null, invalid: true } : { value: n, invalid: false };
}

export function parseBoolCell(v: unknown, fallback: boolean): boolean {
  if (v === "" || v === null || v === undefined) return fallback;
  if (typeof v === "boolean") return v;
  const s = String(v).trim().toLowerCase();
  if (["oui", "true", "vrai", "1", "x", "actif"].includes(s)) return true;
  if (["non", "false", "faux", "0", "inactif"].includes(s)) return false;
  return fallback;
}

// Résout une saisie (valeur d'enum brute OU label, insensible à la casse) vers
// une valeur d'enum. Renvoie null si rien ne correspond.
export function resolveEnum<T extends string>(
  input: unknown,
  labels: Record<T, string>,
): T | null {
  if (typeof input !== "string") return null;
  const norm = input.trim().toLowerCase();
  if (!norm) return null;
  for (const key of Object.keys(labels) as T[]) {
    if (key.toLowerCase() === norm) return key;
    if (labels[key].toLowerCase() === norm) return key;
  }
  return null;
}

// ---- Construction de classeur ----

export interface ListDef {
  header: string;
  values: readonly string[];
}

// Onglet « Listes » : valeurs autorisées en colonnes. Renvoie, par en-tête, la
// référence de plage à utiliser dans une déroulante (`Listes!$B$2:$B$6`).
// NB : nom d'onglet SANS accent/espace pour éviter les guillemets de formule.
export function buildListsSheet(
  wb: import("exceljs").Workbook,
  sheetName: string,
  defs: ListDef[],
): Record<string, string> {
  const ws = wb.addWorksheet(sheetName);
  const range: Record<string, string> = {};
  defs.forEach((d, idx) => {
    const col = idx + 1;
    const letter = colLetter(col);
    ws.getCell(1, col).value = d.header;
    d.values.forEach((v, i) => {
      ws.getCell(2 + i, col).value = v;
    });
    ws.getColumn(col).width = 16;
    range[d.header] = `${sheetName}!$${letter}$2:$${letter}$${1 + d.values.length}`;
  });
  ws.getRow(1).font = { bold: true };
  return range;
}

// Applique une déroulante (liste) sur une colonne, lignes 2..lastRow.
export function addDropdown(
  ws: import("exceljs").Worksheet,
  col: number,
  rangeRef: string,
  lastRow: number,
): void {
  const letter = colLetter(col);
  for (let r = 2; r <= lastRow; r++) {
    ws.getCell(`${letter}${r}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [rangeRef],
      showErrorMessage: true,
      errorStyle: "warning",
      errorTitle: "Valeur hors liste",
      error: "Choisissez une valeur proposée dans la liste.",
    };
  }
}

// En-tête figée + gras, largeurs, colonnes forcées en texte (anti-coercition).
export function styleSheet(
  ws: import("exceljs").Worksheet,
  widths: number[],
  textCols: number[] = [1],
): void {
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));
  textCols.forEach((c) => (ws.getColumn(c).numFmt = "@"));
}

// Marge de lignes pour que les déroulantes couvrent aussi les futures saisies.
export function lastRowFor(count: number): number {
  return Math.max(count + 50, 200);
}

// Déclenche le téléchargement du classeur (navigateur).
export async function downloadWorkbook(
  wb: import("exceljs").Workbook,
  filename: string,
): Promise<void> {
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
