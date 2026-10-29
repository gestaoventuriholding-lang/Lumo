/**
 * Leitor de relatórios de produtividade por agente (ex.: REL090 — Chat).
 *
 * Não depende de posição fixa: acha a tabela em qualquer aba, aceita cabeçalho de duas linhas
 * (grupo mesclado + coluna), reconhece colunas por nome (com sinônimos, sem acento) e ignora
 * linhas de total/média. Se o sistema mudar a ordem, o nome ou a linha do cabeçalho, continua lendo.
 */
import * as XLSX from "xlsx";

export type ReportChannel = "Ligação" | "WhatsApp";

export interface ProductivityRow {
  attendantName: string;
  code?: string;
  /** YYYY-MM-DD quando o relatório vem separado por dia */
  date?: string;
  inbound?: number;
  outbound?: number;
  /** entrada + saída (ou a coluna única de atendimentos) */
  total: number;
  talkSeconds?: number;
  tmaSeconds?: number;
  loginSeconds?: number;
  pauseSeconds?: number;
  pausePercent?: number;
  pauseLegalSeconds?: number;
  pauseProductiveSeconds?: number;
  pauseUnproductiveSeconds?: number;
  occupancy1?: number;
  occupancy2?: number;
  occupancy3?: number;
  occupancy4?: number;
  /** atendimentos por hora logada, sempre recalculado (o relatório às vezes traz multiplicado por 100) */
  perHour?: number;
}

export interface ProductivityReport {
  title: string;
  reportCode?: string;
  sheetName: string;
  channel: ReportChannel | null;
  periodStart?: string;
  periodEnd?: string;
  /** "daily": cada linha tem seu dia; "period": uma linha por colaborador para o período todo */
  mode: "daily" | "period";
  rows: ProductivityRow[];
  /** Campos reconhecidos, na linguagem do usuário (para conferência na tela) */
  recognizedFields: string[];
  warnings: string[];
}

type FieldKey =
  | "attendant"
  | "code"
  | "date"
  | "inbound"
  | "outbound"
  | "count"
  | "talk"
  | "tma"
  | "login"
  | "pause"
  | "pausePercent"
  | "pauseLegal"
  | "pauseProductive"
  | "pauseUnproductive"
  | "to1"
  | "to2"
  | "to3"
  | "to4"
  | "perHour";

const FIELD_LABELS: Record<FieldKey, string> = {
  attendant: "Colaborador",
  code: "Código",
  date: "Data",
  inbound: "Atendimentos de entrada",
  outbound: "Atendimentos de saída",
  count: "Atendimentos",
  talk: "Tempo em atendimento",
  tma: "TMA",
  login: "Tempo logado",
  pause: "Pausa",
  pausePercent: "% de pausa",
  pauseLegal: "Pausa legal",
  pauseProductive: "Pausa produtiva",
  pauseUnproductive: "Pausa improdutiva",
  to1: "Taxa de ocupação (TO1)",
  to2: "Taxa de ocupação (TO2)",
  to3: "Taxa de ocupação (TO3)",
  to4: "Taxa de ocupação (TO4)",
  perHour: "Atendimentos por hora",
};

/** Campos que só existem em relatório de produtividade (evita confundir com planilha simples) */
const PRODUCTIVITY_FIELDS: FieldKey[] = [
  "inbound",
  "outbound",
  "login",
  "pause",
  "pausePercent",
  "pauseLegal",
  "pauseProductive",
  "pauseUnproductive",
  "to1",
  "to2",
  "to3",
  "to4",
  "perHour",
];

export function normalizeText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9%]+/g, " ")
    .trim();
}

