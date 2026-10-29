import { newId } from "@/lib/ids";
import * as XLSX from "xlsx";
import type { Attendant } from "@/types/attendant";
import type { AttendanceChannel } from "@/types/goals";
import type { DailyPerformanceRecord } from "@/types/performance";
import { parseTimeInput } from "@/lib/performanceStorage";
import {
  createAttendant,
  pickDominantServiceChannel,
  toAttendantServiceChannel,
} from "@/lib/attendantsStorage";
import type { AttendantServiceChannel } from "@/types/attendant";

export type ImportField = "attendant" | "date" | "channel" | "count" | "averageTime";

export interface ColumnMapping {
  attendant: string | null;
  date: string | null;
  channel: string | null;
  count: string | null;
  averageTime: string | null;
}

export interface SummaryReferenceTotals {
  ligacao?: { metric: string; total: number; days: number };
  whatsapp?: { metric: string; total: number; days: number };
}

export interface ParsedSheet {
  headers: string[];
  rows: Record<string, string>[];
  fileName: string;
  /** Abas de produtividade usadas na importação (Acompanhamento Diário) */
  sourceSheets?: {
    name: string;
    channel: AttendanceChannel;
    rowCount: number;
    attendancesTotal: number;
    role: "productivity" | "summary";
  }[];
  /** Abas ignoradas (resumo REL 067/091, etc.) */
  ignoredSheets?: { name: string; reason: string }[];
  /** Totais das abas de resumo (referência — métrica diferente da produtividade) */
  summaryReference?: SummaryReferenceTotals;
  importNotes?: string[];
}

export interface ImportRowPreview {
  rowNumber: number;
  attendantName: string;
  date: string;
  channel: AttendanceChannel;
  attendancesCount: number;
  averageTimeMinutes: number;
  status: "new" | "update" | "skip";
  note?: string;
  skipReason?: "duplicate" | "existing_day";
}

export interface ImportPlan {
  valid: ImportRowPreview[];
  errors: { rowNumber: number; message: string }[];
  stats: {
    totalRows: number;
    validCount: number;
    newRecords: number;
    updates: number;
    skippedDuplicates: number;
    skippedExistingDays: number;
    newAttendants: number;
    aggregatedRows: number;
    unknownAttendants: string[];
    newDaysInFile: string[];
    existingDaysInFile: string[];
  };
}

export interface ImportBatchOptions {
  createAttendants: boolean;
  updateDuplicates: boolean;
  /** Ignora linhas cujo dia já existe no sistema (importação recorrente) */
  onlyNewDays?: boolean;
  consolidated?: boolean;
  consolidatedAttendantName?: string;
  consolidatedChannel?: AttendanceChannel;
}

export type ImportSpreadsheetProfile = "detailed" | "rel_summary" | "acompanhamento_diario";

export interface ImportProfileAnalysis {
  profile: ImportSpreadsheetProfile;
  formatLabel: string;
  message: string;
  suggestedConsolidatedName: string;
  suggestedChannel: AttendanceChannel;
  importedSheets?: {
    name: string;
    channel: AttendanceChannel;
    rowCount: number;
    attendancesTotal: number;
    role: "productivity" | "summary";
  }[];
  ignoredSheets?: { name: string; reason: string }[];
  preview?: {
    totalRows: number;
    uniqueAttendants: number;
    uniqueDays: number;
    ligacaoRows: number;
    whatsappRows: number;
    ligacaoTotal: number;
    whatsappTotal: number;
    dateStart?: string;
    dateEnd?: string;
  };
  summaryReference?: SummaryReferenceTotals;
}

export interface ImportBatchResult {
  imported: number;
  updated: number;
  skipped: number;
  skippedExistingDays: number;
  createdAttendants: number;
  uniqueAttendants: number;
  newDays: string[];
  logMessage: string;
  errors: { rowNumber: number; message: string }[];
}

export function formatImportLogMessage(result: Pick<
  ImportBatchResult,
  "imported" | "updated" | "uniqueAttendants" | "newDays" | "skipped" | "skippedExistingDays"
>): string {
  const records = result.imported + result.updated;
  const parts: string[] = [];

  if (records > 0) {
    parts.push(
      `Importados ${records} registro${records === 1 ? "" : "s"} de ${result.uniqueAttendants} colaborador${result.uniqueAttendants === 1 ? "" : "es"}`
    );
  }

  if (result.newDays.length > 0) {
    parts.push(
      `${result.newDays.length} dia${result.newDays.length === 1 ? "" : "s"} novo${result.newDays.length === 1 ? "" : "s"}`
    );
  }

  if (result.skippedExistingDays > 0) {
    parts.push(`${result.skippedExistingDays} linha(s) de dias já importados ignoradas`);
  }

  if (result.skipped > 0 && result.skippedExistingDays === 0) {
    parts.push(`${result.skipped} duplicata(s) ignorada(s)`);
  } else if (result.skipped > result.skippedExistingDays) {
    parts.push(`${result.skipped - result.skippedExistingDays} duplicata(s) ignorada(s)`);
  }

  return parts.join(" · ") || "Nenhuma alteração aplicada";
}

const HEADER_ALIASES: Record<ImportField, string[]> = {
  attendant: [
    "nome",
    "colaborador",
    "atendente",
    "name",
    "agente",
    "operador",
    "usuario",
    "funcionario",
    "analista",
    "attendant",
  ],
  date: ["data", "date", "dia", "data_atendimento", "data registro", "dt", "data_atend"],
  channel: ["canal", "channel", "tipo", "tipo_atendimento", "origem", "meio", "plataforma", "ligacao"],
  count: [
    "quantidade",
    "qtd",
    "qtde",
    "atendimentos",
    "total",
    "volume",
    "count",
    "qtd_atendimentos",
    "total_atendimentos",
    "qtd atendimentos",
    "atendida",
    "recebida",
    "entrada",
    "atendidas",
    "oferecidas",
  ],
  averageTime: [
    "tempo",
    "tempo_medio",
    "tempo medio",
    "duracao",
    "duração",
    "tme",
    "tma",
    "average_time",
    "tempo_medio_atendimento",
  ],
};

const REQUIRED_FIELDS: ImportField[] = ["attendant", "date", "channel", "count"];

const METRIC_HEADER_PATTERN =
  /^(recebida|atendida|abandon|recuper|taxa|perda|sem_atendimento|auto_recuper|unicas?|percent|atendimento_pos|coluna_\d+|pct)/;

