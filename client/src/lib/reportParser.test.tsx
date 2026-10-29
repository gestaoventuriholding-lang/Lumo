import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
  parseDurationSeconds,
  parseNumber,
  parseProductivityWorkbook,
  parseReportDate,
} from "./reportParser";

/** Monta um arquivo com o mesmo formato do REL090 (título, filtros, tabela com grupo mesclado, observações) */
function buildRel090(options?: { shuffle?: boolean; titleRows?: number; renamed?: boolean }) {
  const wb = XLSX.utils.book_new();
  const header = options?.renamed
    ? ["Agente", "Cód.", "Recebidas", "Saída", "Tempo", "TMA", "Login", "Pausa", "% Pausa", "Pausa legal", "Pausa produtiva", "Pausa improdutiva", "TO1", "TO2", "Atendimentos por hora"]
    : ["Nome", "Código", "Entrada", "Saída", "Tempo", "TMA", "Login", "Pausa", "% Pausa", "Pausa legal", "Pausa produtiva", "Pausa improdutiva", "TO1", "TO2", "Atendimentos por hora"];
  const data = [
    ["Ana", "1004", "19", "29", "09:56:22", "00:12:25", "05 11:39:58", "20:46:11", "15.77", "16:05:27", "03:29:14", "01:11:30", "8.6", "8.87", "36"],
    ["Ellen", "1037", "1434", "52", "04 09:49:11", "00:04:16", "06 02:57:55", "15:52:02", "10.8", "08:08:05", "00:34:03", "07:09:54", "76.22", "76.54", "1011"],
    ["_Média", "_media", "730", "26.25", "02 07:52:52", "00:05:15", "05 17:50:27", "16:39:31", "12.09", "12:08:20", "01:57:47", "02:33:23", "44.46", "45.16", "549"],
    ["Total", "", "1453", "81", "09 07:31:29", "00:21:02", "22 23:21:49", "02 18:38:05", "", "02 00:33:22", "07:51:11", "10:13:32", "", "", ""],
  ];
  const group = ["Agente", "", "Atendimentos", "", "", "", "Login / Pausa", "", "", "", "", "", "Taxa de ocupação", "", ""];

  let order = header.map((_, i) => i);
  if (options?.shuffle) order = [6, 0, 14, 2, 3, 7, 1, 4, 5, 8, 9, 10, 11, 12, 13];
  const pick = (row: string[]) => order.map((i) => row[i]);

  const table: string[][] = options?.shuffle ? [pick(header), ...data.map(pick)] : [group, header, ...data];
  const pad = Array.from({ length: options?.titleRows ?? 0 }, () => ["Logo da empresa", "", ""]);

  const ws = XLSX.utils.aoa_to_sheet([...pad, ...table]);
  if (!options?.shuffle) {
    const base = pad.length;
    ws["!merges"] = [
      { s: { r: base, c: 0 }, e: { r: base, c: 1 } },
      { s: { r: base, c: 2 }, e: { r: base, c: 5 } },
      { s: { r: base, c: 6 }, e: { r: base, c: 11 } },
      { s: { r: base, c: 12 }, e: { r: base, c: 13 } },
    ];
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Estatísticas de produtividade por agente - Chat - REL090"], ["Relatório gerado em 29/10/2026 12:20:33"]]), "Sheet1");
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ["Filtros utilizados no relatório:", ""],
      ["Horário corrido:", "01/10/2026 às 00:00:00 até 29/10/2026 às 23:59:59"],
      ["Estratificado:", "Não"],
      ["Tempo em segundos:", "Não"],
    ]),
    "Sheet2"
  );
  XLSX.utils.book_append_sheet(wb, ws, "Sheet3");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Observações"], ["TMA: Tempo médio dos atendimentos"]]), "Sheet4");
  return wb;
}