/** Do mais específico para o mais geral: a primeira regra que casar vence. */
function matchField(rawLabel: string, rawGroup = ""): FieldKey | null {
  const label = normalizeText(rawLabel);
  const group = normalizeText(rawGroup);
  if (!label) return null;

  if (/^to ?([1-4])$/.test(label)) return `to${label.slice(-1)}` as FieldKey;
  if (/taxa de ocupacao|ocupacao/.test(label)) return "to1";
  if (/por hora|\bhora\b.*atend|atend.*\bhora\b|chamadas hora/.test(label)) return "perHour";
  if (/(^%|%$)/.test(label) && /pausa/.test(label)) return "pausePercent";
  if (/pausa/.test(label) && /(legal)/.test(label)) return "pauseLegal";
  if (/pausa/.test(label) && /(improdutiv)/.test(label)) return "pauseUnproductive";
  if (/pausa/.test(label) && /(produtiv)/.test(label)) return "pauseProductive";
  if (/^(tempo de |tempo em |total de )?pausas?$/.test(label)) return "pause";
  if (/^(tma|tempo medio( de atendimento)?|tempo medio de conversa)$/.test(label)) return "tma";
  if (/^(login|tempo logado|tempo de login|tempo em login|logado)$/.test(label)) return "login";
  if (/^(entrada|entradas|recebidas?|receptivo|receptivas?|atendidas? entrada|atend entrada)$/.test(label))
    return "inbound";
  if (/^(saida|saidas|ativo|ativas?|efetuadas?|originadas?)$/.test(label)) return "outbound";
  if (/^(tempo|tempo total|tempo de atendimento|tempo em atendimento|tempo de conversa)$/.test(label)) {
    // "Tempo" solto só é tempo de atendimento quando está sob o grupo de atendimentos
    return group === "" || /atendimento|chamada|conversa/.test(group) ? "talk" : null;
  }
  if (/^(codigo|cod|matricula|id|id agente|codigo do agente|codigo agente)$/.test(label)) return "code";
  if (/^(data|dia|data do atendimento|data atendimento|data hora|periodo)$/.test(label)) return "date";
  if (
    /^(atendimentos?|total de atendimentos|qtd atendimentos|quantidade de atendimentos|quantidade|atendidas?|total)$/.test(
      label
    )
  )
    return "count";
  if (
    /^(nome|nome do agente|agente|atendente|colaborador|colaboradora|operador|operadora|funcionario|usuario|nome agente)$/.test(
      label
    )
  )
    return "attendant";
  return null;
}

// ---------------------------------------------------------------
// Conversão de valores
// ---------------------------------------------------------------

/** "04 09:49:11" (4 dias e 9h), "09:56:22", "12:25" (mm:ss) ou número (segundos se o relatório diz) */
export function parseDurationSeconds(value: string, numbersAreSeconds = false): number | undefined {
  const text = value.trim();
  if (!text) return undefined;

  const withDays = /^(\d+)\s+(\d{1,3}):(\d{2}):(\d{2})$/.exec(text);
  if (withDays) {
    return (
      Number(withDays[1]) * 86400 +
      Number(withDays[2]) * 3600 +
      Number(withDays[3]) * 60 +
      Number(withDays[4])
    );
  }
  const hms = /^(\d+):(\d{2}):(\d{2})$/.exec(text);
  if (hms) return Number(hms[1]) * 3600 + Number(hms[2]) * 60 + Number(hms[3]);
  const ms = /^(\d+):(\d{2})$/.exec(text);
  if (ms) return Number(ms[1]) * 60 + Number(ms[2]);

  const n = parseNumber(text);
  if (n == null) return undefined;
  return numbersAreSeconds ? n : n * 60;
}

export function parseNumber(value: string): number | undefined {
  let text = value.trim().replace(/\s/g, "").replace(/%$/, "");
  if (!text || !/\d/.test(text)) return undefined;
  const hasComma = text.includes(",");
  const hasDot = text.includes(".");
  if (hasComma && hasDot) {
    // o último separador é o decimal
    text =
      text.lastIndexOf(",") > text.lastIndexOf(".")
        ? text.replace(/\./g, "").replace(",", ".")
        : text.replace(/,/g, "");
  } else if (hasComma) {
    text = /^-?\d{1,3}(,\d{3})+$/.test(text) ? text.replace(/,/g, "") : text.replace(",", ".");
  } else if (hasDot && /^-?\d{1,3}(\.\d{3})+$/.test(text)) {
    text = text.replace(/\./g, "");
  }
  const n = Number(text);
  return Number.isFinite(n) ? n : undefined;
}