const FIELD_MIN_SCORE: Record<ImportField, number> = {
  attendant: 80,
  date: 65,
  channel: 65,
  count: 35,
  averageTime: 35,
};

function isMetricColumn(key: string): boolean {
  if (!key) return true;
  if (METRIC_HEADER_PATTERN.test(key)) return true;
  return (
    key.includes("percent") ||
    key.includes("taxa") ||
    key.includes("abandon") ||
    key.includes("recuper")
  );
}

/** "% Atendidas" normaliza para "atendidas" — não usar como coluna de quantidade */
function isPercentageOrRateColumn(header: string, key: string): boolean {
  const raw = header.trim();
  if (raw.startsWith("%") || raw.includes("%")) return true;
  if (key.includes("percent") || key.includes("pct") || key.includes("taxa")) return true;
  if (key.startsWith("pct_") || key.endsWith("_pct")) return true;
  return false;
}

function formatSpreadsheetDate(value: unknown): string {
  if (value instanceof Date) {
    if (value.getFullYear() <= 1900) return "";
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  const text = String(value ?? "").trim();
  if (!text) return "";
  return parseDateValue(text) ?? "";
}

function inferChannelFromFileName(fileName: string): AttendanceChannel | null {
  const key = normalizeHeader(fileName.replace(/\.[^.]+$/, ""));
  if (key.includes("whatsapp") || key.includes("whats") || key.includes("zap")) {
    return "WhatsApp";
  }
  if (
    key.includes("ligacao") ||
    key.includes("rel") ||
    key.includes("voz") ||
    key.includes("telefone")
  ) {
    return "Ligação";
  }
  return null;
}

function inferConsolidatedLabel(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  return base || "Total consolidado";
}

function scoreHeaderForField(field: ImportField, key: string, alias: string): number {
  if ((field === "attendant" || field === "channel") && isMetricColumn(key)) {
    return 0;
  }
  if (field === "attendant" && (key === "data" || key.startsWith("data_"))) {
    return 0;
  }
  if (field === "count") {
    if (key === "atendidas" && alias === "atendidas") return 100;
    if (key === "atendida" && alias === "atendida") return 98;
    if (key === "entrada" && alias === "entrada") return 95;
    if (key === "recebida" && alias === "recebida") return 90;
    if (key === "oferecidas" && alias === "oferecidas") return 70;
  }
  if (field === "attendant" && key === "nome" && alias === "nome") return 100;
  return scoreHeaderMatch(key, alias);
}

function scoreHeaderMatch(key: string, alias: string): number {
  if (!key || !alias) return 0;
  if (key === alias) return 100;
  if (key.startsWith(`${alias}_`) || key.endsWith(`_${alias}`)) return 80;
  if (key.startsWith(alias) || key.endsWith(alias)) return 65;
  if (alias.length >= 4 && key.includes(alias)) return 45;
  if (key.length >= 4 && alias.includes(key)) return 35;
  return 0;
}

function findHeaderRowIndex(matrix: unknown[][]): number {
  let bestIndex = 0;
  let bestScore = -1;

  const scanLimit = Math.min(matrix.length, 12);
  for (let i = 0; i < scanLimit; i++) {
    const cells = matrix[i].map((cell) => cellToString(cell)).filter((cell) => cell.length > 0);
    if (cells.length < 2) continue;

    let score = cells.length * 8;
    for (const cell of cells) {
      const key = normalizeHeader(cell);
      for (const aliases of Object.values(HEADER_ALIASES)) {
        if (aliases.some((alias) => scoreHeaderMatch(key, alias) >= 65)) {
          score += 24;
        }
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  return bestIndex;
}

function dedupeHeaders(headers: string[]): string[] {
  const counts = new Map<string, number>();

  return headers.map((header, index) => {
    const base = header.trim() || `Coluna ${index + 1}`;
    const seen = counts.get(base) ?? 0;
    counts.set(base, seen + 1);
    return seen === 0 ? base : `${base} (${seen + 1})`;
  });
}

function rowsFromMatrix(
  matrix: unknown[][],
  toCell: (value: unknown) => string
): ParsedSheet["rows"] {
  if (matrix.length === 0) throw new Error("Planilha sem dados");

  const headerIndex = findHeaderRowIndex(matrix);
  const table = matrix.slice(headerIndex);
  if (table.length === 0) throw new Error("Planilha sem dados");

  const headers = dedupeHeaders(table[0].map((cell) => toCell(cell)));
  return table.slice(1).map((cells) => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = toCell(cells[index]);
    });
    return record;
  });
}

export function parseMatrixToParsedSheet(
  matrix: unknown[][],
  fileName: string,
  importNotes?: string[]
): ParsedSheet {
  let rows = rowsFromMatrix(matrix, (value) => String(value ?? "").trim());
  rows = rows.filter((row) => Object.values(row).some((value) => value.trim().length > 0));
  if (rows.length === 0) throw new Error("Nenhuma linha de dados encontrada");

  const headers = Object.keys(rows[0] ?? {});
  if (headers.length === 0) throw new Error("Cabeçalhos não encontrados");

  return {
    headers,
    rows,
    fileName,
    importNotes,
  };
}

function parseExcelSerialDate(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < 1 || serial > 100000) return null;

  const parsed = XLSX.SSF.parse_date_code(serial);
  if (!parsed) return null;

  const y = parsed.y;
  const m = String(parsed.m).padStart(2, "0");
  const d = String(parsed.d).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

export function normalizeName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ");
}

/** Totais diários REL 067/091 importados das abas Voz/Chat (ex.: "Chat REL091") */
export function isChannelSummaryImportRow(name: string): boolean {
  const compact = name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
  return /\brel\s*0?\d{2,3}\b/.test(compact);
}

function parseCsv(content: string): ParsedSheet["rows"] {
  const text = content.replace(/^\uFEFF/, "").trim();
  if (!text) throw new Error("Arquivo vazio");

  const firstLine = text.split(/\r?\n/)[0] ?? "";
  const delimiter =
    (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";

  const rows: string[][] = [];
  let current = "";
  let inQuotes = false;
  let row: string[] = [];

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === delimiter) {
      row.push(current.trim());
      current = "";
      continue;
    }

    if (!inQuotes && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") i++;
      row.push(current.trim());
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
      current = "";
      continue;
    }

    current += char;
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current.trim());
    if (row.some((cell) => cell.length > 0)) rows.push(row);
  }

  if (rows.length === 0) throw new Error("Arquivo sem linhas de dados");

  return rowsFromMatrix(rows, (value) => String(value ?? "").trim());
}

