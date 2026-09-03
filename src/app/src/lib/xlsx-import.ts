import ExcelJS from "exceljs";

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
}): Promise<ExcelJS.Buffer> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet(opts.sheetName.slice(0, 31), { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = opts.columns.map((c) => ({ header: c.header, width: c.width ?? 20 }));
  sheet.getRow(1).eachCell((cell) => { cell.fill = HEADER_FILL; cell.font = HEADER_FONT; });
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: opts.columns.length } };

  const exampleRow = sheet.addRow(opts.columns.map((c) => c.example ?? ""));
  opts.columns.forEach((c, i) => {
    if (c.money) exampleRow.getCell(i + 1).numFmt = CURRENCY_FMT;
  });
  exampleRow.eachCell((cell) => { cell.font = { italic: true, color: { argb: "FF888888" } }; });

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
 */
export async function parseXlsxRows(fileBuffer: ArrayBuffer | Buffer): Promise<Record<string, string | number | Date | undefined>[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(fileBuffer as ArrayBuffer);
  const sheet = wb.worksheets[0];
  if (!sheet) return [];

  const headers: string[] = [];
  sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headers[colNumber] = String(cell.value ?? "").trim();
  });

  const rows: Record<string, string | number | Date | undefined>[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const obj: Record<string, string | number | Date | undefined> = {};
    let hasValue = false;
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const key = headers[colNumber];
      if (!key) return;
      let v = cell.value as any;
      if (v && typeof v === "object" && "result" in v) v = v.result; // formula cell
      if (v instanceof Date) { obj[key] = v; hasValue = true; }
      else if (typeof v === "number") { obj[key] = v; hasValue = true; }
      else if (typeof v === "string" && v.trim() !== "") { obj[key] = v.trim(); hasValue = true; }
    });
    if (hasValue) rows.push(obj);
  });
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
