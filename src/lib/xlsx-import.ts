import ExcelJS from "exceljs";
import * as XLSX from "xlsx";

const CURRENCY_FMT = '"$"#,##0.00';
const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3D2E" } };
const HEADER_FONT: Partial<ExcelJS.Font> = { color: { argb: "FFFFFFFF" }, bold: true };

export interface TemplateColumn {
  header: string;
  width?: number;
  /** Example value shown in the first data row so the format is obvious. */
  example?: string | number;
  money?: boolean;
}

/**
 * Builds a downloadable .xlsx template: one sheet with a styled header row,
 * a sample row, and (optionally) a second sheet listing valid category
 * names so free-typed category values in the import actually match.
 */
export async function buildXlsxTemplate(opts: {
  sheetName: string;
  columns: TemplateColumn[];
  categoryNames?: string[];
  notes?: string[];
  /**
   * Real rows to prefill instead of one italic example — e.g. every
   * product/year combo actually logged on field activities, so the
   * template already lists exactly what needs a cost, not a placeholder.
   * When provided, these are written as normal (non-italic) editable
   * rows and the generic example row is skipped.
   */
  dataRows?: (string | number)[][];
}): Promise<ExcelJS.Buffer> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet(opts.sheetName.slice(0, 31), { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = opts.columns.map((c) => ({ header: c.header, width: c.width ?? 20 }));
  sheet.getRow(1).eachCell((cell) => { cell.fill = HEADER_FILL; cell.font = HEADER_FONT; });
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: opts.columns.length } };

  if (opts.dataRows?.length) {
    for (const row of opts.dataRows) {
      const r = sheet.addRow(row);
      opts.columns.forEach((c, i) => { if (c.money) r.getCell(i + 1).numFmt = CURRENCY_FMT; });
    }
  } else {
    const exampleRow = sheet.addRow(opts.columns.map((c) => c.example ?? ""));
    opts.columns.forEach((c, i) => {
      if (c.money) exampleRow.getCell(i + 1).numFmt = CURRENCY_FMT;
    });
    exampleRow.eachCell((cell) => { cell.font = { italic: true, color: { argb: "FF888888" } }; });
  }

  // A few blank rows to fill in.
  for (let i = 0; i < 20; i++) sheet.addRow([]);

  if (opts.categoryNames?.length) {
    const catSheet = wb.addWorksheet("Categories (reference)");
    catSheet.columns = [{ header: "Type this exactly into the Category column", width: 45 }];
    catSheet.getRow(1).eachCell((cell) => { cell.fill = HEADER_FILL; cell.font = HEADER_FONT; });
    opts.categoryNames.forEach((name) => catSheet.addRow([name]));
  }

  if (opts.notes?.length) {
    const noteSheet = wb.addWorksheet("Instructions");
    noteSheet.getColumn(1).width = 90;
    opts.notes.forEach((n) => noteSheet.addRow([n]));
  }

  return wb.xlsx.writeBuffer();
}

/**
 * Parses an uploaded .xlsx/.csv file's first worksheet into row objects
 * keyed by the (trimmed) header text. Blank rows are skipped. Excel dates
 * come back as JS Date objects; everything else as string/number.
 *
 * Reads with the `xlsx` (SheetJS) library rather than ExcelJS — a real
 * uploaded file is written by whatever software produced it (a bank's own
 * export, Google Sheets, Numbers, etc.), not by us, and those don't all
 * produce identical OOXML. One bank-export file crashed ExcelJS outright
 * (an uncaught exception deep inside its own XML parser, "Cannot read
 * properties of undefined (reading 'sheets')") because it used a
 * namespace-prefixed `<x:workbook>` root element instead of the
 * unprefixed `<workbook>` every Microsoft/Excel-written file uses — both
 * are valid XML, but ExcelJS's parser only recognized the latter. That
 * uncaught throw is what surfaced to the browser as a blank, unhelpful
 * "Minified React error #441" instead of any usable message. SheetJS is
 * built for exactly this kind of real-world variance and reads that same
 * file without issue. ExcelJS stays in use for the template BUILDER above
 * (buildXlsxTemplate) — files this app writes itself are never the
 * problem, only files it has to read back from elsewhere.
 */
export async function parseXlsxRows(fileBuffer: ArrayBuffer | Buffer): Promise<Record<string, string | number | Date | undefined>[]> {
  let wb: XLSX.WorkBook;
  try {
    const buf = Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer);
    wb = XLSX.read(buf, { type: "buffer", cellDates: true });
  } catch (e) {
    throw new Error(
      `Couldn't read that file as an Excel spreadsheet (${e instanceof Error ? e.message : "unknown error"}). ` +
      `Try opening it and re-saving as .xlsx from Excel, Google Sheets, or Numbers, or start from the downloaded template instead.`
    );
  }
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return [];
  const sheet = wb.Sheets[sheetName];

  // header:1 + slice(1) instead of sheet_to_json's default object mode —
  // the default mode silently drops a column entirely if two header cells
  // trim to the same text, which the object mode has no way to warn about.
  // Reading as raw rows first, keyed by our own trimmed header list, keeps
  // every column even if the sheet is a little messy.
  const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: undefined }) as unknown[][];
  if (grid.length === 0) return [];
  const headers = (grid[0] ?? []).map((h) => String(h ?? "").trim());

  const rows: Record<string, string | number | Date | undefined>[] = [];
  for (const raw of grid.slice(1)) {
    const obj: Record<string, string | number | Date | undefined> = {};
    let hasValue = false;
    raw.forEach((cell, i) => {
      const key = headers[i];
      if (!key) return;
      let v = cell as any;
      if (v == null) return;
      if (v instanceof Date) { obj[key] = v; hasValue = true; }
      else if (typeof v === "number") { obj[key] = v; hasValue = true; }
      else {
        const s = String(v).trim();
        if (s !== "") { obj[key] = s; hasValue = true; }
      }
    });
    if (hasValue) rows.push(obj);
  }
  return rows;
}

/** Coerces a parsed cell value (Date | number | string | undefined) to an ISO yyyy-mm-dd string. */
export function toIsoDate(v: string | number | Date | undefined): string | undefined {
  if (v == null) return undefined;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  if (!s) return undefined;
  const d = new Date(s);
  return isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
}

export function toNumber(v: string | number | Date | undefined): number | undefined {
  if (v == null) return undefined;
  if (typeof v === "number") return v;
  const n = Number(String(v).replace(/[$,]/g, "").trim());
  return isNaN(n) ? undefined : n;
}

export function toText(v: string | number | Date | undefined): string | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s === "" ? undefined : s;
}