function cellToString(value: unknown): string {
  if (value == null || value === "") return "";

  if (value instanceof Date) {
    if (value.getFullYear() <= 1900) {
      const h = value.getHours();
      const m = value.getMinutes();
      const s = value.getSeconds();
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    }
    const y = value.getFullYear();
    const mo = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${mo}-${d}`;
  }

  if (typeof value === "number") {
    return String(value);
  }

  return String(value).trim();
}

type SheetKind = "productivity" | "summary" | "unknown";

const UNIFIED_COL = {
  colaborador: "Colaborador",
  data: "Data",
  canal: "Canal",
  quantidade: "Quantidade",
  tempo: "Tempo médio",
} as const;

function classifySheet(headers: string[]): SheetKind {
  const keys = headers.map(normalizeHeader);
  const hasNome = keys.includes("nome");
  const hasData = keys.some((key) =>
    HEADER_ALIASES.date.some((alias) => scoreHeaderForField("date", key, alias) >= 65)
  );
  const hasPersonVolume =
    keys.includes("atendidas") ||
    keys.includes("atendida") ||
    keys.includes("entrada") ||
    keys.includes("saida") ||
    keys.includes("oferecidas");

  if (hasNome && hasData && hasPersonVolume) {
    return "productivity";
  }

  const hasSummaryVolume =
    keys.includes("recebida") ||
    (keys.includes("atendida") && !keys.includes("atendidas"));
  if (hasData && hasSummaryVolume && !hasNome) {
    return "summary";
  }

  return "unknown";
}

function inferChannelFromSheetName(sheetName: string): AttendanceChannel {
  const key = normalizeHeader(sheetName);
  if (key.includes("chat") || key.includes("whatsapp") || key.includes("zap")) {
    return "WhatsApp";
  }
  return "Ligação";
}

function resolveSheetKind(sheetName: string, headers: string[]): SheetKind {
  const kind = classifySheet(headers);
  if (kind !== "unknown") return kind;

  const sheetKey = normalizeHeader(sheetName);
  const keys = headers.map(normalizeHeader);
  const hasNome = keys.includes("nome");
  const hasData = keys.some((key) =>
    HEADER_ALIASES.date.some((alias) => scoreHeaderForField("date", key, alias) >= 65)
  );
  const hasVolume =
    keys.includes("atendidas") ||
    keys.includes("atendida") ||
    keys.includes("entrada") ||
    keys.includes("saida") ||
    keys.includes("oferecidas");

  if (sheetKey.includes("prod") && hasNome && hasData && hasVolume) {
    return "productivity";
  }

  return "unknown";
}

function volumeTotalsFromImportRows(rows: Record<string, string>[]) {
  const summaryKeys = new Set<string>();
  let ligacaoTotal = 0;
  let whatsappTotal = 0;
  let ligacaoRows = 0;
  let whatsappRows = 0;

  for (const row of rows) {
    const date = row[UNIFIED_COL.data]?.trim() ?? "";
    const name = row[UNIFIED_COL.colaborador]?.trim() ?? "";
    const channel = row[UNIFIED_COL.canal]?.trim() ?? "";
    const qty = parseCountValue(row[UNIFIED_COL.quantidade] ?? "") ?? 0;
    if (!date || !channel || qty <= 0) continue;

    if (isChannelSummaryImportRow(name)) {
      summaryKeys.add(`${date}|${channel}`);
    }
  }

  for (const row of rows) {
    const date = row[UNIFIED_COL.data]?.trim() ?? "";
    const name = row[UNIFIED_COL.colaborador]?.trim() ?? "";
    const channel = row[UNIFIED_COL.canal]?.trim() ?? "";
    const qty = parseCountValue(row[UNIFIED_COL.quantidade] ?? "") ?? 0;
    if (!date || !channel || qty <= 0) continue;

    const isSummary = isChannelSummaryImportRow(name);
    const key = `${date}|${channel}`;
    if (!isSummary && summaryKeys.has(key)) continue;

    if (channel === "Ligação") {
      ligacaoRows += 1;
      ligacaoTotal += qty;
    } else if (channel === "WhatsApp") {
      whatsappRows += 1;
      whatsappTotal += qty;
    }
  }

  return { ligacaoRows, whatsappRows, ligacaoTotal, whatsappTotal };
}

function buildImportPreview(parsed: ParsedSheet): ImportProfileAnalysis["preview"] {
  const dates = new Set<string>();
  const attendantNames = new Set<string>();
  const volume = volumeTotalsFromImportRows(parsed.rows);

  for (const row of parsed.rows) {
    const date = row[UNIFIED_COL.data]?.trim() ?? "";
    const name = row[UNIFIED_COL.colaborador]?.trim() ?? "";
    if (date) dates.add(date);
    if (name && !isChannelSummaryImportRow(name)) attendantNames.add(name);
  }

  const sortedDates = Array.from(dates).sort();

  return {
    totalRows: parsed.rows.length,
    uniqueAttendants: attendantNames.size,
    uniqueDays: dates.size,
    ...volume,
    dateStart: sortedDates[0],
    dateEnd: sortedDates[sortedDates.length - 1],
  };
}

export function pickProductivityCountColumn(headers: string[]): string | null {
  const items = headers
    .map((original, index) => ({
      original,
      key: normalizeHeader(original),
      index,
    }))
    .filter((item) => !isPercentageOrRateColumn(item.original, item.key));

  const pickFirst = (...keys: string[]) => {
    const matches = items.filter((item) => keys.includes(item.key));
    if (matches.length === 0) return null;
    matches.sort((a, b) => a.index - b.index);
    return matches[0]?.original ?? null;
  };

  // Prefer the first Atendidas/Entrada column (REL025 has a second "Atendidas" under Ligações Ativas)
  return (
    pickFirst("atendidas", "atendida") ??
    pickFirst("entrada") ??
    pickFirst("saida") ??
    pickFirst("oferecidas") ??
    null
  );
}

function readProductivityCount(
  row: Record<string, string>,
  headers: string[],
  channel: AttendanceChannel
): number | null {
  if (channel === "WhatsApp") {
    const entradaCol = headers.find((header) => normalizeHeader(header) === "entrada");
    const saidaCol = headers.find((header) => normalizeHeader(header) === "saida");
    const entrada = entradaCol ? parseCountValue(row[entradaCol] ?? "") ?? 0 : 0;
    const saida = saidaCol ? parseCountValue(row[saidaCol] ?? "") ?? 0 : 0;
    const total = entrada + saida;
    return total > 0 ? total : null;
  }

  const countCol = pickProductivityCountColumn(headers);
  if (!countCol) return null;
  return parseCountValue(row[countCol] ?? "");
}

function inferSummarySheetLabel(matrix: unknown[][], sheetName: string): string {
  const title = cellToString(matrix[0]?.[0]);
  if (title.trim().length > 2) return title.trim();
  return sheetName;
}

function extractSummarySheetRows(
  matrix: unknown[][],
  sheetName: string,
  channel: AttendanceChannel
): Record<string, string>[] {
  if (matrix.length < 2) return [];

  const headerIndex = findHeaderRowIndex(matrix);
  const headers = dedupeHeaders(matrix[headerIndex].map((cell) => cellToString(cell)));
  if (classifySheet(headers) !== "summary") return [];

  const dateCol = headers.find((header) => normalizeHeader(header) === "data");
  const metricKey = channel === "WhatsApp" ? "recebida" : "atendida";
  const countCol = headers.find((header) => normalizeHeader(header) === metricKey);
  const tmaCol = headers.find((header) => normalizeHeader(header) === "tma");
  if (!dateCol || !countCol) return [];

  const label = inferSummarySheetLabel(matrix, sheetName);
  const rows = rowsFromMatrix(matrix, cellToString);
  const merged: Record<string, string>[] = [];

  for (const row of rows) {
    const date = formatSpreadsheetDate(row[dateCol] ?? "");
    const count = parseCountValue(row[countCol] ?? "");
    if (!date || count == null) continue;

    merged.push({
      [UNIFIED_COL.colaborador]: label,
      [UNIFIED_COL.data]: date,
      [UNIFIED_COL.canal]: channel,
      [UNIFIED_COL.quantidade]: String(count),
      [UNIFIED_COL.tempo]: tmaCol ? row[tmaCol] ?? "" : "",
    });
  }

  return merged;
}

function extractSummarySheetTotals(workbook: XLSX.WorkBook): SummaryReferenceTotals {
  const result: SummaryReferenceTotals = {};

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: "",
      raw: true,
    });
    if (matrix.length < 2) continue;

    const headerIndex = findHeaderRowIndex(matrix);
    const headers = dedupeHeaders(matrix[headerIndex].map((cell) => cellToString(cell)));
    if (classifySheet(headers) !== "summary") continue;

    const channel = inferChannelFromSheetName(sheetName);
    const metricKey = channel === "WhatsApp" ? "recebida" : "atendida";
    const countCol = headers.find((header) => normalizeHeader(header) === metricKey);
    const dateCol = headers.find((header) => normalizeHeader(header) === "data");
    if (!countCol || !dateCol) continue;

    let total = 0;
    let days = 0;
    const rows = rowsFromMatrix(matrix, cellToString);

    for (const row of rows) {
      const count = parseCountValue(row[countCol] ?? "");
      const date = formatSpreadsheetDate(row[dateCol] ?? "");
      if (!date || count == null) continue;
      total += count;
      days += 1;
    }

    const entry = { metric: countCol.trim(), total, days };
    if (channel === "Ligação") {
      result.ligacao = entry;
    } else {
      result.whatsapp = entry;
    }
  }

  return result;
}

export function getAcompanhamentoDiarioMapping(): ColumnMapping {
  return {
    attendant: UNIFIED_COL.colaborador,
    date: UNIFIED_COL.data,
    channel: UNIFIED_COL.canal,
    count: UNIFIED_COL.quantidade,
    averageTime: UNIFIED_COL.tempo,
  };
}

function productivityMapping(headers: string[]): ColumnMapping {
  const auto = detectColumnMapping(headers);
  return {
    attendant: headers.find((h) => normalizeHeader(h) === "nome") ?? auto.attendant,
    date: auto.date,
    channel: null,
    count: pickProductivityCountColumn(headers) ?? auto.count,
    averageTime:
      headers.find((h) => normalizeHeader(h) === "tma") ?? auto.averageTime,
  };
}

function mergeProductivitySheets(
  workbook: XLSX.WorkBook,
  fileName: string
): ParsedSheet | null {
  const mergedRows: Record<string, string>[] = [];
  const sourceSheets: NonNullable<ParsedSheet["sourceSheets"]> = [];
  const ignoredSheets: NonNullable<ParsedSheet["ignoredSheets"]> = [];
  const summaryReference = extractSummarySheetTotals(workbook);

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: "",
      raw: true,
    });
    if (matrix.length < 2) continue;

    const headerIndex = findHeaderRowIndex(matrix);
    const headers = dedupeHeaders(matrix[headerIndex].map((cell) => cellToString(cell)));
    const kind = resolveSheetKind(sheetName, headers);

    if (kind === "summary") {
      const channel = inferChannelFromSheetName(sheetName);
      const summaryRows = extractSummarySheetRows(matrix, sheetName, channel);
      let sheetAttendancesTotal = 0;

      for (const row of summaryRows) {
        sheetAttendancesTotal += parseCountValue(row[UNIFIED_COL.quantidade] ?? "") ?? 0;
        mergedRows.push(row);
      }

      if (summaryRows.length > 0) {
        sourceSheets.push({
          name: sheetName,
          channel,
          rowCount: summaryRows.length,
          attendancesTotal: sheetAttendancesTotal,
          role: "summary",
        });
      } else {
        ignoredSheets.push({
          name: sheetName,
          reason: "Resumo diário sem linhas válidas",
        });
      }
      continue;
    }

    if (kind !== "productivity") {
      ignoredSheets.push({
        name: sheetName,
        reason: "Formato não reconhecido para produtividade por colaborador",
      });
      continue;
    }

    const channel = inferChannelFromSheetName(sheetName);
    const mapping = productivityMapping(headers);
    const rows = rowsFromMatrix(matrix, cellToString);
    let sheetRowCount = 0;
    let sheetAttendancesTotal = 0;

    for (const row of rows) {
      const name = mapping.attendant ? row[mapping.attendant]?.trim() : "";
      const dateRaw = mapping.date ? row[mapping.date] ?? "" : "";
      if (!name || !dateRaw) continue;

      const count = readProductivityCount(row, headers, channel);
      if (count == null || count === 0) continue;

      const date = formatSpreadsheetDate(dateRaw);
      if (!date) continue;

      const timeRaw = mapping.averageTime ? row[mapping.averageTime] ?? "" : "";
      sheetRowCount += 1;
      sheetAttendancesTotal += count;
      mergedRows.push({
        [UNIFIED_COL.colaborador]: name,
        [UNIFIED_COL.data]: date,
        [UNIFIED_COL.canal]: channel,
        [UNIFIED_COL.quantidade]: String(count),
        [UNIFIED_COL.tempo]: timeRaw,
      });
    }

    if (sheetRowCount > 0) {
      sourceSheets.push({
        name: sheetName,
        channel,
        rowCount: sheetRowCount,
        attendancesTotal: sheetAttendancesTotal,
        role: "productivity",
      });
    } else {
      ignoredSheets.push({
        name: sheetName,
        reason: "Nenhum atendimento com quantidade maior que zero nesta aba",
      });
    }
  }

  if (mergedRows.length === 0) return null;

  return buildMergedProductivitySheet(
    sourceSheets,
    mergedRows,
    fileName,
    [],
    ignoredSheets,
    summaryReference
  );
}

export interface ProductivityTableSection {
  name: string;
  channel: AttendanceChannel;
  headers: string[];
  rows: Record<string, string>[];
}

function channelSummaryMetricLabel(channel: AttendanceChannel): string {
  return channel === "WhatsApp" ? "Recebida/dia" : "Atendida/dia";
}

function buildMergedProductivitySheet(
  sourceSheets: NonNullable<ParsedSheet["sourceSheets"]>,
  mergedRows: Record<string, string>[],
  fileName: string,
  extraNotes: string[] = [],
  ignoredSheets: NonNullable<ParsedSheet["ignoredSheets"]> = [],
  summaryReference?: SummaryReferenceTotals
): ParsedSheet {
  const headers = [
    UNIFIED_COL.colaborador,
    UNIFIED_COL.data,
    UNIFIED_COL.canal,
    UNIFIED_COL.quantidade,
    UNIFIED_COL.tempo,
  ];

  const ignoredNotes = ignoredSheets.map((sheet) => `Ignorada: ${sheet.name} (${sheet.reason})`);

  return {
    headers,
    rows: mergedRows,
    fileName,
    sourceSheets,
    ignoredSheets,
    summaryReference,
    importNotes: [
      ...extraNotes,
      ...sourceSheets.map((sheet) => {
        const roleLabel =
          sheet.role === "summary"
            ? channelSummaryMetricLabel(sheet.channel)
            : "produtividade";
        return `${sheet.name} (${sheet.channel}, ${roleLabel}): ${sheet.rowCount} dia(s), ${sheet.attendancesTotal} atendimento(s)`;
      }),
      ...ignoredNotes,
    ],
  };
}

export function mergeProductivityTables(
  sections: ProductivityTableSection[],
  fileName: string,
  extraNotes: string[] = []
): ParsedSheet | null {
  const mergedRows: Record<string, string>[] = [];
  const sourceSheets: NonNullable<ParsedSheet["sourceSheets"]> = [];

  for (const section of sections) {
    if (classifySheet(section.headers) !== "productivity") continue;

    const mapping = productivityMapping(section.headers);
    let sheetRowCount = 0;
    let sheetAttendancesTotal = 0;

    for (const row of section.rows) {
      const name = mapping.attendant ? row[mapping.attendant]?.trim() : "";
      const dateRaw = mapping.date ? row[mapping.date] ?? "" : "";
      if (!name || !dateRaw) continue;

      const count = readProductivityCount(row, section.headers, section.channel);
      if (count == null || count === 0) continue;

      const date = formatSpreadsheetDate(dateRaw);
      if (!date) continue;

      const timeRaw = mapping.averageTime ? row[mapping.averageTime] ?? "" : "";
      sheetRowCount += 1;
      sheetAttendancesTotal += count;
      mergedRows.push({
        [UNIFIED_COL.colaborador]: name,
        [UNIFIED_COL.data]: date,
        [UNIFIED_COL.canal]: section.channel,
        [UNIFIED_COL.quantidade]: String(count),
        [UNIFIED_COL.tempo]: timeRaw,
      });
    }

    if (sheetRowCount > 0) {
      sourceSheets.push({
        name: section.name,
        channel: section.channel,
        rowCount: sheetRowCount,
        attendancesTotal: sheetAttendancesTotal,
        role: "productivity",
      });
    }
  }

  if (mergedRows.length === 0) return null;

  return buildMergedProductivitySheet(sourceSheets, mergedRows, fileName, extraNotes);
}

function parseExcelBuffer(buffer: ArrayBuffer): Record<string, string>[] {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("Planilha Excel vazia");

  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: true,
  });

  return rowsFromMatrix(matrix, cellToString);
}

function detectImportKind(file: File, buffer: ArrayBuffer): "excel" | "csv" | "pdf" {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (extension === "pdf" || file.type === "application/pdf") return "pdf";
  if (extension === "xlsx" || extension === "xls") return "excel";

  const bytes = new Uint8Array(buffer.slice(0, 4));
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  const isOle = bytes[0] === 0xd0 && bytes[1] === 0xcf;
  if (isZip || isOle) return "excel";

  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return "pdf";
  }

  return "csv";
}

function parseExcel(buffer: ArrayBuffer): Record<string, string>[] {
  return parseExcelBuffer(buffer);
}

export type SheetPreviewForDetect = {
  titleRow: string[];
  headerRow: string[];
  sampleRows: string[][];
  totalRows: number;
};

/** Monta preview por aba para o endpoint import.detectSchema (Excel). */
export async function buildSheetsPreviewForDetect(
  file: File
): Promise<Record<string, SheetPreviewForDetect> | null> {
  const buffer = await file.arrayBuffer();
  const kind = detectImportKind(file, buffer);
  if (kind !== "excel") return null;

  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const previews: Record<string, SheetPreviewForDetect> = {};

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: "",
      raw: true,
    });
    if (matrix.length < 2) continue;

    const headerIndex = findHeaderRowIndex(matrix);
    const titleRow = (matrix[0] ?? []).map((cell) => cellToString(cell));
    const headerRow = (matrix[headerIndex] ?? []).map((cell) => cellToString(cell));
    const dataStart = headerIndex + 1;
    const sampleRows = matrix
      .slice(dataStart, dataStart + 5)
      .map((row) => (row ?? []).map((cell) => cellToString(cell)));
    const totalRows = Math.max(0, matrix.length - dataStart);

    previews[sheetName] = {
      titleRow,
      headerRow,
      sampleRows,
      totalRows,
    };
  }

  return Object.keys(previews).length > 0 ? previews : null;
}

export async function parseSpreadsheetFile(file: File): Promise<ParsedSheet> {
  const buffer = await file.arrayBuffer();
  const kind = detectImportKind(file, buffer);

  if (kind === "pdf") {
    const { parsePdfFile } = await import("./pdfImport");
    return parsePdfFile(file);
  }

  if (kind === "excel") {
    const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
    const merged = mergeProductivitySheets(workbook, file.name);
    if (merged) return merged;
  }

  let rows: Record<string, string>[];
  if (kind === "excel") {
    rows = parseExcel(buffer);
  } else {
    rows = parseCsv(new TextDecoder("utf-8").decode(buffer));
  }

  rows = rows.filter((row) => Object.values(row).some((value) => value.trim().length > 0));
  if (rows.length === 0) throw new Error("Nenhuma linha de dados encontrada");

  const headers = Object.keys(rows[0] ?? {});
  if (headers.length === 0) throw new Error("Cabeçalhos não encontrados");

  return { headers, rows, fileName: file.name };
}

export function analyzeImportProfile(
  headersOrSheet: string[] | ParsedSheet,
  fileName?: string
): ImportProfileAnalysis {
  const parsed: ParsedSheet | null =
    Array.isArray(headersOrSheet)
      ? null
      : headersOrSheet;
  const headers: string[] = parsed ? parsed.headers : (headersOrSheet as string[]);
  const name = parsed?.fileName ?? fileName ?? "";

  if (parsed?.sourceSheets?.length) {
    const preview = buildImportPreview(parsed);

    return {
      profile: "acompanhamento_diario",
      formatLabel: "Acompanhamento Diário — produtividade por colaborador",
      message:
        "Totais diários vêm das abas Voz (Atendida) e Chat (Recebida) — ex.: 1.337 WhatsApp em 01/06. " +
        "Voz Prod e Chat Prod alimentam o desempenho por colaborador.",
      suggestedConsolidatedName: inferConsolidatedLabel(name),
      suggestedChannel: inferChannelFromFileName(name) ?? "Ligação",
      importedSheets: parsed.sourceSheets,
      ignoredSheets: parsed.ignoredSheets,
      preview,
      summaryReference: parsed.summaryReference,
    };
  }

  const keys = headers.map((header) => normalizeHeader(header));
  const hasStrongAttendant = keys.some(
    (key) =>
      !isMetricColumn(key) &&
      HEADER_ALIASES.attendant.some(
        (alias) => scoreHeaderForField("attendant", key, alias) >= 80
      )
  );
  const hasDate = keys.some((key) =>
    HEADER_ALIASES.date.some((alias) => scoreHeaderForField("date", key, alias) >= 65)
  );
  const hasMetricVolume = keys.includes("atendida") || keys.includes("recebida");
  const suggestedChannel = inferChannelFromFileName(name) ?? "Ligação";
  const suggestedConsolidatedName = inferConsolidatedLabel(name);

  if (hasDate && hasMetricVolume && !hasStrongAttendant) {
    return {
      profile: "rel_summary",
      formatLabel: "Relatório consolidado por dia",
      message:
        "Esta planilha parece ser um relatório consolidado por dia (Recebida, Atendida, etc.), sem colaborador em cada linha. Ative o modo consolidado para importar.",
      suggestedConsolidatedName,
      suggestedChannel,
    };
  }

  return {
    profile: "detailed",
    formatLabel: "Planilha detalhada por colaborador",
    message: "",
    suggestedConsolidatedName,
    suggestedChannel,
  };
}

export function detectColumnMapping(headers: string[], _fileName?: string): ColumnMapping {
  const normalizedHeaders = headers.map((header) => ({
    original: header,
    key: normalizeHeader(header),
  }));

  const mapping: ColumnMapping = {
    attendant: null,
    date: null,
    channel: null,
    count: null,
    averageTime: null,
  };

  const usedHeaders = new Set<string>();
  const fields: ImportField[] = [
    "date",
    "count",
    "channel",
    "attendant",
    "averageTime",
  ];

  for (const field of fields) {
    let bestMatch: { original: string; score: number } | null = null;

    for (const header of normalizedHeaders) {
      if (usedHeaders.has(header.original) || !header.key) continue;

      let score = 0;
      for (const alias of HEADER_ALIASES[field]) {
        score = Math.max(score, scoreHeaderForField(field, header.key, alias));
      }

      if (score > 0 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { original: header.original, score };
      }
    }

    if (bestMatch && bestMatch.score >= FIELD_MIN_SCORE[field]) {
      mapping[field] = bestMatch.original;
      usedHeaders.add(bestMatch.original);
    }
  }

  return mapping;
}

export function isMappingComplete(
  mapping: ColumnMapping,
  options?: Pick<
    ImportBatchOptions,
    "consolidated" | "consolidatedChannel" | "consolidatedAttendantName"
  >
): boolean {
  if (!mapping.date || !mapping.count) return false;

  if (options?.consolidated) {
    return Boolean(options.consolidatedChannel && options.consolidatedAttendantName?.trim());
  }

  return Boolean(mapping.attendant && mapping.channel);
}

function parseDateValue(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const asNumber = Number(value.replace(",", "."));
  if (/^\d{4,}(\.\d+)?$/.test(value) && Number.isFinite(asNumber)) {
    const fromExcel = parseExcelSerialDate(asNumber);
    if (fromExcel) return fromExcel;
  }

  const br = value.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (br) {
    const day = br[1].padStart(2, "0");
    const month = br[2].padStart(2, "0");
    const year = br[3].length === 2 ? `20${br[3]}` : br[3];
    return `${year}-${month}-${day}`;
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, "0");
    const d = String(parsed.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  return null;
}

function parseChannelValue(raw: string): AttendanceChannel | null {
  const value = normalizeHeader(raw);
  if (!value) return null;

  if (
    value.includes("whatsapp") ||
    value.includes("whats") ||
    value === "zap" ||
    value === "wa"
  ) {
    return "WhatsApp";
  }

  if (
    value.includes("ligacao") ||
    value.includes("telefone") ||
    value.includes("call") ||
    value.includes("voz") ||
    value.includes("phone") ||
    value === "voz"
  ) {
    return "Ligação";
  }

  if (value === "ligacao" || value === "whatsapp") {
    return value === "whatsapp" ? "WhatsApp" : "Ligação";
  }

  return null;
}

function parseCountValue(raw: string): number | null {
  const normalized = raw.replace(/\./g, "").replace(",", ".").trim();
  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value);
}

function parseAverageTimeValue(raw: string): number {
  if (!raw.trim()) return 3;

  const trimmed = raw.trim();
  const clock = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (clock) {
    const first = parseInt(clock[1], 10);
    const second = parseInt(clock[2], 10);
    if (clock[3]) {
      const third = parseInt(clock[3], 10);
      return first * 60 + second + third / 60;
    }
    if (first < 60) {
      return first + second / 60;
    }
    return first * 60 + second;
  }

  const fromParser = parseTimeInput(trimmed);
  if (fromParser && fromParser > 0) return fromParser;

  const asNumber = Number(trimmed.replace(",", "."));
  if (Number.isFinite(asNumber) && asNumber > 0) return asNumber;

  return 3;
}

interface NormalizedImportRow {
  rowNumber: number;
  attendantName: string;
  date: string;
  channel: AttendanceChannel;
  attendancesCount: number;
  averageTimeMinutes: number;
}

function normalizeRows(
  rows: Record<string, string>[],
  mapping: ColumnMapping,
  options: ImportBatchOptions
): { valid: NormalizedImportRow[]; errors: { rowNumber: number; message: string }[] } {
  const valid: NormalizedImportRow[] = [];
  const errors: { rowNumber: number; message: string }[] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const attendantName = mapping.attendant
      ? row[mapping.attendant]?.trim() ?? ""
      : options.consolidated
        ? options.consolidatedAttendantName?.trim() ?? ""
        : "";
    const dateRaw = row[mapping.date!] ?? "";
    const countRaw = row[mapping.count!] ?? "";
    const channelRaw = mapping.channel ? row[mapping.channel] ?? "" : "";
    const timeRaw = mapping.averageTime ? row[mapping.averageTime] ?? "" : "";

    if (!attendantName && !dateRaw && !countRaw && !channelRaw) return;

    if (!attendantName) {
      errors.push({ rowNumber, message: "Nome do colaborador vazio" });
      return;
    }

    const date = parseDateValue(dateRaw);
    if (!date) {
      errors.push({ rowNumber, message: `Data inválida: "${dateRaw}"` });
      return;
    }

    const channel = mapping.channel
      ? parseChannelValue(channelRaw)
      : options.consolidated
        ? options.consolidatedChannel ?? null
        : parseChannelValue(row[UNIFIED_COL.canal] ?? channelRaw);

    if (!channel) {
      errors.push({
        rowNumber,
        message: mapping.channel
          ? `Canal não reconhecido: "${channelRaw}" (use Ligação ou WhatsApp)`
          : "Canal não definido para importação consolidada",
      });
      return;
    }

    const attendancesCount = parseCountValue(countRaw);
    if (attendancesCount == null) {
      errors.push({ rowNumber, message: `Quantidade inválida: "${countRaw}"` });
      return;
    }

    valid.push({
      rowNumber,
      attendantName,
      date,
      channel,
      attendancesCount,
      averageTimeMinutes: parseAverageTimeValue(timeRaw),
    });
  });

  return { valid, errors };
}

function aggregateDuplicateRows(rows: NormalizedImportRow[]): {
  aggregated: NormalizedImportRow[];
  mergedCount: number;
} {
  const map = new Map<string, NormalizedImportRow>();
  let mergedCount = 0;

  for (const row of rows) {
    const key = `${normalizeName(row.attendantName)}|${row.date}|${row.channel}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...row });
      continue;
    }

    mergedCount++;
    const totalCount = existing.attendancesCount + row.attendancesCount;
    const weightedTime =
      (existing.averageTimeMinutes * existing.attendancesCount +
        row.averageTimeMinutes * row.attendancesCount) /
      totalCount;

    map.set(key, {
      ...existing,
      attendancesCount: totalCount,
      averageTimeMinutes: weightedTime,
      rowNumber: existing.rowNumber,
    });
  }

  return { aggregated: Array.from(map.values()), mergedCount };
}