/** dd/mm/aaaa, aaaa-mm-dd ou dd/mm/aa → YYYY-MM-DD */
export function parseReportDate(value: string): string | undefined {
  const text = value.trim();
  const br = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/.exec(text);
  if (br) {
    const year = br[3].length === 2 ? `20${br[3]}` : br[3];
    return `${year}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : undefined;
}

// ---------------------------------------------------------------
// Leitura do arquivo
// ---------------------------------------------------------------

type Matrix = string[][];

function sheetToMatrix(ws: XLSX.WorkSheet): Matrix {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, defval: "", blankrows: true });
  const matrix: Matrix = rows.map((row) => row.map((cell) => String(cell ?? "").trim()));

  // preenche células mescladas com o valor do canto superior esquerdo
  for (const merge of ws["!merges"] ?? []) {
    const origin = matrix[merge.s.r]?.[merge.s.c] ?? "";
    if (!origin) continue;
    for (let r = merge.s.r; r <= merge.e.r; r++) {
      for (let c = merge.s.c; c <= merge.e.c; c++) {
        if (!matrix[r]) matrix[r] = [];
        if (!matrix[r][c]) matrix[r][c] = origin;
      }
    }
  }
  return matrix;
}

interface Header {
  rowIndex: number;
  fields: Map<number, FieldKey>;
}

/** Procura a linha de cabeçalho (com ou sem uma linha de grupo acima) */
function findHeader(matrix: Matrix): Header | null {
  let best: { header: Header; score: number } | null = null;

  for (let r = 0; r < Math.min(matrix.length, 60); r++) {
    const row = matrix[r] ?? [];
    const group = r > 0 ? matrix[r - 1] ?? [] : [];
    const fields = new Map<number, FieldKey>();
    const seen = new Set<FieldKey>();

    row.forEach((cell, col) => {
      const field = matchField(cell, group[col] ?? "");
      if (field && !seen.has(field)) {
        fields.set(col, field);
        seen.add(field);
      }
    });

    // linha de grupo (ex.: "Agente | Atendimentos | Login / Pausa") pode trazer o campo do colaborador
    if (!seen.has("attendant")) {
      group.forEach((cell, col) => {
        if (matchField(cell) === "attendant" && !fields.has(col) && !row[col]) {
          fields.set(col, "attendant");
          seen.add("attendant");
        }
      });
    }

    const productivityHits = PRODUCTIVITY_FIELDS.filter((f) => seen.has(f)).length;
    const score = seen.size + productivityHits * 2 + (seen.has("attendant") ? 3 : 0);
    if (seen.has("attendant") && seen.size >= 3 && (!best || score > best.score)) {
      best = { header: { rowIndex: r, fields }, score };
    }
  }
  return best?.header ?? null;
}

const SUMMARY_ROW = /^_?\s*(total|totais|media|medias|soma|geral|resumo|subtotal)\b/;

function inferChannel(text: string): ReportChannel | null {
  const t = normalizeText(text);
  if (/\b(chat|whats|whatsapp|mensage)/.test(t)) return "WhatsApp";
  if (/\b(voz|ligacao|ligacoes|telefon|chamada|ura|ativo receptivo)/.test(t)) return "Ligação";
  return null;
}

function extractMeta(workbook: XLSX.WorkBook, fileName: string) {
  let title = "";
  let reportCode: string | undefined;
  let periodStart: string | undefined;
  let periodEnd: string | undefined;
  let secondsFlag = false;

  for (const name of workbook.SheetNames) {
    const matrix = sheetToMatrix(workbook.Sheets[name]);
    for (const row of matrix.slice(0, 40)) {
      const line = row.filter(Boolean).join(" ");
      if (!line) continue;
      if (!title && /rel\s?-?\s?\d{2,4}|relat[oó]rio|estat[ií]sticas|produtividade/i.test(line) && !/gerado em/i.test(line)) {
        title = row.find(Boolean) ?? "";
      }
      reportCode ??= /\bREL\s?-?\s?(\d{2,4})\b/i.exec(line)?.[0].replace(/\s|-/g, "").toUpperCase();

      if (!periodStart) {
        const dates = Array.from(line.matchAll(/(\d{1,2}\/\d{1,2}\/\d{2,4})/g)).map((m) =>
          parseReportDate(m[1])
        );
        if (/hor[aá]rio|per[ií]odo|de\s.*at[eé]|filtro/i.test(line) && dates.length >= 1 && !/gerado em/i.test(line)) {
          periodStart = dates[0];
          periodEnd = dates[1] ?? dates[0];
        }
      }
      if (/tempo em segundos/i.test(line) && /\bsim\b/i.test(line)) secondsFlag = true;
    }
  }
  const channel = inferChannel(`${title} ${fileName} ${workbook.SheetNames.join(" ")}`);
  return { title, reportCode, periodStart, periodEnd, secondsFlag, channel };
}

function cell(row: string[], fields: Map<number, FieldKey>, key: FieldKey): string | undefined {
  let found: string | undefined;
  fields.forEach((field, col) => {
    if (found === undefined && field === key) found = row[col];
  });
  return found;
}

/**
 * Lê um relatório de produtividade. Devolve null quando o arquivo não é desse tipo
 * (assim as planilhas simples continuam no importador antigo).
 */
export function parseProductivityWorkbook(
  workbook: XLSX.WorkBook,
  fileName = ""
): ProductivityReport | null {
  const meta = extractMeta(workbook, fileName);

  for (const sheetName of workbook.SheetNames) {
    const matrix = sheetToMatrix(workbook.Sheets[sheetName]);
    const header = findHeader(matrix);
    if (!header) continue;

    const present = new Set(Array.from(header.fields.values()));
    const specific = PRODUCTIVITY_FIELDS.filter((f) => present.has(f));
    if (specific.length < 2) continue;

    const warnings: string[] = [];
    const rows: ProductivityRow[] = [];
    let skippedSummary = 0;

    for (let r = header.rowIndex + 1; r < matrix.length; r++) {
      const raw = matrix[r] ?? [];
      if (raw.every((c) => !c)) {
        if (rows.length > 0) break; // fim da tabela
        continue;
      }
      const name = (cell(raw, header.fields, "attendant") ?? "").trim();
      if (!name) continue;
      if (name.startsWith("_") || SUMMARY_ROW.test(normalizeText(name))) {
        skippedSummary++;
        continue;
      }

      const get = (key: FieldKey) => cell(raw, header.fields, key);
      const secs = (key: FieldKey) => {
        const v = get(key);
        return v == null || v === "" ? undefined : parseDurationSeconds(v, meta.secondsFlag);
      };
      const nums = (key: FieldKey) => {
        const v = get(key);
        return v == null || v === "" ? undefined : parseNumber(v);
      };

      const inbound = nums("inbound");
      const outbound = nums("outbound");
      const countColumn = nums("count");
      const total =
        inbound != null || outbound != null ? (inbound ?? 0) + (outbound ?? 0) : countColumn ?? 0;
      const loginSeconds = secs("login");
      const dateText = get("date");

      rows.push({
        attendantName: name,
        code: get("code") || undefined,
        date: dateText ? parseReportDate(dateText) : undefined,
        inbound,
        outbound,
        total,
        talkSeconds: secs("talk"),
        tmaSeconds: secs("tma"),
        loginSeconds,
        pauseSeconds: secs("pause"),
        pausePercent: nums("pausePercent"),
        pauseLegalSeconds: secs("pauseLegal"),
        pauseProductiveSeconds: secs("pauseProductive"),
        pauseUnproductiveSeconds: secs("pauseUnproductive"),
        occupancy1: nums("to1"),
        occupancy2: nums("to2"),
        occupancy3: nums("to3"),
        occupancy4: nums("to4"),
        // recalculado: o relatório pode trazer o valor multiplicado por 100
        perHour:
          loginSeconds && loginSeconds > 0
            ? Math.round((total / (loginSeconds / 3600)) * 100) / 100
            : undefined,
      });
    }

    if (rows.length === 0) continue;

    const hasDates = rows.every((row) => row.date);
    const singleDay = meta.periodStart != null && meta.periodStart === meta.periodEnd;
    const mode: ProductivityReport["mode"] = hasDates || singleDay ? "daily" : "period";

    if (mode === "daily" && !hasDates && meta.periodStart) {
      for (const row of rows) row.date = meta.periodStart;
    }
    if (mode === "period" && !meta.periodStart) {
      warnings.push(
        "Não encontrei o período no arquivo. Informe a data inicial e final antes de importar."
      );
    }
    if (skippedSummary > 0) {
      warnings.push(`${skippedSummary} linha(s) de total/média foram ignoradas.`);
    }
    if (!meta.channel) {
      warnings.push("Não consegui identificar o canal (Ligação ou WhatsApp). Escolha antes de importar.");
    }

    return {
      title: meta.title || sheetName,
      reportCode: meta.reportCode,
      sheetName,
      channel: meta.channel,
      periodStart: meta.periodStart,
      periodEnd: meta.periodEnd,
      mode,
      rows,
      recognizedFields: Array.from(new Set(Array.from(header.fields.values()))).map(
        (f) => FIELD_LABELS[f]
      ),
      warnings,
    };
  }
  return null;
}

/** Atalho para arquivos (.xls, .xlsx, .csv) já lidos em memória */
export function parseProductivityBuffer(buffer: ArrayBuffer, fileName: string): ProductivityReport | null {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: false });
  return parseProductivityWorkbook(workbook, fileName);
}