describe("parseProductivityWorkbook", () => {
  it("lê o REL090: ignora Total/Média, junta entrada+saída e converte tempos", () => {
    const report = parseProductivityWorkbook(buildRel090(), "Estatísticas_REL090.xls");
    expect(report).not.toBeNull();
    expect(report!.mode).toBe("period");
    expect(report!.channel).toBe("WhatsApp");
    expect(report!.reportCode).toBe("REL090");
    expect(report!.periodStart).toBe("2026-10-01");
    expect(report!.periodEnd).toBe("2026-10-29");
    expect(report!.rows.map((r) => r.attendantName)).toEqual(["Ana", "Ellen"]);

    const ellen = report!.rows[1];
    expect(ellen.inbound).toBe(1434);
    expect(ellen.outbound).toBe(52);
    expect(ellen.total).toBe(1486);
    expect(ellen.tmaSeconds).toBe(256);
    expect(ellen.loginSeconds).toBe(6 * 86400 + 2 * 3600 + 57 * 60 + 55);
    expect(ellen.pauseLegalSeconds).toBe(8 * 3600 + 8 * 60 + 5);
    expect(ellen.occupancy1).toBeCloseTo(76.22);
  });

  it("recalcula atendimentos por hora (o relatório traz multiplicado por 100)", () => {
    const report = parseProductivityWorkbook(buildRel090(), "REL090.xls")!;
    const ellen = report.rows[1];
    expect(ellen.perHour).toBeCloseTo(10.11, 1);
  });

  it("continua lendo com colunas fora de ordem", () => {
    const report = parseProductivityWorkbook(buildRel090({ shuffle: true }), "REL090.xls")!;
    expect(report.rows).toHaveLength(2);
    expect(report.rows[1].total).toBe(1486);
    expect(report.rows[1].tmaSeconds).toBe(256);
  });

  it("continua lendo com título acima e colunas com nomes diferentes", () => {
    const report = parseProductivityWorkbook(buildRel090({ titleRows: 6, renamed: true }), "REL090.xls")!;
    expect(report.rows).toHaveLength(2);
    expect(report.rows[1].inbound).toBe(1434);
    expect(report.recognizedFields).toContain("Atendimentos de entrada");
  });

  it("usa a data de cada linha quando o relatório vem estratificado por dia", () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["Data", "Agente", "Entrada", "Saída", "TMA", "Login", "Pausa"],
      ["01/10/2026", "Ana", "10", "2", "00:04:00", "08:00:00", "00:50:00"],
      ["02/10/2026", "Ana", "12", "0", "00:05:00", "07:30:00", "00:45:00"],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Dados");
    const report = parseProductivityWorkbook(wb, "voz_REL001.xlsx")!;
    expect(report.mode).toBe("daily");
    expect(report.channel).toBe("Ligação");
    expect(report.rows.map((r) => r.date)).toEqual(["2026-10-01", "2026-10-02"]);
    expect(report.rows[0].total).toBe(12);
  });

  it("não reivindica planilhas simples (colaborador, data, canal, quantidade)", () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["Colaborador", "Data", "Canal", "Atendimentos", "Tempo médio"],
      ["Ana", "01/10/2026", "WhatsApp", "20", "00:04:00"],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Plan1");
    expect(parseProductivityWorkbook(wb, "dados.xlsx")).toBeNull();
  });
});

describe("conversões", () => {
  it("lê durações com dias, horas e minutos", () => {
    expect(parseDurationSeconds("04 09:49:11")).toBe(4 * 86400 + 9 * 3600 + 49 * 60 + 11);
    expect(parseDurationSeconds("00:12:25")).toBe(745);
    expect(parseDurationSeconds("12:25")).toBe(745);
    expect(parseDurationSeconds("90", true)).toBe(90);
    expect(parseDurationSeconds("")).toBeUndefined();
  });

  it("lê números no padrão brasileiro e no americano", () => {
    expect(parseNumber("1.434")).toBe(1434);
    expect(parseNumber("15,77")).toBe(15.77);
    expect(parseNumber("15.77")).toBe(15.77);
    expect(parseNumber("1.234,56")).toBe(1234.56);
    expect(parseNumber("76.22%")).toBe(76.22);
    expect(parseNumber("abc")).toBeUndefined();
  });

  it("lê datas", () => {
    expect(parseReportDate("01/10/2026 às 00:00:00")).toBe("2026-10-01");
    expect(parseReportDate("2026-10-29")).toBe("2026-10-29");
  });
});