export function buildImportPlan(
  rows: Record<string, string>[],
  mapping: ColumnMapping,
  attendants: Attendant[],
  existingRecords: DailyPerformanceRecord[],
  options: ImportBatchOptions
): ImportPlan {
  const onlyNewDays = options.onlyNewDays ?? true;
  const { valid: parsed, errors } = normalizeRows(rows, mapping, options);
  const { aggregated, mergedCount } = aggregateDuplicateRows(parsed);

  const attendantByName = new Map(
    attendants.map((attendant) => [normalizeName(attendant.name), attendant])
  );

  const existingDates = new Set(existingRecords.map((record) => record.date));
  const fileDates = new Set(aggregated.map((row) => row.date));
  const newDaysInFile = Array.from(fileDates)
    .filter((date) => !existingDates.has(date))
    .sort();
  const existingDaysInFile = Array.from(fileDates)
    .filter((date) => existingDates.has(date))
    .sort();

  const unknownAttendantNames = new Set<string>();
  for (const row of aggregated) {
    if (!attendantByName.has(normalizeName(row.attendantName))) {
      unknownAttendantNames.add(row.attendantName.trim());
    }
  }

  const existingByKey = new Map(
    existingRecords.map((record) => [
      `${record.attendantId}|${record.date}|${record.channel}`,
      record,
    ])
  );

  const newAttendantNames = new Set<string>();
  const preview: ImportRowPreview[] = [];
  let newRecords = 0;
  let updates = 0;
  let skippedDuplicates = 0;
  let skippedExistingDays = 0;

  for (const row of aggregated) {
    const normalized = normalizeName(row.attendantName);
    let attendant = attendantByName.get(normalized);

    if (onlyNewDays && existingDates.has(row.date)) {
      preview.push({
        ...row,
        status: "skip",
        note: "Dia já importado",
        skipReason: "existing_day",
      });
      skippedExistingDays++;
      continue;
    }

    if (!attendant) {
      if (!options.createAttendants) {
        errors.push({
          rowNumber: row.rowNumber,
          message: `Colaborador não cadastrado: "${row.attendantName}"`,
        });
        continue;
      }
      newAttendantNames.add(row.attendantName.trim());
      attendant = { id: -1, name: row.attendantName.trim() } as Attendant;
    }

    const existing =
      attendant.id > 0
        ? existingByKey.get(`${attendant.id}|${row.date}|${row.channel}`)
        : undefined;

    if (existing) {
      if (options.updateDuplicates) {
        preview.push({ ...row, status: "update", note: "Substituir registro existente", skipReason: undefined });
        updates++;
      } else {
        preview.push({
          ...row,
          status: "skip",
          note: "Duplicata ignorada",
          skipReason: "duplicate",
        });
        skippedDuplicates++;
      }
      continue;
    }

    preview.push({ ...row, status: "new" });
    newRecords++;
  }

  return {
    valid: preview,
    errors,
    stats: {
      totalRows: rows.length,
      validCount: preview.length,
      newRecords,
      updates,
      skippedDuplicates,
      skippedExistingDays,
      newAttendants: newAttendantNames.size,
      aggregatedRows: mergedCount,
      unknownAttendants: Array.from(unknownAttendantNames).sort((a, b) =>
        a.localeCompare(b, "pt-BR")
      ),
      newDaysInFile,
      existingDaysInFile,
    },
  };
}

function collectImportChannelCountsByName(
  plan: ImportPlan
): Map<string, Map<AttendantServiceChannel, number>> {
  const byName = new Map<string, Map<AttendantServiceChannel, number>>();

  for (const row of plan.valid) {
    if (row.status === "skip") continue;

    const serviceChannel = toAttendantServiceChannel(row.channel);
    if (!serviceChannel) continue;

    const key = normalizeName(row.attendantName);
    const counts = byName.get(key) ?? new Map<AttendantServiceChannel, number>();
    counts.set(serviceChannel, (counts.get(serviceChannel) ?? 0) + 1);
    byName.set(key, counts);
  }

  return byName;
}

function applyImportChannelsToAttendants(
  attendants: Attendant[],
  channelCountsByName: Map<string, Map<AttendantServiceChannel, number>>
): Attendant[] {
  if (channelCountsByName.size === 0) return attendants;

  return attendants.map((attendant) => {
    const counts = channelCountsByName.get(normalizeName(attendant.name));
    if (!counts) return attendant;

    const serviceChannel = pickDominantServiceChannel(counts);
    if (attendant.serviceChannel === serviceChannel) return attendant;

    return { ...attendant, serviceChannel };
  });
}

export function executePerformanceImport(
  plan: ImportPlan,
  attendants: Attendant[],
  existingRecords: DailyPerformanceRecord[],
  options: ImportBatchOptions
): {
  attendants: Attendant[];
  performanceRecords: DailyPerformanceRecord[];
  result: ImportBatchResult;
} {
  let nextAttendants = [...attendants];
  let nextRecords = [...existingRecords];

  const existingDates = new Set(existingRecords.map((record) => record.date));
  const attendantByName = new Map(
    nextAttendants.map((attendant) => [normalizeName(attendant.name), attendant])
  );

  let imported = 0;
  let updated = 0;
  let skipped = 0;
  let skippedExistingDays = 0;
  let createdAttendants = 0;
  const affectedAttendantIds = new Set<number>();
  const importedDates = new Set<string>();

  const now = new Date().toISOString();

  for (const row of plan.valid) {
    if (row.status === "skip") {
      skipped++;
      if (row.skipReason === "existing_day") skippedExistingDays++;
      continue;
    }

    let attendant = attendantByName.get(normalizeName(row.attendantName));
    if (!attendant && options.createAttendants) {
      const serviceChannel =
        toAttendantServiceChannel(row.channel) ?? ("Ligação" as AttendantServiceChannel);

      const created = createAttendant(
        {
          name: row.attendantName.trim(),
          role: "Atendente",
          serviceChannel,
          workingHours: "08h00",
          jornadaStart: "",
          jornadaEnd: "",
          observation: "Importado automaticamente",
        },
        nextAttendants
      );
      nextAttendants.push(created);
      attendantByName.set(normalizeName(created.name), created);
      attendant = created;
      createdAttendants++;
    }

    if (!attendant) continue;

    const duplicateIndex = nextRecords.findIndex(
      (record) =>
        record.attendantId === attendant!.id &&
        record.date === row.date &&
        record.channel === row.channel
    );

    if (duplicateIndex >= 0 && row.status === "update") {
      nextRecords[duplicateIndex] = {
        ...nextRecords[duplicateIndex],
        attendancesCount: row.attendancesCount,
        averageTimeMinutes: row.averageTimeMinutes,
        attendantName: attendant.name,
        updatedAt: now,
      };
      updated++;
      affectedAttendantIds.add(attendant.id);
      importedDates.add(row.date);
      continue;
    }

    if (duplicateIndex >= 0) {
      skipped++;
      continue;
    }

    nextRecords.push({
      id: newId(),
      attendantId: attendant.id,
      attendantName: attendant.name,
      date: row.date,
      channel: row.channel,
      attendancesCount: row.attendancesCount,
      averageTimeMinutes: row.averageTimeMinutes,
      createdAt: now,
      updatedAt: now,
    });
    imported++;
    affectedAttendantIds.add(attendant.id);
    importedDates.add(row.date);
  }

  const newDays = Array.from(importedDates)
    .filter((date) => !existingDates.has(date))
    .sort();

  nextAttendants = applyImportChannelsToAttendants(
    nextAttendants,
    collectImportChannelCountsByName(plan)
  );

  const result: ImportBatchResult = {
    imported,
    updated,
    skipped,
    skippedExistingDays,
    createdAttendants,
    uniqueAttendants: affectedAttendantIds.size,
    newDays,
    logMessage: "",
    errors: plan.errors,
  };
  result.logMessage = formatImportLogMessage(result);

  return {
    attendants: nextAttendants,
    performanceRecords: nextRecords,
    result,
  };
}
